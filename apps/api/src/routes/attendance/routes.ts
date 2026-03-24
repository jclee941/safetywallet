import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray, or, isNull, gte } from "drizzle-orm";
import {
  attendance,
  users,
  siteMemberships,
  pointsLedger,
  pointPolicies,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";
import { getTodayRange } from "../../utils/common";
import { type AttendanceSyncEvent } from "../../validators/fas-sync";
import { createLogger } from "../../lib/logger";
import { dbBatchChunked } from "../../db/helpers";
import {
  fasCheckWorkerAttendance,
  fasGetDailyAttendance,
  fasGetDailyAttendanceRealtimeStats,
  resolveFasSource,
  resolveFasSourceByWorkerId,
} from "../../lib/fas";
import { logAuditWithContext } from "../../lib/audit";
import {
  IDEMPOTENCY_TTL,
  IN_QUERY_CHUNK_SIZE,
  type SiteAttendanceRecord,
  chunkArray,
  toAccsDay,
  formatAccsDayTime,
} from "./index";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

// POST /sync handler
export async function handleSync(c: AppContext) {
  const auth = c.get("auth");
  if (auth?.user?.role !== "SUPER_ADMIN" && auth?.user?.role !== "SITE_ADMIN") {
    return error(c, "FORBIDDEN", "관리자 권한이 필요합니다", 403);
  }
  const logger = createLogger("attendance");
  const idempotencyKey = c.req.header("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await c.env.KV.get(
      `attendance:idempotency:${idempotencyKey}`,
    );
    if (cached) {
      return success(c, JSON.parse(cached));
    }
  }

  let validatedBody: { events?: AttendanceSyncEvent[] } | undefined;
  try {
    validatedBody = (await c.req.json()) as
      | { events?: AttendanceSyncEvent[] }
      | undefined;
  } catch {
    return error(c, "INVALID_JSON", "Invalid JSON body", 400);
  }
  const body =
    validatedBody ??
    ((await c.req.raw.clone().json()) as {
      events?: AttendanceSyncEvent[];
    });

  if (!body.events || !Array.isArray(body.events)) {
    return error(c, "MISSING_EVENTS", "events array is required", 400);
  }

  const { events } = body;
  const db = drizzle(c.env.DB);

  const results = [];
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // BATCH FIX: Load all users at once instead of per-event
  const uniqueWorkerIds = [...new Set(events.map((e) => e.fasUserId))];
  const userMap = new Map<string, typeof users.$inferSelect>();

  if (uniqueWorkerIds.length > 0) {
    for (const workerIdChunk of chunkArray(
      uniqueWorkerIds,
      IN_QUERY_CHUNK_SIZE,
    )) {
      const userRecords = await db
        .select()
        .from(users)
        .where(inArray(users.externalWorkerId, workerIdChunk));

      for (const user of userRecords) {
        if (user.externalWorkerId) {
          userMap.set(user.externalWorkerId, user);
        }
      }
    }
  }

  // BATCH FIX: Check all existing attendance at once
  const attendanceKeys = events
    .filter((e) => e.siteId) // Filter out events without siteId
    .map((e) => ({
      workerId: e.fasUserId,
      siteId: e.siteId as string, // Guaranteed non-null by filter
      checkinAt: new Date(e.checkinAt),
    }));

  const existingSet = new Set<string>();
  if (attendanceKeys.length > 0) {
    for (const attendanceChunk of chunkArray(
      attendanceKeys,
      IN_QUERY_CHUNK_SIZE,
    )) {
      const conditions = attendanceChunk.map((key) =>
        and(
          eq(attendance.externalWorkerId, key.workerId),
          eq(attendance.siteId, key.siteId),
          eq(attendance.checkinAt, key.checkinAt),
        ),
      );

      const existing = await db
        .select({
          workerId: attendance.externalWorkerId,
          siteId: attendance.siteId,
          checkinAt: attendance.checkinAt,
        })
        .from(attendance)
        .where(or(...conditions));

      for (const record of existing) {
        if (record.workerId && record.siteId && record.checkinAt) {
          existingSet.add(
            `${record.workerId}|${record.siteId}|${record.checkinAt.getTime()}`,
          );
        }
      }
    }
  }

  // BATCH FIX: Prepare batch insert instead of individual inserts
  const insertBatch: (typeof attendance.$inferInsert)[] = [];
  for (const event of events) {
    const user = userMap.get(event.fasUserId);
    if (!user) {
      results.push({ fasEventId: event.fasEventId, result: "NOT_FOUND" });
      failed++;
      continue;
    }

    if (!event.siteId) {
      results.push({ fasEventId: event.fasEventId, result: "MISSING_SITE" });
      failed++;
      continue;
    }

    const checkinTime = new Date(event.checkinAt);
    const key = `${event.fasUserId}|${event.siteId}|${checkinTime.getTime()}`;

    if (existingSet.has(key)) {
      results.push({ fasEventId: event.fasEventId, result: "DUPLICATE" });
      skipped++;
      logger.debug(
        `[Attendance] Duplicate skipped: ${event.fasUserId} @ ${event.siteId} @ ${checkinTime.toISOString()}`,
      );
    } else {
      insertBatch.push({
        siteId: event.siteId,
        userId: user.id,
        externalWorkerId: event.fasUserId,
        result: "SUCCESS",
        source: "FAS",
        checkinAt: checkinTime,
      });
      results.push({ fasEventId: event.fasEventId, result: "SUCCESS" });
      inserted++;
    }
  }

  // Batch insert all at once
  if (insertBatch.length > 0) {
    try {
      const ops = insertBatch.map((values) =>
        db
          .insert(attendance)
          .values(values)
          .onConflictDoNothing({
            target: [
              attendance.externalWorkerId,
              attendance.siteId,
              attendance.checkinAt,
            ],
          }),
      );
      await dbBatchChunked(db, ops);

      // Auto-award attendance check-in points
      try {
        const awardSiteIds = [
          ...new Set(insertBatch.map((r) => r.siteId).filter(Boolean)),
        ] as string[];

        const policies =
          awardSiteIds.length > 0
            ? await db
                .select()
                .from(pointPolicies)
                .where(
                  and(
                    inArray(pointPolicies.siteId, awardSiteIds),
                    eq(pointPolicies.reasonCode, "ATTENDANCE_CHECK_IN"),
                    eq(pointPolicies.isActive, true),
                  ),
                )
            : [];

        if (policies.length > 0) {
          const policyBySite = new Map(policies.map((p) => [p.siteId, p]));

          const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const todayStr = kstNow.toISOString().slice(0, 10);
          const kstTodayStart = new Date(`${todayStr}T00:00:00+09:00`);
          const settleMonth = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, "0")}`;

          // Collect unique (userId, siteId) pairs for sites with policies
          const eligiblePairs: { userId: string; siteId: string }[] = [];
          const seenPairs = new Set<string>();
          for (const record of insertBatch) {
            if (
              !record.userId ||
              !record.siteId ||
              !policyBySite.has(record.siteId)
            )
              continue;
            const pairKey = `${record.userId}|${record.siteId}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              eligiblePairs.push({
                userId: record.userId,
                siteId: record.siteId,
              });
            }
          }

          if (eligiblePairs.length > 0) {
            // Check existing awards today for dedup
            const existingAwards = new Set<string>();
            for (const chunk of chunkArray(
              eligiblePairs,
              IN_QUERY_CHUNK_SIZE,
            )) {
              const conditions = chunk.map((p) =>
                and(
                  eq(pointsLedger.userId, p.userId),
                  eq(pointsLedger.siteId, p.siteId),
                  eq(pointsLedger.reasonCode, "ATTENDANCE_CHECK_IN"),
                  gte(pointsLedger.occurredAt, kstTodayStart),
                ),
              );
              const existing = await db
                .select({
                  userId: pointsLedger.userId,
                  siteId: pointsLedger.siteId,
                })
                .from(pointsLedger)
                .where(or(...conditions));
              for (const e of existing) {
                existingAwards.add(`${e.userId}|${e.siteId}`);
              }
            }

            // Award points for users not yet awarded today
            const pointInserts = eligiblePairs
              .filter((p) => !existingAwards.has(`${p.userId}|${p.siteId}`))
              .map((p) => {
                const policy = policyBySite.get(p.siteId)!;
                return db.insert(pointsLedger).values({
                  userId: p.userId,
                  siteId: p.siteId,
                  amount: policy.defaultAmount,
                  reasonCode: "ATTENDANCE_CHECK_IN",
                  reasonText: "출근 체크인 자동 포인트",
                  settleMonth,
                  occurredAt: new Date(),
                });
              });

            if (pointInserts.length > 0) {
              await dbBatchChunked(db, pointInserts);
              logger.info(
                `[Attendance] Auto-awarded ${pointInserts.length} check-in points`,
              );
            }
          }
        }
      } catch (pointErr) {
        // Never block attendance sync on point award failure
        logger.warn("[Attendance] Auto-award points failed", {
          error: {
            name: pointErr instanceof Error ? pointErr.name : "UnknownError",
            message:
              pointErr instanceof Error ? pointErr.message : String(pointErr),
          },
        });
      }
    } catch (err) {
      logger.error("Batch insert failed", {
        count: insertBatch.length,
        error: err instanceof Error ? err.message : String(err),
      });
      failed += insertBatch.length;
    }
  }

  const response = {
    processed: results.length,
    inserted,
    skipped,
    failed,
    results,
  };

  if (idempotencyKey) {
    await c.env.KV.put(
      `attendance:idempotency:${idempotencyKey}`,
      JSON.stringify(response),
      { expirationTtl: IDEMPOTENCY_TTL },
    );
  }

  try {
    await logAuditWithContext(
      c,
      db,
      "ATTENDANCE_SYNCED",
      "system",
      "ATTENDANCE",
      idempotencyKey || `attendance-sync:${Date.now()}`,
      {
        processed: response.processed,
        inserted: response.inserted,
        skipped: response.skipped,
        failed: response.failed,
      },
    );
  } catch {
    // Do not block successful sync response on audit failure.
  }

  return success(c, response);
}

