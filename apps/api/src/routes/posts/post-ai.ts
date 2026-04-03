import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { PostsRouteApp } from "./helpers";
import { success, error } from "../../lib/response";
import { classifyPost, getAiCredentials } from "../../lib/ai";
import { postImages, posts } from "../../db/schema";
import { extractR2Key } from "./post-helpers";

export const registerAiRoutes = (app: PostsRouteApp): void => {
  app.post("/:id/ai-classify", async (c) => {
    const { user } = c.get("auth");
    if (user.role !== "SUPER_ADMIN" && user.role !== "SITE_ADMIN") {
      return error(c, "FORBIDDEN", "Admin access required", 403);
    }

    const db = drizzle(c.env.DB);
    const postId = c.req.param("id");
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();
    if (!post) {
      return error(c, "NOT_FOUND", "Post not found", 404);
    }

    const aiConfig = getAiCredentials(c.env);
    if (!aiConfig) {
      return error(c, "AI_NOT_CONFIGURED", "AI service not configured", 503);
    }

    let imageData: ArrayBuffer | undefined;
    let imageMimeType: string | undefined;
    const images = await db
      .select()
      .from(postImages)
      .where(eq(postImages.postId, postId))
      .all();
    if (images.length > 0) {
      const r2Key = extractR2Key(images[0].fileUrl);
      if (r2Key) {
        const r2Object = await c.env.R2.get(r2Key);
        if (r2Object) {
          imageData = await r2Object.arrayBuffer();
          imageMimeType = r2Object.httpMetadata?.contentType || "image/jpeg";
        }
      }
    }

    const classification = await classifyPost(
      aiConfig,
      post.content,
      imageData,
      imageMimeType,
    );
    if (!classification) {
      return error(c, "AI_FAILED", "AI classification failed", 500);
    }

    await db
      .update(posts)
      .set({
        aiClassification: JSON.stringify(classification),
        aiClassifiedAt: new Date().toISOString(),
        ...(classification.suggestedRiskLevel === "HIGH"
          ? { isUrgent: true }
          : {}),
      })
      .where(eq(posts.id, postId));

    return success(c, { classification });
  });
};
