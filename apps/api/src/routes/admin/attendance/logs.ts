import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../../types";
import {
  resolveFasSource,
  type FasAttendance,
  type FasAttendanceListRecord,
} from "../../../lib/fas";
import { error, success } from "../../../lib/response";
import { requireManagerOrAdmin } from "../helpers";
import {
  fetchAttendanceListPageOrNull,
  fetchDailyAttendanceRows,
  loadLinkedUserMap,
  mapFallbackLogRecord,
  mapLogRecord,
  resolveAccsDay,
} from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/attendance-logs", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const querySchema = z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    limit: z.coerce.number().min(1).max(2000).default(100),
  });

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success)
    return error(c, "INVALID_QUERY_PARAMS", parsed.error.message);

  const siteId = c.req.query("siteId");
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parsed.data.limit;
  const offset = (page - 1) * limit;
  const resultFilter = c.req.query("result");
  if (!siteId) return error(c, "MISSING_SITE", "현장을 선택해주세요", 400);

  const hd = c.env.FAS_HYPERDRIVE;
  if (!hd)
    return error(
      c,
      "SERVICE_UNAVAILABLE",
      "FAS_HYPERDRIVE not configured",
      503,
    );

  const source = resolveFasSource(c.req.query("source"));
  const accsDay = resolveAccsDay(parsed.data.date?.trim());
  if (!accsDay)
    return error(c, "INVALID_DATE", "date must be YYYYMMDD or YYYY-MM-DD", 400);

  if (resultFilter === "FAIL") {
    return success(c, {
      logs: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    });
  }

  const pageResult = await fetchAttendanceListPageOrNull(
    hd,
    accsDay,
    source,
    limit,
    offset,
  );

  let records: FasAttendanceListRecord[] = [];
  let fallbackRecords: FasAttendance[] = [];
  let total = 0;
  if (pageResult) {
    records = pageResult.records;
    total = pageResult.total;
  } else {
    const dailyRecords = await fetchDailyAttendanceRows(hd, accsDay, source);
    total = dailyRecords.length;
    fallbackRecords = dailyRecords.slice(offset, offset + limit);
  }

  const workerIds = [
    ...new Set(
      (fallbackRecords.length > 0 ? fallbackRecords : records).map(
        (row) => `${source.workerIdPrefix}${row.emplCd}`,
      ),
    ),
  ];
  const userMap = await loadLinkedUserMap(db, workerIds);

  const logs =
    fallbackRecords.length > 0
      ? fallbackRecords.map((row) =>
          mapFallbackLogRecord(row, userMap, source.workerIdPrefix),
        )
      : records.map((row) => mapLogRecord(row, userMap, source.workerIdPrefix));

  return success(c, {
    logs,
    requestedSource: source.dbName,
    requestedSiteCd: source.siteCd,
    requestedSiteName: source.d1SiteName,
    metric: {
      key: "totalLogs",
      definition:
        "row-level attendance logs from access_daily for the selected site/day before UI-side filtering",
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export default app;
