import type { FasAttendance } from "./types";
import { tbl, type FasSource } from "./types";

type QueryCandidate = {
  source: string;
  query: string;
  params: unknown[];
};

export function formatAccsDayWithDash(accsDay: string): string {
  return `${accsDay.slice(0, 4)}-${accsDay.slice(4, 6)}-${accsDay.slice(6, 8)}`;
}

export function mergeAttendanceRecord(
  byWorker: Map<string, FasAttendance>,
  row: FasAttendance,
): void {
  const key = `${row.emplCd}|${row.accsDay}`;
  const existing = byWorker.get(key);
  if (!existing) {
    byWorker.set(key, row);
    return;
  }

  const mergedInTime =
    existing.inTime && row.inTime
      ? existing.inTime <= row.inTime
        ? existing.inTime
        : row.inTime
      : (existing.inTime ?? row.inTime);

  const mergedOutTime =
    existing.outTime && row.outTime
      ? existing.outTime >= row.outTime
        ? existing.outTime
        : row.outTime
      : (existing.outTime ?? row.outTime);

  byWorker.set(key, {
    ...existing,
    inTime: mergedInTime,
    outTime: mergedOutTime,
    partCd: existing.partCd || row.partCd,
    state: existing.state || row.state,
  });
}

export function sortAttendanceByInTime(
  records: FasAttendance[],
): FasAttendance[] {
  return records.sort((a, b) => {
    const aTime = a.inTime ?? "9999";
    const bTime = b.inTime ?? "9999";
    return aTime.localeCompare(bTime);
  });
}

export function normalizeSiteCd(siteCd?: string | null): string | null {
  return siteCd === undefined || siteCd === null ? null : siteCd;
}

export function buildOptionalSiteClause(
  siteCd: string | null,
  siteColumn: string,
): string {
  return siteCd ? ` AND ${siteColumn} = ?` : "";
}

export function appendOptionalSiteParam(
  siteCd: string | null,
  params: unknown[],
): unknown[] {
  return siteCd ? [...params, siteCd] : params;
}

export function appendOptionalSiteAndLimitParams(
  siteCd: string | null,
  params: unknown[],
  limit: number,
): unknown[] {
  return siteCd ? [...params, siteCd, limit] : [...params, limit];
}

