import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq } from "drizzle-orm";
import { success, error } from "../../../lib/response";
import { createLogger } from "../../../lib/logger";
import {
  actions,
  actionImages,
  posts,
  siteMemberships,
} from "../../../db/schema";
import {
  analyzeActionImage,
  compareBeforeAfterImages,
  getAiCredentials,
} from "../../../lib/ai";
import {
  arrayBufferToBase64,
  extractR2Key,
  type ActionsImageContext,
} from "./helpers";

const logger = createLogger("image-routes");

export const uploadImageHandler = async (c: ActionsImageContext) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const actionId = c.req.param("id");
  if (!actionId) {
    return error(c, "INVALID_ACTION_ID", "Invalid action ID", 400);
  }

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

  if (action.assigneeId !== user.id) {
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

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const imageType = formData.get("imageType") as string | null;

  if (!file) {
    return error(c, "NO_FILE", "No file provided", 400);
  }
  if (imageType && imageType !== "BEFORE" && imageType !== "AFTER") {
    return error(
      c,
      "INVALID_IMAGE_TYPE",
      "imageType must be BEFORE or AFTER",
      400,
    );
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return error(c, "INVALID_FILE_TYPE", "Invalid file type", 400);
  }

  const key = `actions/${actionId}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
  await c.env.R2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const inserted = await db
    .insert(actionImages)
    .values({
      actionId,
      fileUrl: key,
      imageType: (imageType as "BEFORE" | "AFTER") ?? null,
    })
    .returning()
    .get();

  const aiConfig = getAiCredentials(c.env);
  if (aiConfig) {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const result = await analyzeActionImage(
            aiConfig,
            arrayBufferToBase64(await file.arrayBuffer()),
            file.type || "image/jpeg",
          );
          if (result) {
            await db
              .update(actionImages)
              .set({
                aiAnalysis: JSON.stringify(result),
                aiAnalyzedAt: new Date().toISOString(),
              })
              .where(eq(actionImages.id, inserted.id));
          }
        } catch (e) {
          logger.error(
            "Action image AI analysis failed:",
            e instanceof Error ? e : undefined,
          );
        }
      })(),
    );
  }

  if (aiConfig && imageType === "AFTER") {
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

    if (beforeImage) {
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const beforeKey = extractR2Key(beforeImage.fileUrl);
            const afterKey = extractR2Key(inserted.fileUrl);
            if (!beforeKey || !afterKey) {
              return;
            }

            const [beforeObject, afterObject] = await Promise.all([
              c.env.R2.get(beforeKey),
              c.env.R2.get(afterKey),
            ]);
            if (!beforeObject || !afterObject) {
              return;
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
              return;
            }

            await db
              .update(actions)
              .set({
                aiComparison: JSON.stringify(comparison),
                aiComparedAt: new Date().toISOString(),
              })
              .where(eq(actions.id, actionId));
          } catch (e) {
            logger.error(
              "Action before/after comparison auto-trigger failed:",
              e instanceof Error ? e : undefined,
            );
          }
        })(),
      );
    }
  }

  return success(c, { image: inserted }, 201);
};
