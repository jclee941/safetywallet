import { createLogger } from "../logger";
import type { HyperdriveBinding } from "../../types";
import { getConnection, queryWithTimeout } from "./connection";
import {
  buildDailyAttendanceFallbackCandidates,
  buildRawRowsCandidates,
  buildRawSummaryCandidates,
  buildRealtimeStatsCandidates,
  formatAccsDayWithDash,
  mergeAttendanceRecord,
  normalizeSiteCd,
  sortAttendanceByInTime,
} from "./attendance-helpers";
import {
  mapToFasAttendance,
  mapToFasAttendanceSiteCount,
  mapToFasAttendanceTrendPoint,
} from "./attendance-mappers";
import {
  createRawSummaryAccumulator,
  createRealtimeStatsAccumulator,
  finalizeRawRowsSource,
  finalizeRawSummary,
  finalizeRealtimeStats,
  mergeRawSummaryRows,
  mergeRealtimeStatsRows,
} from "./attendance-stats";
import {
  DEFAULT_FAS_SOURCE,
  tbl,
  type FasAttendance,
  type FasAttendanceRealtimeStats,
  type FasAttendanceSiteCount,
  type FasAttendanceTrendPoint,
  type FasRawAttendanceRowsResult,
  type FasRawAttendanceSummary,
  type FasSource,
} from "./types";

const logger = createLogger("fas-mariadb");

export async function fasGetDailyAttendance(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
  siteCd?: string | null,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasAttendance[]> {
  const conn = await getConnection(hyperdrive);
  try {
    const normalizedSiteCd = normalizeSiteCd(siteCd);
    const dateWithDash = formatAccsDayWithDash(accsDay);

    const [accessDailyRows] = await queryWithTimeout(
      conn,
      `SELECT ad.empl_cd, ad.accs_day, ad.in_time, ad.out_time,
            ad.state, ad.part_cd
       FROM ${tbl(source, "access_daily")} ad
      WHERE ad.accs_day = ?
        AND ad.in_time IS NOT NULL
        AND ad.in_time != '0000'
        AND ad.in_time != ''${normalizedSiteCd ? " AND ad.site_cd = ?" : ""}`,
      normalizedSiteCd ? [accsDay, normalizedSiteCd] : [accsDay],
    );
    const accessDailyMapped = (
      accessDailyRows as Array<Record<string, unknown>>
    ).map(mapToFasAttendance);

    if (accessDailyMapped.length > 0) {
      return sortAttendanceByInTime(accessDailyMapped);
    }

    logger.debug("FAS daily attendance falling back to raw sources", {
      action: "fas_daily_attendance_fallback",
      source: "access_daily+access+access_history.fallback",
      accsDay,
      siteCd: normalizedSiteCd,
    });

    const byWorker = new Map<string, FasAttendance>();
    const candidates = buildDailyAttendanceFallbackCandidates(
      source,
      dateWithDash,
      normalizedSiteCd,
    );

    for (const candidate of candidates) {
      try {
        const [rows] = await queryWithTimeout(
          conn,
          candidate.query,
          candidate.params,
        );
        const mapped = (rows as Array<Record<string, unknown>>).map(
          mapToFasAttendance,
        );
        for (const row of mapped) {
          mergeAttendanceRecord(byWorker, row);
        }
      } catch (err) {
        logger.debug("FAS attendance source query failed", {
          action: "fas_daily_attendance_fallback",
          source: candidate.query.slice(0, 32),
          error: { name: "QueryError", message: String(err) },
        });
        continue;
      }
    }

    return sortAttendanceByInTime([...byWorker.values()]);
  } finally {
    await conn.end();
  }
}

export async function fasGetDailyAttendanceRawSummary(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
  siteCd?: string | null,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasRawAttendanceSummary> {
  const conn = await getConnection(hyperdrive);
  const dateWithDash = formatAccsDayWithDash(accsDay);
  const normalizedSiteCd = normalizeSiteCd(siteCd);
  const candidates = buildRawSummaryCandidates(
    source,
    accsDay,
    dateWithDash,
    normalizedSiteCd,
  );

  try {
    const summary = createRawSummaryAccumulator();

    for (const candidate of candidates) {
      try {
        const [rows] = await queryWithTimeout(
          conn,
          candidate.query,
          candidate.params,
        );
        mergeRawSummaryRows(
          summary,
          rows as Array<Record<string, unknown>>,
          candidate.source,
        );
      } catch (err) {
        logger.debug("FAS raw summary source query failed", {
          action: "fas_raw_summary_fallback",
          source: candidate.source,
          error: { name: "QueryError", message: String(err) },
        });
      }
    }

    return finalizeRawSummary(summary);
  } finally {
    await conn.end();
  }
}

export async function fasGetDailyAttendanceRawRows(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
  siteCd?: string | null,
  limit = 200,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasRawAttendanceRowsResult> {
  const conn = await getConnection(hyperdrive);
  const dateWithDash = formatAccsDayWithDash(accsDay);
  const normalizedSiteCd = normalizeSiteCd(siteCd);
  const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit)));
  const candidates = buildRawRowsCandidates(
    source,
    accsDay,
    dateWithDash,
    normalizedSiteCd,
    safeLimit,
  );

  try {
    const successfulSources: string[] = [];
    const mergedRows: Array<Record<string, unknown>> = [];

    for (const candidate of candidates) {
      try {
        const [rows] = await queryWithTimeout(
          conn,
          candidate.query,
          candidate.params,
        );
        const mapped = rows as Array<Record<string, unknown>>;
        mergedRows.push(...mapped);
        successfulSources.push(candidate.source);
      } catch (err) {
        logger.debug("FAS raw rows source query failed", {
          action: "fas_raw_rows_fallback",
          source: candidate.source,
          error: { name: "QueryError", message: String(err) },
        });
      }
    }

    const trimmedRows =
      mergedRows.length > safeLimit
        ? mergedRows.slice(0, safeLimit)
        : mergedRows;

    return {
      source: finalizeRawRowsSource(successfulSources),
      rows: trimmedRows,
    };
  } finally {
    await conn.end();
  }
}

