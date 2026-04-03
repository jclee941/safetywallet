import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../../types";
import { resolveFasSource } from "../../../lib/fas";
import { error, success } from "../../../lib/response";
import { requireManagerOrAdmin } from "../helpers";
import {
  fetchAttendanceListPageOrNull,
  fetchDailyAttendanceRows,
  formatCheckinIso,
  loadLinkedUserMap,
  resolveAccsDay,
  type UnmatchedSourceRecord,
} from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/attendance/unmatched", requireManagerOrAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 2000);
  const offset = (page - 1) * limit;

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
  const accsDay = resolveAccsDay(c.req.query("date")?.trim());
  if (!accsDay)
    return error(c, "INVALID_DATE", "date must be YYYYMMDD or YYYY-MM-DD", 400);

  let allRecords: UnmatchedSourceRecord[] = [];
  const fetchedRecords: UnmatchedSourceRecord[] = [];
  let fetchOffset = 0;
  const fetchLimit = 500;
  let total = 0;
  let useFallback = false;

  do {
    const pageResult = await fetchAttendanceListPageOrNull(
      hd,
      accsDay,
      source,
      fetchLimit,
      fetchOffset,
    );
    if (!pageResult) {
      useFallback = true;
      break;
    }

    if (fetchOffset === 0) total = pageResult.total;
    fetchedRecords.push(
      ...pageResult.records.map((row) => ({
        emplCd: row.emplCd,
        accsDay: row.accsDay,
        inTime: row.inTime,
        outTime: row.outTime,
        partCd: row.partCd,
        name: row.name,
        companyName: row.companyName,
      })),
    );
    fetchOffset += pageResult.records.length;
    if (pageResult.records.length === 0) break;
  } while (fetchOffset < total);

  if (useFallback) {
    const fallbackRecords = await fetchDailyAttendanceRows(hd, accsDay, source);
    allRecords = fallbackRecords.map((row) => ({
      emplCd: row.emplCd,
      accsDay: row.accsDay,
      inTime: row.inTime,
      outTime: row.outTime,
      partCd: row.partCd,
      name: row.emplCd,
      companyName: null,
    }));
  } else {
    allRecords = fetchedRecords;
  }

  const workerExternalIds = [
    ...new Set(
      allRecords.map((row) => `${source.workerIdPrefix}${row.emplCd}`),
    ),
  ];
  const linkedWorkerIds = new Set(
    (await loadLinkedUserMap(db, workerExternalIds)).keys(),
  );

  const unmatchedAll = allRecords.filter(
    (row) => !linkedWorkerIds.has(`${source.workerIdPrefix}${row.emplCd}`),
  );
  const unmatchedRecords = unmatchedAll
    .slice(offset, offset + limit)
    .map((row) => ({
      id: `${row.emplCd}-${row.accsDay}-${row.inTime ?? ""}`,
      externalWorkerId: `${source.workerIdPrefix}${row.emplCd}`,
      siteId,
      siteName: null,
      checkinAt: formatCheckinIso(row.accsDay, row.inTime),
      source: "FAS_REALTIME",
      createdAt: null,
      companyName: row.companyName,
      name: row.name,
      partCd: row.partCd,
      inTime: row.inTime,
      outTime: row.outTime,
      accsDay: row.accsDay,
    }));

  return success(c, {
    records: unmatchedRecords,
    requestedSource: source.dbName,
    requestedSiteCd: source.siteCd,
    requestedSiteName: source.d1SiteName,
    metric: {
      key: "unmatchedLogs",
      definition:
        "attendance logs whose externalWorkerId has no active linked user in D1 for the selected site/day",
    },
    pagination: {
      page,
      limit,
      total: unmatchedAll.length,
      totalPages: Math.ceil(unmatchedAll.length / limit),
    },
  });
});

export default app;
