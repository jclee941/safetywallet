import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../../types";
import { users, auditLogs } from "../../../db/schema";
import { hmac } from "../../../lib/crypto";
import { success, error } from "../../../lib/response";
import { requireAdmin } from "../helpers";
import { createLogger } from "../../../lib/logger";

const logger = createLogger("admin/users/user-lock");

export const userLockRouter = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// GET /unlock-user/:phoneHash
userLockRouter.get("/unlock-user/:phoneHash", requireAdmin, async (c) => {
  const phoneHash = c.req.param("phoneHash");
  if (!phoneHash) {
    return error(c, "PHONE_HASH_REQUIRED", "phoneHash is required", 400);
  }

  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const key = `login_attempts:${phoneHash}`;

  await c.env.KV.delete(key);

  try {
    await db.insert(auditLogs).values({
      action: "LOGIN_LOCKOUT_RESET",
      actorId: currentUser.id,
      targetType: "LOGIN_LOCKOUT",
      targetId: phoneHash,
      reason: "Admin unlock",
    });
  } catch (error) {
    logger.error("Failed to write unlock-user audit log", error);
  }

  return success(c, { unlocked: true });
});

// POST /unlock-user-by-phone
userLockRouter.post(
  "/unlock-user-by-phone",
  requireAdmin,
  zValidator(
    "json",
    z.object({
      phone: z.string().min(10, "Invalid phone number"),
    }),
  ),
  async (c) => {
    const { phone } = c.req.valid("json");

    const normalizedPhone = phone.replace(/\D/g, "");

    const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const key = `login:lockout:${phoneHash}`;

    await c.env.KV.delete(key);

    try {
      await db.insert(auditLogs).values({
        action: "LOGIN_LOCKOUT_RESET",
        actorId: currentUser.id,
        targetType: "LOGIN_LOCKOUT",
        targetId: phoneHash,
        reason: "Admin unlock by phone",
      });
    } catch (error) {
      logger.error("Failed to write unlock-user-by-phone audit log", error);
    }

    if (c.env.RATE_LIMITER) {
      const rateLimiterId = c.env.RATE_LIMITER.idFromName(`login:${phoneHash}`);
      const rateLimiter = c.env.RATE_LIMITER.get(rateLimiterId);
      await rateLimiter.fetch(new Request("https://dummy/reset"));
    }

    return success(c, { unlocked: true, phone: normalizedPhone });
  },
);

// POST /users/:id/lock
userLockRouter.post("/users/:id/lock", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");
  if (!userId) {
    return error(c, "BAD_REQUEST", "User ID is required", 400);
  }

  const lockedUntil = new Date("2099-12-31T23:59:59Z");

  const updated = await db
    .update(users)
    .set({
      restrictedUntil: lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  try {
    await db.insert(auditLogs).values({
      action: "USER_LOCKED",
      actorId: currentUser.id,
      targetType: "USER",
      targetId: userId,
      reason: "Admin manual lock",
    });
  } catch (error) {
    logger.error("Failed to write user-lock audit log", error);
  }

  return success(c, { userId, locked: true });
});

// POST /users/:id/unlock
userLockRouter.post("/users/:id/unlock", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const userId = c.req.param("id");
  if (!userId) {
    return error(c, "BAD_REQUEST", "User ID is required", 400);
  }

  const updated = await db
    .update(users)
    .set({
      restrictedUntil: null,
      falseReportCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  try {
    await db.insert(auditLogs).values({
      action: "USER_UNLOCKED",
      actorId: currentUser.id,
      targetType: "USER",
      targetId: userId,
      reason: "Admin manual unlock",
    });
  } catch (error) {
    logger.error("Failed to write user-unlock audit log", error);
  }

  return success(c, { userId, locked: false });
});
