import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../../types";
import {
  users,
  auditLogs,
  posts,
  postImages,
  reviews,
  pointsLedger,
  siteMemberships,
} from "../../../db/schema";
import { success, error } from "../../../lib/response";
import { logAuditWithContext } from "../../../lib/audit";
import { AdminEmergencyUserPurgeSchema } from "../../../validators/schemas";
import { requireAdmin } from "../helpers";
import { createLogger } from "../../../lib/logger";

const logger = createLogger("admin/users/user-purge");

export const userPurgeRouter = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// POST /users/:id/restriction/clear
userPurgeRouter.post(
  "/users/:id/restriction/clear",
  requireAdmin,
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const userId = c.req.param("id");
    if (!userId) {
      return error(c, "BAD_REQUEST", "User ID is required", 400);
    }

    const updated = await db
      .update(users)
      .set({
        falseReportCount: 0,
        restrictedUntil: null,
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
        action: "USER_RESTRICTION_CLEARED",
        actorId: currentUser.id,
        targetType: "USER",
        targetId: userId,
        reason: "False report restriction cleared",
      });
    } catch (error) {
      logger.error("Failed to write restriction-clear audit log", error);
    }

    return success(c, { user: updated });
  },
);

// DELETE /users/:id/emergency-purge
userPurgeRouter.delete(
  "/users/:id/emergency-purge",
  zValidator("json", AdminEmergencyUserPurgeSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const userId = c.req.param("id");
    const body: z.infer<typeof AdminEmergencyUserPurgeSchema> =
      c.req.valid("json");

    if (currentUser.role !== "SUPER_ADMIN") {
      return error(
        c,
        "FORBIDDEN",
        "Only SUPER_ADMIN can perform emergency PII purge",
        403,
      );
    }

    if (body.confirmUserId !== userId) {
      return error(
        c,
        "CONFIRMATION_FAILED",
        "Confirmation user ID mismatch",
        400,
      );
    }

    const targetUser = await db
      .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!targetUser) {
      return error(c, "USER_NOT_FOUND", "User not found", 404);
    }

    if (targetUser.deletedAt) {
      return error(c, "ALREADY_PURGED", "User PII already purged", 410);
    }

    const userPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.userId, userId))
      .all();

    let purgedImages = 0;

    if (userPosts.length > 0) {
      const postIds = userPosts.map((p) => p.id);
      for (const postId of postIds) {
        const images = await db
          .select({ fileUrl: postImages.fileUrl })
          .from(postImages)
          .where(eq(postImages.postId, postId))
          .all();

        for (const image of images) {
          try {
            await c.env.R2.delete(image.fileUrl);
            purgedImages++;
          } catch (e) {
            logger.error("Failed to delete R2 image during user purge", {
              fileUrl: image.fileUrl,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        await db.delete(postImages).where(eq(postImages.postId, postId));
        await db.delete(reviews).where(eq(reviews.postId, postId));
        await db.delete(pointsLedger).where(eq(pointsLedger.postId, postId));
      }

      await db.delete(posts).where(eq(posts.userId, userId));
    }

    const deletedMemberships = await db
      .delete(siteMemberships)
      .where(eq(siteMemberships.userId, userId))
      .returning({ id: siteMemberships.id });

    const now = new Date();
    await db
      .update(users)
      .set({
        phoneEncrypted: "",
        phoneHash: "",
        name: "[긴급삭제]",
        nameMasked: "[긴급삭제]",
        dobEncrypted: "",
        dobHash: "",
        companyName: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        otpCode: null,
        otpExpiresAt: null,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    try {
      await c.env.KV.delete(`user:${userId}`);
      await c.env.KV.delete(`session:${userId}`);
    } catch (error) {
      // non-blocking: KV cleanup is best-effort
      logger.error("Failed to clean up KV entries during user purge", error);
    }

    await logAuditWithContext(
      c,
      db,
      "EMERGENCY_PII_PURGE",
      currentUser.id,
      "USER",
      userId,
      {
        reason: body.reason,
        purgedPosts: userPosts.length,
        purgedImages,
        purgedMemberships: deletedMemberships.length,
        previousName: targetUser.name,
      },
    );

    return success(c, {
      purged: true,
      purgedPosts: userPosts.length,
      purgedImages,
      purgedMemberships: deletedMemberships.length,
    });
  },
);
