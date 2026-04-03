import type { Env } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import { and, lt, sql } from "drizzle-orm";
import {
  pointsLedger,
  auditLogs,
  actions,
  posts,
  votes,
  attendance,
} from "../../db/schema";
import {
  log,
  getKSTDate,
  chunkArray,
  getOrCreateSystemUser,
  deleteFromOptionalTableByAge,
} from "../helpers";

export async function cleanupOldData(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
  const oneYearCutoffDate = new Date(kstNow.getTime() - ONE_YEAR_MS);
  const cutoffDate = new Date(kstNow.getTime() - THREE_YEARS_MS);

  log.info("Running data retention cleanup", {
    cutoff: cutoffDate.toISOString(),
  });

  const systemUserId = await getOrCreateSystemUser(db);

  const deletedActions = await db
    .delete(actions)
    .where(lt(actions.createdAt, cutoffDate))
    .returning({ id: actions.id });

  const deletedPosts = await db
    .delete(posts)
    .where(lt(posts.createdAt, cutoffDate))
    .returning({ id: posts.id });

  const deletedAuditLogs = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoffDate))
    .returning({ id: auditLogs.id });

  const deletedAttendanceLogs = await db
    .delete(attendance)
    .where(lt(attendance.createdAt, cutoffDate))
    .returning({ id: attendance.id });

  const deletedVotes = await db
    .delete(votes)
    .where(lt(votes.votedAt, cutoffDate))
    .returning({ id: votes.id });

  const deletedPointsLedger = await db
    .delete(pointsLedger)
    .where(
      and(
        lt(pointsLedger.createdAt, cutoffDate),
        sql`${pointsLedger.reasonCode} != 'MONTHLY_SNAPSHOT'`,
      ),
    )
    .returning({ id: pointsLedger.id });

  const deletedNotifications = await deleteFromOptionalTableByAge(
    env,
    "notifications",
    ["created_at", "createdAt", "sent_at", "sentAt"],
    oneYearCutoffDate,
  );

  const deletedVoteResults = await deleteFromOptionalTableByAge(
    env,
    "vote_results",
    ["created_at", "createdAt", "calculated_at", "calculatedAt"],
    cutoffDate,
  );

  const deletedAttendanceLogsLegacy = await deleteFromOptionalTableByAge(
    env,
    "attendance_logs",
    ["created_at", "createdAt", "checkin_at", "checkinAt"],
    cutoffDate,
  );

  const staleImageKeys: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.R2.list({ cursor });
    for (const object of listed.objects) {
      if (object.uploaded < cutoffDate) {
        staleImageKeys.push(object.key);
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  for (const keyChunk of chunkArray(staleImageKeys, 100)) {
    if (keyChunk.length > 0) {
      await env.R2.delete(keyChunk);
    }
  }

  log.info("Deleted data retention entries", {
    actions: deletedActions.length,
    posts: deletedPosts.length,
    auditLogs: deletedAuditLogs.length,
    attendanceLogs: deletedAttendanceLogs.length,
    votes: deletedVotes.length,
    voteResults: deletedVoteResults,
    pointsLedger: deletedPointsLedger.length,
    notifications: deletedNotifications,
    attendanceLogsLegacy: deletedAttendanceLogsLegacy,
    r2Images: staleImageKeys.length,
  });

  await db.insert(auditLogs).values({
    actorId: systemUserId,
    action: "DATA_RETENTION_CLEANUP",
    targetType: "SYSTEM",
    targetId: cutoffDate.toISOString(),
    reason: JSON.stringify({
      cutoffDate: cutoffDate.toISOString(),
      deletedActions: deletedActions.length,
      deletedPosts: deletedPosts.length,
      deletedAuditLogs: deletedAuditLogs.length,
      deletedAttendanceLogs: deletedAttendanceLogs.length,
      deletedVotes: deletedVotes.length,
      deletedVoteResults,
      deletedPointsLedger: deletedPointsLedger.length,
      deletedNotifications,
      deletedAttendanceLogsLegacy,
      deletedR2Images: staleImageKeys.length,
    }),
    ip: "SYSTEM",
  });
}

export const runDataRetention = cleanupOldData;