// GET /today handler
export async function handleToday(c: AppContext) {
  const auth = c.get("auth");
  const db = drizzle(c.env.DB);
  const hyperdrive = c.env.FAS_HYPERDRIVE;
  if (!hyperdrive) {
    return error(
      c,
      "FAS_UNAVAILABLE",
      "FAS Hyperdrive binding not configured",
      503,
    );
  }

  const user = await db
    .select({ externalWorkerId: users.externalWorkerId })
    .from(users)
    .where(and(eq(users.id, auth.user.id), isNull(users.deletedAt)))
    .get();

  if (!user?.externalWorkerId) {
    return success(c, {
      hasAttendance: false,
      records: [],
    });
  }

  const { start } = getTodayRange();
  const todayAccsDay = toAccsDay(start);
  const { source, rawEmplCd } = resolveFasSourceByWorkerId(
    user.externalWorkerId,
  );
  let attendanceResult;
  try {
    attendanceResult = await fasCheckWorkerAttendance(
      hyperdrive,
      rawEmplCd,
      todayAccsDay,
      source,
    );
  } catch (err) {
    const log = c.var.log;
    log?.warn("FAS attendance query failed, returning empty", {
      error: {
        name: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err),
      },
      endpoint: "/attendance/today",
    });
    return success(c, { hasAttendance: false, records: [] });
  }

  return success(c, {
    hasAttendance: attendanceResult.hasAttendance,
    records: attendanceResult.records.map((record) => ({
      externalWorkerId: `${source.workerIdPrefix}${record.emplCd}`,
      accsDay: record.accsDay,
      source: "FAS_REALTIME",
      checkinAt: formatAccsDayTime(record.accsDay, record.inTime),
      checkoutAt: formatAccsDayTime(record.accsDay, record.outTime),
      inTime: record.inTime,
      outTime: record.outTime,
    })),
  });
}

