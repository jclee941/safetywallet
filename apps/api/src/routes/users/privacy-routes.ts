import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  users,
  siteMemberships,
  sites,
  pointsLedger,
  posts,
} from "../../db/schema";
import { logAuditWithContext } from "../../lib/audit";
import { success, error } from "../../lib/response";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.post("/me/deletion-request", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const existing = await db
    .select({ deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (existing?.deletionRequestedAt) {
    return error(
      c,
      "DELETION_ALREADY_REQUESTED",
      "삭제 요청이 이미 접수되었습니다",
      409,
    );
  }

  const now = new Date();
  await db
    .update(users)
    .set({ deletionRequestedAt: now })
    .where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DELETION_REQUEST",
      user.id,
      "USER",
      user.id,
      {},
    );
  } catch {
    // audit failure should not block
  }

  return success(c, {
    message: "삭제 요청이 접수되었습니다. 30일 후 데이터가 영구 삭제됩니다.",
    deletionRequestedAt: now.toISOString(),
  });
});

app.delete("/me/deletion-request", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const existing = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .get();

  if (!existing?.deletionRequestedAt) {
    return error(c, "NO_DELETION_REQUEST", "삭제 요청이 없습니다", 404);
  }

  if (existing.deletedAt) {
    return error(c, "ALREADY_DELETED", "이미 삭제된 계정입니다", 410);
  }

  await db
    .update(users)
    .set({ deletionRequestedAt: null })
    .where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DELETION_CANCEL",
      user.id,
      "USER",
      user.id,
      {},
    );
  } catch {
    // audit failure should not block
  }

  return success(c, { message: "삭제 요청이 취소되었습니다." });
});

app.get("/me/data-export", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const [profile, userPosts, userPoints, userMemberships] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .get(),
    db
      .select({
        id: posts.id,
        category: posts.category,
        content: posts.content,
        reviewStatus: posts.reviewStatus,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.userId, user.id))
      .all(),
    db
      .select({
        id: pointsLedger.id,
        amount: pointsLedger.amount,
        reasonCode: pointsLedger.reasonCode,
        reasonText: pointsLedger.reasonText,
        createdAt: pointsLedger.createdAt,
      })
      .from(pointsLedger)
      .where(eq(pointsLedger.userId, user.id))
      .all(),
    db
      .select({
        siteId: siteMemberships.siteId,
        role: siteMemberships.role,
        status: siteMemberships.status,
        joinedAt: siteMemberships.joinedAt,
      })
      .from(siteMemberships)
      .where(eq(siteMemberships.userId, user.id))
      .all(),
  ]);

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_DATA_EXPORT",
      user.id,
      "USER",
      user.id,
      {
        exportedTables: ["users", "posts", "pointsLedger", "siteMemberships"],
      },
    );
  } catch {
    // audit failure should not block
  }

  return success(c, {
    exportedAt: new Date().toISOString(),
    profile,
    posts: userPosts,
    points: userPoints,
    memberships: userMemberships,
  });
});

export default app;
