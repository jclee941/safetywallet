import type { Env } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import { eq, sql, and, lt } from "drizzle-orm";
import {
  users,
  siteMemberships,
  auditLogs,
  actions,
  posts,
  attendance,
} from "../../db/schema";
import { dbBatchChunked } from "../../db/helpers";
import { log, getOrCreateSystemUser } from "../helpers";

export async function finalizeVoteResults(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const systemUserId = await getOrCreateSystemUser(db);
  const now = new Date();

  const overdueActions = await db
    .select({ id: actions.id, postId: actions.postId })
    .from(actions)
    .where(
      and(
        sql`${actions.actionStatus} IN ('ASSIGNED', 'IN_PROGRESS')`,
        lt(actions.dueDate, now),
      ),
    );

  if (overdueActions.length === 0) return;

  const ops: Promise<unknown>[] = [];

  for (const action of overdueActions) {
    ops.push(
      db
        .update(actions)
        .set({ actionStatus: "OVERDUE" })
        .where(eq(actions.id, action.id)),
    );

    if (action.postId) {
      ops.push(
        db
          .update(posts)
          .set({ actionStatus: "OVERDUE", updatedAt: now })
          .where(eq(posts.id, action.postId)),
      );

      ops.push(
        db.insert(auditLogs).values({
          actorId: systemUserId,
          action: "ACTION_STATUS_CHANGE",
          targetType: "ACTION",
          targetId: action.id,
          reason: JSON.stringify({
            from: "IN_PROGRESS",
            to: "OVERDUE",
            cause: "automated_overdue_check",
          }),
          createdAt: now,
        }),
      );
    }
  }

  await dbBatchChunked(db, ops);

  log.info("Overdue action check complete", { count: overdueActions.length });
}

export async function runPiiLifecycleCleanup(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const usersToHardDelete = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        sql`${users.deletionRequestedAt} IS NOT NULL`,
        lt(users.deletionRequestedAt, thirtyDaysAgo),
        sql`${users.deletedAt} IS NULL`,
      ),
    );

  if (usersToHardDelete.length === 0) return;

  const ops = usersToHardDelete.map((user) =>
    db
      .update(users)
      .set({
        phoneEncrypted: "",
        phoneHash: "",
        name: "[삭제됨]",
        nameMasked: "[삭제됨]",
        dobEncrypted: "",
        dobHash: "",
        companyName: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id)),
  );

  try {
    await dbBatchChunked(db, ops);
  } catch (err) {
    log.error("PII lifecycle cleanup batch failed", {
      userCount: usersToHardDelete.length,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const deletedUserIds = usersToHardDelete.map((user) => user.id);

  const postOps = deletedUserIds.map((userId) =>
    db
      .update(posts)
      .set({
        isAnonymous: true,
        updatedAt: now,
      })
      .where(eq(posts.userId, userId)),
  );

  const membershipOps = deletedUserIds.map((userId) =>
    db
      .update(siteMemberships)
      .set({
        status: "REMOVED",
        leftAt: now,
        leftReason: "USER_DELETED",
      })
      .where(eq(siteMemberships.userId, userId)),
  );

  const attendanceOps = deletedUserIds.map((userId) =>
    db
      .update(attendance)
      .set({ userId: null })
      .where(eq(attendance.userId, userId)),
  );

  const cascadeOps = [...postOps, ...membershipOps, ...attendanceOps];
  if (cascadeOps.length > 0) {
    await dbBatchChunked(db, cascadeOps);
  }

  log.info("PII lifecycle cleanup", {
    usersHardDeleted: usersToHardDelete.length,
  });
}

export const runOverdueActionCheck = finalizeVoteResults;