// GET /site/:siteId/report handler
export async function handleSiteReport(c: AppContext) {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("siteId");
  if (!siteId) {
    return error(c, "BAD_REQUEST", "Site ID is required", 400);
  }

  // Auth check: SUPER_ADMIN or SITE_ADMIN of this site
  if (user.role !== "SUPER_ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "Site admin access required", 403);
    }
  }

  const hyperdrive = c.env.FAS_HYPERDRIVE;
  if (!hyperdrive) {
    return error(
      c,
      "FAS_UNAVAILABLE",
      "FAS Hyperdrive binding not configured",
      503,
    );
  }

  const sourceParam = c.req.query("source");
  const source = resolveFasSource(sourceParam);

  const { start } = getTodayRange();
  const dayStarts = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(start);
    dayStart.setUTCDate(dayStart.getUTCDate() - (6 - index));
    return dayStart;
  });

  const dailyRows = await Promise.all(
    dayStarts.map(async (dayStart) => {
      const accsDay = toAccsDay(dayStart);
      const rows = await fasGetDailyAttendance(
        hyperdrive,
        accsDay,
        source.siteCd,
        source,
      );
      return { accsDay, rows };
    }),
  );

  const workerIds = new Set<string>();
  for (const daily of dailyRows) {
    for (const row of daily.rows) {
      workerIds.add(`${source.workerIdPrefix}${row.emplCd}`);
    }
  }

  const linkedUsers =
    workerIds.size === 0
      ? []
      : await db
          .select({
            id: users.id,
            externalWorkerId: users.externalWorkerId,
            name: users.name,
            nameMasked: users.nameMasked,
          })
          .from(users)
          .where(inArray(users.externalWorkerId, [...workerIds]))
          .all();

  const userMap = new Map<
    string,
    { id: string; name: string | null; nameMasked: string | null }
  >();
  for (const linkedUser of linkedUsers) {
    if (!linkedUser.externalWorkerId) {
      continue;
    }
    userMap.set(linkedUser.externalWorkerId, {
      id: linkedUser.id,
      name: linkedUser.name,
      nameMasked: linkedUser.nameMasked,
    });
  }

  const report = dailyRows.map((daily) => {
    const records: SiteAttendanceRecord[] = daily.rows.map((row) => {
      const externalWorkerId = `${source.workerIdPrefix}${row.emplCd}`;
      const linked = userMap.get(externalWorkerId);
      return {
        userId: linked?.id ?? null,
        userName: linked?.name ?? linked?.nameMasked ?? row.emplCd,
        checkIn: formatAccsDayTime(row.accsDay, row.inTime),
        checkOut: formatAccsDayTime(row.accsDay, row.outTime),
        externalWorkerId,
      };
    });

    return {
      date: `${daily.accsDay.slice(0, 4)}-${daily.accsDay.slice(4, 6)}-${daily.accsDay.slice(6, 8)}`,
      records,
    };
  });

  return success(c, report);
}

