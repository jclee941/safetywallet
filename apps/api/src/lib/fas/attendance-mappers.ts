import type {
  FasAttendance,
  FasAttendanceSiteCount,
  FasAttendanceTrendPoint,
} from "./types";

export function mapToFasAttendance(
  row: Record<string, unknown>,
): FasAttendance {
  const inTime = row["in_time"];
  const outTime = row["out_time"];
  return {
    emplCd: String(row["empl_cd"] || ""),
    accsDay: String(row["accs_day"] || ""),
    inTime: inTime ? String(inTime).padStart(4, "0") : null,
    outTime: outTime ? String(outTime).padStart(4, "0") : null,
    state: Number(row["state"] || 0),
    partCd: String(row["part_cd"] || ""),
  };
}

export function mapToWorkerId(row: Record<string, unknown>): string | null {
  const workerId = String(row["empl_cd"] || "").trim();
  return workerId.length > 0 ? workerId : null;
}

export function mapToRealtimeCheckinEvent(
  row: Record<string, unknown>,
): { workerId: string; checkinKey: string } | null {
  const workerId = String(row["empl_cd"] || "").trim();
  const checkinKey = String(row["checkin_key"] || "").trim();
  if (!workerId || !checkinKey) {
    return null;
  }
  return { workerId, checkinKey };
}

export function mapToFasAttendanceSiteCount(
  row: Record<string, unknown>,
): FasAttendanceSiteCount {
  return {
    siteCd: String(row["site_cd"] || "").trim(),
    rowCount: Number(row["cnt"] || 0),
  };
}

export function mapToFasAttendanceTrendPoint(
  row: Record<string, unknown>,
): FasAttendanceTrendPoint {
  return {
    date: String(row["accs_day"] || ""),
    count: Number(row["cnt"] || 0),
  };
}