export async function fasGetDailyAttendanceRealtimeStats(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
  siteCd?: string | null,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasAttendanceRealtimeStats> {
  const conn = await getConnection(hyperdrive);
  const normalizedSiteCd = normalizeSiteCd(siteCd);
  const dateWithDash = formatAccsDayWithDash(accsDay);
  const candidates = buildRealtimeStatsCandidates(
    source,
    accsDay,
    dateWithDash,
    normalizedSiteCd,
  );

  try {
    const stats = createRealtimeStatsAccumulator();

    for (const candidate of candidates) {
      try {
        const [rows] = await queryWithTimeout(
          conn,
          candidate.query,
          candidate.params,
        );
        mergeRealtimeStatsRows(
          stats,
          rows as Array<Record<string, unknown>>,
          candidate.source,
        );
      } catch (err) {
        logger.debug("FAS realtime stats source query failed", {
          action: "fas_realtime_stats_fallback",
          source: candidate.source,
          error: { name: "QueryError", message: String(err) },
        });
      }
    }

    return finalizeRealtimeStats(stats);
  } finally {
    await conn.end();
  }
}

export async function fasGetDailyAttendanceSiteCounts(
  hyperdrive: HyperdriveBinding,
  accsDay: string,
  limit = 10,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<{ source: string; siteCounts: FasAttendanceSiteCount[] }> {
  const conn = await getConnection(hyperdrive);
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));

  try {
    const [rows] = await queryWithTimeout(
      conn,
      `SELECT ad.site_cd AS site_cd, COUNT(*) AS cnt
       FROM ${tbl(source, "access_daily")} ad
      WHERE ad.accs_day = ?
      GROUP BY ad.site_cd`,
      [accsDay],
    );

    const siteCounts = (rows as Array<Record<string, unknown>>)
      .map(mapToFasAttendanceSiteCount)
      .filter((row) => row.siteCd.length > 0)
      .sort((a, b) => b.rowCount - a.rowCount)
      .slice(0, safeLimit);

    return {
      source: "access_daily",
      siteCounts,
    };
  } finally {
    await conn.end();
  }
}

export async function fasGetAttendanceTrend(
  hyperdrive: HyperdriveBinding,
  startAccsDay: string,
  endAccsDay: string,
  siteCd?: string | null,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasAttendanceTrendPoint[]> {
  const conn = await getConnection(hyperdrive);
  const normalizedSiteCd = normalizeSiteCd(siteCd);
  const siteClause = normalizedSiteCd ? " AND ad.site_cd = ?" : "";

  const params: unknown[] = [startAccsDay, endAccsDay];
  if (normalizedSiteCd) {
    params.push(normalizedSiteCd);
  }

  try {
    const [rows] = await queryWithTimeout(
      conn,
      `SELECT ad.accs_day AS accs_day,
            COUNT(DISTINCT ad.empl_cd) AS cnt
       FROM ${tbl(source, "access_daily")} ad
      WHERE ad.accs_day BETWEEN ? AND ?
        AND ad.in_time IS NOT NULL
        AND ad.in_time != '0000'
        AND ad.in_time != ''${siteClause}
         GROUP BY ad.accs_day
         ORDER BY ad.accs_day ASC`,
      params,
    );

    return (rows as Array<Record<string, unknown>>).map(
      mapToFasAttendanceTrendPoint,
    );
  } finally {
    await conn.end();
  }
}
