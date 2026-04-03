import { createLogger } from "../logger";
import type { HyperdriveBinding } from "../../types";
import { getConnection, queryWithTimeout } from "./connection";
import {
  formatAccsDayWithDash,
  mergeAttendanceRecord,
  sortAttendanceByInTime,
} from "./attendance-helpers";
import { mapToFasAttendance } from "./attendance-mappers";
import { mapToFasEmployee } from "./mappers";
import { employeeFrom, employeeSelect } from "./employee-queries";
import {
  DEFAULT_FAS_SOURCE,
  tbl,
  type FasAttendance,
  type FasEmployee,
  type FasSource,
} from "./types";

const logger = createLogger("fas-mariadb");

export async function fasCheckWorkerAttendance(
  hyperdrive: HyperdriveBinding,
  emplCd: string,
  accsDay: string,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<{ hasAttendance: boolean; records: FasAttendance[] }> {
  const conn = await getConnection(hyperdrive);
  const dateWithDash = formatAccsDayWithDash(accsDay);
  const byWorker = new Map<string, FasAttendance>();

  const candidates: Array<{ query: string; params: unknown[] }> = [
    {
      query: `SELECT ad.empl_cd, ad.accs_day, ad.in_time, ad.out_time,
                     ad.state, ad.part_cd
                FROM ${tbl(source, "access_daily")} ad
               WHERE ad.accs_day = ?
                 AND ad.empl_cd = ?
                 AND ad.in_time IS NOT NULL
                 AND ad.in_time != '0000'
                 AND ad.in_time != ''
                 AND ad.site_cd = ?`,
      params: [accsDay, emplCd, source.siteCd],
    },
    {
      query: `SELECT a.empl_cd,
                     DATE_FORMAT(a.accs_dt, '%Y%m%d') AS accs_day,
                     MIN(DATE_FORMAT(a.accs_dt, '%H%i')) AS in_time,
                     MAX(DATE_FORMAT(a.accs_dt, '%H%i')) AS out_time,
                     0 AS state,
                     COALESCE(MAX(a.part_cd), '') AS part_cd
                FROM ${tbl(source, "access")} a
               WHERE DATE(a.accs_dt) = ?
                 AND a.empl_cd = ?
                 AND a.site_cd = ?
            GROUP BY a.empl_cd, DATE_FORMAT(a.accs_dt, '%Y%m%d')`,
      params: [dateWithDash, emplCd, source.siteCd],
    },
    {
      query: `SELECT ah.empl_cd,
                     DATE_FORMAT(ah.accs_dt, '%Y%m%d') AS accs_day,
                     MIN(DATE_FORMAT(ah.accs_dt, '%H%i')) AS in_time,
                     MAX(DATE_FORMAT(ah.accs_dt, '%H%i')) AS out_time,
                     0 AS state,
                     COALESCE(MAX(ah.part_cd), '') AS part_cd
                FROM ${tbl(source, "access_history")} ah
               WHERE DATE(ah.accs_dt) = ?
                 AND ah.empl_cd = ?
                 AND ah.site_cd = ?
            GROUP BY ah.empl_cd, DATE_FORMAT(ah.accs_dt, '%Y%m%d')`,
      params: [dateWithDash, emplCd, source.siteCd],
    },
  ];

  try {
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
        logger.debug("FAS worker attendance source query failed", {
          action: "fas_worker_attendance_fallback",
          source: candidate.query.slice(0, 32),
          error: { name: "QueryError", message: String(err) },
        });
      }
    }

    const records = sortAttendanceByInTime([...byWorker.values()]);
    return {
      hasAttendance: records.length > 0,
      records,
    };
  } finally {
    await conn.end();
  }
}

export async function fasSearchEmployeeByPhone(
  hyperdrive: HyperdriveBinding,
  phone: string,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasEmployee | null> {
  const conn = await getConnection(hyperdrive);
  try {
    const normalizedPhone = phone.replace(/-/g, "");
    const [rows] = await queryWithTimeout(
      conn,
      `SELECT ${employeeSelect} ${employeeFrom(source)}
     WHERE e.site_cd = ? AND REPLACE(e.tel_no, '-', '') = ?
     LIMIT 1`,
      [source.siteCd, normalizedPhone],
    );
    const results = rows as Array<Record<string, unknown>>;
    if (results.length === 0) {
      return null;
    }
    return mapToFasEmployee(results[0]);
  } finally {
    await conn.end();
  }
}

export async function fasSearchEmployeeByName(
  hyperdrive: HyperdriveBinding,
  name: string,
  source: FasSource = DEFAULT_FAS_SOURCE,
): Promise<FasEmployee[]> {
  const conn = await getConnection(hyperdrive);
  try {
    const [rows] = await queryWithTimeout(
      conn,
      `SELECT ${employeeSelect} ${employeeFrom(source)}
     WHERE e.site_cd = ? AND e.empl_nm LIKE ?`,
      [source.siteCd, `%${name}%`],
    );
    return (rows as Array<Record<string, unknown>>).map(mapToFasEmployee);
  } finally {
    await conn.end();
  }
}
