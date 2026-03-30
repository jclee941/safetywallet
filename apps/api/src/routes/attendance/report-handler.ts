import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray } from "drizzle-orm";
import { users, siteMemberships } from "../../db/schema";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";
import { getTodayRange } from "../../utils/common";
import {
  toAccsDay,
  formatAccsDayTime,
  type SiteAttendanceRecord,
} from "./index";
import { resolveFasSource, fasGetDailyAttendance } from "../../lib/fas";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

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
