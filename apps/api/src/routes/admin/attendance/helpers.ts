import { and, inArray, isNull } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import { users } from "../../../db/schema";
import {
  fasGetAttendanceList,
  fasGetDailyAttendance,
  type FasAttendance,
  type FasAttendanceListRecord,
  type FasSource,
} from "../../../lib/fas";
import type { HyperdriveBinding } from "../../../types";
import { getTodayRange } from "../helpers";

type AdminDb = ReturnType<typeof drizzle>;
const LINKED_USER_QUERY_CHUNK_SIZE = 80;

export interface LinkedUserSummary {
  id: string;
  nameMasked: string | null;
}
export interface UnmatchedSourceRecord {
  emplCd: string;
  accsDay: string;
  inTime: string | null;
  outTime: string | null;
  partCd: string;
  name: string;
  companyName: string | null;
}

function toAccsDay(source: Date): string {
  const koreaTime = new Date(
    source.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const y = koreaTime.getFullYear();
  const m = String(koreaTime.getMonth() + 1).padStart(2, "0");
  const d = String(koreaTime.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function resolveAccsDay(dateStr?: string): string | null {
  if (!dateStr) return toAccsDay(getTodayRange().start);
  if (/^\d{8}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.replace(/-/g, "");
  return null;
}

export function formatCheckinIso(
  accsDay: string,
  inTime: string | null,
): string | null {
  if (!inTime || !/^\d{8}$/.test(accsDay)) return null;
  const padded = inTime.padStart(4, "0");
  const hh = padded.slice(0, 2).padStart(2, "0");
  const mm = padded.slice(2, 4).padStart(2, "0");
  return `${accsDay.slice(0, 4)}-${accsDay.slice(4, 6)}-${accsDay.slice(6, 8)}T${hh}:${mm}:00+09:00`;
}

export function mapLogRecord(
  row: FasAttendanceListRecord,
  userMap: Map<string, LinkedUserSummary>,
  sourcePrefix: string,
) {
  const externalWorkerId = `${sourcePrefix}${row.emplCd}`;
  const linkedUser = userMap.get(externalWorkerId);
  return {
    id: `${row.emplCd}-${row.accsDay}-${row.inTime ?? ""}`,
    siteId: null,
    userId: linkedUser?.id ?? null,
    externalWorkerId,
    checkinAt: formatCheckinIso(row.accsDay, row.inTime),
    result: "SUCCESS",
    source: "FAS_REALTIME",
    createdAt: null,
    userName: linkedUser?.nameMasked ?? row.name,
    companyName: row.companyName,
    partCd: row.partCd,
    inTime: row.inTime,
    outTime: row.outTime,
    accsDay: row.accsDay,
  };
}

export function mapFallbackLogRecord(
  row: FasAttendance,
  userMap: Map<string, LinkedUserSummary>,
  sourcePrefix: string,
) {
  const externalWorkerId = `${sourcePrefix}${row.emplCd}`;
  const linkedUser = userMap.get(externalWorkerId);
  return {
    id: `${row.emplCd}-${row.accsDay}-${row.inTime ?? ""}`,
    siteId: null,
    userId: linkedUser?.id ?? null,
    externalWorkerId,
    checkinAt: formatCheckinIso(row.accsDay, row.inTime),
    result: "SUCCESS",
    source: "FAS_REALTIME",
    createdAt: null,
    userName: linkedUser?.nameMasked ?? row.emplCd,
    companyName: null,
    partCd: row.partCd,
    inTime: row.inTime,
    outTime: row.outTime,
    accsDay: row.accsDay,
  };
}

export async function fetchAttendanceListPageOrNull(
  hd: HyperdriveBinding,
  accsDay: string,
  source: FasSource,
  limit: number,
  offset: number,
) {
  try {
    return await fasGetAttendanceList(
      hd,
      accsDay,
      source.siteCd,
      limit,
      offset,
      source,
    );
  } catch {
    return null;
  }
}

export async function fetchDailyAttendanceRows(
  hd: HyperdriveBinding,
  accsDay: string,
  source: FasSource,
): Promise<FasAttendance[]> {
  return fasGetDailyAttendance(hd, accsDay, source.siteCd, source);
}

export async function loadLinkedUserMap(
  db: AdminDb,
  workerExternalIds: string[],
): Promise<Map<string, LinkedUserSummary>> {
  const linkedUsers: Array<{
    id: string;
    externalWorkerId: string | null;
    nameMasked: string | null;
  }> = [];
  for (
    let start = 0;
    start < workerExternalIds.length;
    start += LINKED_USER_QUERY_CHUNK_SIZE
  ) {
    const chunk = workerExternalIds.slice(
      start,
      start + LINKED_USER_QUERY_CHUNK_SIZE,
    );
    if (chunk.length === 0) continue;
    const chunkRows = await db
      .select({
        id: users.id,
        externalWorkerId: users.externalWorkerId,
        nameMasked: users.nameMasked,
      })
      .from(users)
      .where(
        and(inArray(users.externalWorkerId, chunk), isNull(users.deletedAt)),
      )
      .all();
    linkedUsers.push(...chunkRows);
  }

  const userMap = new Map<string, LinkedUserSummary>();
  for (const user of linkedUsers) {
    if (!user.externalWorkerId) continue;
    userMap.set(user.externalWorkerId, {
      id: String(user.id),
      nameMasked: user.nameMasked,
    });
  }
  return userMap;
}