export function buildDailyAttendanceFallbackCandidates(
  source: FasSource,
  dateWithDash: string,
  siteCd: string | null,
): Array<{ query: string; params: unknown[] }> {
  return [
    {
      query: `SELECT a.empl_cd,
                     DATE_FORMAT(a.accs_dt, '%Y%m%d') AS accs_day,
                     MIN(DATE_FORMAT(a.accs_dt, '%H%i')) AS in_time,
                     MAX(DATE_FORMAT(a.accs_dt, '%H%i')) AS out_time,
                     0 AS state,
                     COALESCE(MAX(a.part_cd), '') AS part_cd
                FROM ${tbl(source, "access")} a
               WHERE DATE(a.accs_dt) = ?${buildOptionalSiteClause(siteCd, "a.site_cd")}
            GROUP BY a.empl_cd, DATE_FORMAT(a.accs_dt, '%Y%m%d')`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
    {
      query: `SELECT ah.empl_cd,
                     DATE_FORMAT(ah.accs_dt, '%Y%m%d') AS accs_day,
                     MIN(DATE_FORMAT(ah.accs_dt, '%H%i')) AS in_time,
                     MAX(DATE_FORMAT(ah.accs_dt, '%H%i')) AS out_time,
                     0 AS state,
                     COALESCE(MAX(ah.part_cd), '') AS part_cd
                FROM ${tbl(source, "access_history")} ah
               WHERE DATE(ah.accs_dt) = ?${buildOptionalSiteClause(siteCd, "ah.site_cd")}
            GROUP BY ah.empl_cd, DATE_FORMAT(ah.accs_dt, '%Y%m%d')`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
  ];
}

export function buildRawSummaryCandidates(
  source: FasSource,
  accsDay: string,
  dateWithDash: string,
  siteCd: string | null,
): QueryCandidate[] {
  return [
    {
      source: "access_daily.raw",
      query: `SELECT ad.empl_cd AS empl_cd
           FROM ${tbl(source, "access_daily")} ad
          WHERE ad.accs_day = ?${buildOptionalSiteClause(siteCd, "ad.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [accsDay]),
    },
    {
      source: "access.raw",
      query: `SELECT a.empl_cd AS empl_cd
           FROM ${tbl(source, "access")} a
          WHERE DATE(a.accs_dt) = ?${buildOptionalSiteClause(siteCd, "a.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
    {
      source: "access_history.raw",
      query: `SELECT ah.empl_cd AS empl_cd
           FROM ${tbl(source, "access_history")} ah
          WHERE DATE(ah.accs_dt) = ?${buildOptionalSiteClause(siteCd, "ah.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
  ];
}

export function buildRawRowsCandidates(
  source: FasSource,
  accsDay: string,
  dateWithDash: string,
  siteCd: string | null,
  limit: number,
): QueryCandidate[] {
  return [
    {
      source: "access_daily.raw",
      query: `SELECT *
           FROM ${tbl(source, "access_daily")} ad
          WHERE ad.accs_day = ?${buildOptionalSiteClause(siteCd, "ad.site_cd")}
          ORDER BY ad.in_time ASC
          LIMIT ?`,
      params: appendOptionalSiteAndLimitParams(siteCd, [accsDay], limit),
    },
    {
      source: "access.raw",
      query: `SELECT *
           FROM ${tbl(source, "access")} a
          WHERE DATE(a.accs_dt) = ?${buildOptionalSiteClause(siteCd, "a.site_cd")}
          ORDER BY a.accs_dt ASC
          LIMIT ?`,
      params: appendOptionalSiteAndLimitParams(siteCd, [dateWithDash], limit),
    },
    {
      source: "access_history.raw",
      query: `SELECT *
           FROM ${tbl(source, "access_history")} ah
          WHERE DATE(ah.accs_dt) = ?${buildOptionalSiteClause(siteCd, "ah.site_cd")}
          ORDER BY ah.accs_dt ASC
          LIMIT ?`,
      params: appendOptionalSiteAndLimitParams(siteCd, [dateWithDash], limit),
    },
  ];
}

export function buildRealtimeStatsCandidates(
  source: FasSource,
  accsDay: string,
  dateWithDash: string,
  siteCd: string | null,
): QueryCandidate[] {
  return [
    {
      source: "access_daily",
      query: `SELECT ad.empl_cd AS empl_cd,
                    CONCAT(ad.accs_day, LPAD(COALESCE(ad.in_time, ''), 4, '0')) AS checkin_key
           FROM ${tbl(source, "access_daily")} ad
          WHERE ad.accs_day = ?${buildOptionalSiteClause(siteCd, "ad.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [accsDay]),
    },
    {
      source: "access",
      query: `SELECT a.empl_cd AS empl_cd,
                    DATE_FORMAT(a.accs_dt, '%Y%m%d%H%i') AS checkin_key
           FROM ${tbl(source, "access")} a
          WHERE DATE(a.accs_dt) = ?${buildOptionalSiteClause(siteCd, "a.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
    {
      source: "access_history",
      query: `SELECT ah.empl_cd AS empl_cd,
                    DATE_FORMAT(ah.accs_dt, '%Y%m%d%H%i') AS checkin_key
           FROM ${tbl(source, "access_history")} ah
          WHERE DATE(ah.accs_dt) = ?${buildOptionalSiteClause(siteCd, "ah.site_cd")}`,
      params: appendOptionalSiteParam(siteCd, [dateWithDash]),
    },
  ];
}
