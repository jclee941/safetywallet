import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq } from "drizzle-orm";
import { success, error } from "../../../lib/response";
import {
  actions,
  actionImages,
  posts,
  siteMemberships,
} from "../../../db/schema";
import { compareBeforeAfterImages, getAiCredentials } from "../../../lib/ai";
import {
  arrayBufferToBase64,
  extractR2Key,
  type ActionsImageRouteApp,
} from "./helpers";

export const registerComparisonRoutes = (app: ActionsImageRouteApp): void => {
  app.post("/:id/compare-images", async (c) => {
    const { user } = c.get("auth");
    if (user.role !== "SUPER_ADMIN" && user.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "Admin access required", 403);
    }

    const db = drizzle(c.env.DB);
    const actionId = c.req.param("id");
    const aiConfig = getAiCredentials(c.env);
    if (!aiConfig) {
      return error(c, "AI_NOT_CONFIGURED", "AI service not configured", 503);
    }

    const action = await db
      .select()
      .from(actions)
      .where(eq(actions.id, actionId))
      .get();
    if (!action) {
      return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
    }

    const beforeImage = await db
      .select()
      .from(actionImages)
      .where(
        and(
          eq(actionImages.actionId, actionId),
          eq(actionImages.imageType, "BEFORE"),
        ),
      )
      .orderBy(desc(actionImages.createdAt))
      .limit(1)
      .get();
    const afterImage = await db
      .select()
      .from(actionImages)
      .where(
        and(
          eq(actionImages.actionId, actionId),
          eq(actionImages.imageType, "AFTER"),
        ),
      )
      .orderBy(desc(actionImages.createdAt))
      .limit(1)
      .get();

    if (!beforeImage || !afterImage) {
      return error(
        c,
        "MISSING_BEFORE_AFTER_IMAGES",
        "BEFORE와 AFTER 이미지가 모두 필요합니다",
        400,
      );
    }

    const beforeKey = extractR2Key(beforeImage.fileUrl);
    const afterKey = extractR2Key(afterImage.fileUrl);
    if (!beforeKey || !afterKey) {
      return error(
        c,
        "INVALID_IMAGE_KEY",
        "유효하지 않은 이미지 경로입니다",
        400,
      );
    }

    const [beforeObject, afterObject] = await Promise.all([
      c.env.R2.get(beforeKey),
      c.env.R2.get(afterKey),
    ]);
    if (!beforeObject || !afterObject) {
      return error(c, "IMAGE_FILE_NOT_FOUND", "Image file not found", 404);
    }

    const comparison = await compareBeforeAfterImages(
      aiConfig,
      arrayBufferToBase64(await beforeObject.arrayBuffer()),
      arrayBufferToBase64(await afterObject.arrayBuffer()),
      afterObject.httpMetadata?.contentType ||
        beforeObject.httpMetadata?.contentType ||
        "image/jpeg",
      action.description ?? undefined,
    );
    if (!comparison) {
      return error(
        c,
        "AI_COMPARISON_FAILED",
        "AI 비교 분석에 실패했습니다",
        500,
      );
    }

    const comparedAt = new Date().toISOString();
    await db
      .update(actions)
      .set({
        aiComparison: JSON.stringify(comparison),
        aiComparedAt: comparedAt,
      })
      .where(eq(actions.id, actionId));

    return success(c, { comparison, comparedAt });
  });

  app.get("/:id/comparison", async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const actionId = c.req.param("id");

    const action = await db
      .select()
      .from(actions)
      .where(eq(actions.id, actionId))
      .get();
    if (!action) {
      return error(c, "ACTION_NOT_FOUND", "Action not found", 404);
    }

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, action.postId))
      .get();
    if (!post) {
      return error(c, "POST_NOT_FOUND", "Associated post not found", 404);
    }

    const isAssignee = action.assigneeId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SITE_ADMIN";
    if (!isAssignee && !isAdmin) {
      const membership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, post.siteId),
            eq(siteMemberships.status, "ACTIVE"),
          ),
        )
        .get();

      if (!membership || membership.role === "WORKER") {
        return error(c, "UNAUTHORIZED", "Not authorized", 403);
      }
    }

    if (!action.aiComparison) {
      return success(c, { comparison: null, comparedAt: null });
    }

    try {
      return success(c, {
        comparison: JSON.parse(action.aiComparison),
        comparedAt: action.aiComparedAt ?? null,
      });
    } catch {
      return success(c, {
        comparison: null,
        comparedAt: action.aiComparedAt ?? null,
      });
    }
  });
};
