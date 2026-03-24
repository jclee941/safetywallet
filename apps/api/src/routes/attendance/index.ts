import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import type { Env, AuthContext } from "../../types";
import { AttendanceSyncBodySchema } from "../../validators/fas-sync";

// KV-based idempotency cache (CF Workers isolates don't share memory,
// so in-memory Map is useless — each request runs in a fresh isolate)
export const IDEMPOTENCY_TTL = 3600; // 1 hour in seconds
export const IN_QUERY_CHUNK_SIZE = 50;

export interface SiteAttendanceRecord {
  userId: string | null;
  userName: string;
  checkIn: string | null;
  checkOut: string | null;
  externalWorkerId: string;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function toAccsDay(source: Date): string {
  const koreaTime = new Date(
    source.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, "0");
  const day = String(koreaTime.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatAccsDayTime(
  accsDay: string,
  time: string | null,
): string | null {
  if (!time || !/^\d{8}$/.test(accsDay)) {
    return null;
  }
  const padded = time.padStart(4, "0");
  const hh = padded.slice(0, 2).padStart(2, "0");
  const mm = padded.slice(2, 4).padStart(2, "0");
  return `${accsDay.slice(0, 4)}-${accsDay.slice(4, 6)}-${accsDay.slice(6, 8)}T${hh}:${mm}:00+09:00`;
}

const attendanceRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// Import and mount routes
import {
  handleSync,
  handleToday,
  handleSiteReport,
  handleRealtime,
} from "./routes";

// POST /sync - Sync attendance events from FAS
attendanceRoute.post(
  "/sync",
  authMiddleware,
  zValidator("json", AttendanceSyncBodySchema),
  handleSync,
);

// GET /today - Get today's attendance for current user
attendanceRoute.get("/today", authMiddleware, handleToday);

// GET /site/:siteId/report - Get attendance report for a site (last 7 days)
attendanceRoute.get("/site/:siteId/report", authMiddleware, handleSiteReport);

// GET /realtime - Get real-time attendance stats from FAS
attendanceRoute.get("/realtime", authMiddleware, handleRealtime);

export default attendanceRoute;
export { handleSync, handleToday, handleSiteReport, handleRealtime };
