import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { success, error } from "../../../lib/response";
import {
  actions,
  actionImages,
  posts,
  siteMemberships,
} from "../../../db/schema";
import { analyzeActionImage, getAiCredentials } from "../../../lib/ai";
import { arrayBufferToBase64, type ActionsImageRouteApp } from "./helpers";

async function authorizeImageAccess(
  appDb: ReturnType<typeof drizzle>,
  actionId: string,
  userId: string,
  userRole: string,
): Promise<
  | { kind: "ok" }
  | {
      kind: "error";
      code: "ACTION_NOT_FOUND" | "POST_NOT_FOUND" | "UNAUTHORIZED";
      message: string;
      status: 403 | 404;
    }
> {
  const action = await appDb
    .select()
    .from(actions)
    .where(eq(actions.id, actionId))
    .get();
  if (!action) {
    return {
      kind: "error" as const,
      code: "ACTION_NOT_FOUND",
      message: "Action not found",
      status: 404,
    };
  }

  const post = await appDb
    .select()
    .from(posts)
    .where(eq(posts.id, action.postId))
    .get();
  if (!post) {
    return {
      kind: "error" as const,
      code: "POST_NOT_FOUND",
      message: "Associated post not found",
      status: 404,
    };
  }

  const membership = await appDb
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, userId),
        eq(siteMemberships.siteId, post.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (
    (!membership || membership.role === "WORKER") &&
    userRole !== "SUPER_ADMIN"
  ) {
    return {
      kind: "error" as const,
      code: "UNAUTHORIZED",
      message: "Not authorized",
      status: 403,
    };
  }

  return { kind: "ok" as const };
}

export const registerAnalysisRoutes = (app: ActionsImageRouteApp): void => {
  app.post("/:id/images/:imageId/analyze", async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const actionId = c.req.param("id");
    const imageId = c.req.param("imageId");

    const aiConfig = getAiCredentials(c.env);
    if (!aiConfig) {
      return error(c, "AI_NOT_CONFIGURED", "AI service not configured", 503);
    }

    const authResult = await authorizeImageAccess(
      db,
      actionId,
      user.id,
      user.role,
    );
    if (authResult.kind === "error") {
      return error(c, authResult.code, authResult.message, authResult.status);
    }

    const image = await db
      .select()
      .from(actionImages)
      .where(
        and(eq(actionImages.id, imageId), eq(actionImages.actionId, actionId)),
      )
      .get();
    if (!image) {
      return error(c, "IMAGE_NOT_FOUND", "Image not found", 404);
    }

    const object = await c.env.R2.get(image.fileUrl);
    if (!object) {
      return error(c, "IMAGE_FILE_NOT_FOUND", "Image file not found", 404);
    }

    const result = await analyzeActionImage(
      aiConfig,
      arrayBufferToBase64(await object.arrayBuffer()),
      object.httpMetadata?.contentType ?? "image/jpeg",
    );
    if (!result) {
      return error(c, "AI_ANALYSIS_FAILED", "AI 분석에 실패했습니다", 500);
    }

    const analyzedAt = new Date().toISOString();
    await db
      .update(actionImages)
      .set({ aiAnalysis: JSON.stringify(result), aiAnalyzedAt: analyzedAt })
      .where(eq(actionImages.id, image.id));

    return success(c, { aiAnalysis: result, aiAnalyzedAt: analyzedAt });
  });

  app.get("/:id/images/:imageId/ai-analysis", async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const actionId = c.req.param("id");
    const imageId = c.req.param("imageId");

    const authResult = await authorizeImageAccess(
      db,
      actionId,
      user.id,
      user.role,
    );
    if (authResult.kind === "error") {
      return error(c, authResult.code, authResult.message, authResult.status);
    }

    const image = await db
      .select()
      .from(actionImages)
      .where(
        and(eq(actionImages.id, imageId), eq(actionImages.actionId, actionId)),
      )
      .get();
    if (!image) {
      return error(c, "IMAGE_NOT_FOUND", "Image not found", 404);
    }

    if (!image.aiAnalysis) {
      return success(c, { aiAnalysis: null, aiAnalyzedAt: null });
    }

    try {
      return success(c, {
        aiAnalysis: JSON.parse(image.aiAnalysis),
        aiAnalyzedAt: image.aiAnalyzedAt ?? null,
      });
    } catch {
      return success(c, {
        aiAnalysis: null,
        aiAnalyzedAt: image.aiAnalyzedAt ?? null,
      });
    }
  });
};