// GET /realtime handler
export async function handleRealtime(c: AppContext) {
  const hyperdrive = c.env.FAS_HYPERDRIVE;
  if (!hyperdrive) {
    return error(
      c,
      "FAS_UNAVAILABLE",
      "FAS Hyperdrive binding not configured",
      503,
    );
  }

  // KST date: today or from query param (?date=YYYYMMDD or YYYY-MM-DD)
  const dateParam = c.req.query("date");
  let accsDay: string;
  if (dateParam) {
    accsDay = dateParam.replace(/-/g, "");
  } else {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    accsDay = kst.toISOString().slice(0, 10).replace(/-/g, "");
  }

  if (!/^\d{8}$/.test(accsDay)) {
    return error(
      c,
      "INVALID_DATE",
      "Date must be YYYYMMDD or YYYY-MM-DD format",
      400,
    );
  }

  const sourceParam = c.req.query("source");
  const source = resolveFasSource(sourceParam);

  try {
    const stats = await fasGetDailyAttendanceRealtimeStats(
      hyperdrive,
      accsDay,
      source.siteCd,
      source,
    );

    return success(c, {
      date: accsDay,
      siteCd: source.siteCd,
      siteName: source.d1SiteName,
      ...stats,
      source: source.dbName,
      realtimeDataSource: stats.source,
      metric: {
        key: "checkedInWorkers",
        definition:
          "distinct emplCd with non-empty inTime from access_daily for the selected site/day",
      },
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    const logger = createLogger("attendance");
    logger.error("Real-time attendance query failed", {
      accsDay,
      error: err instanceof Error ? err.message : String(err),
    });
    return error(
      c,
      "FAS_QUERY_FAILED",
      "Failed to query FAS attendance data",
      500,
    );
  }
}
