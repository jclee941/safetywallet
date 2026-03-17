import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { attendanceMiddleware } from "../../middleware/attendance";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { createLogger } from "../../lib/logger";
import { hammingDistance, DUPLICATE_THRESHOLD } from "../../lib/phash";
import { classifyPost, getAiCredentials } from "../../lib/gemini-ai";
import { CreatePostSchema, PostFilterSchema } from "../../validators/schemas";
import {
  posts,
  postImages,
  siteMemberships,
  users,
  reviews,
  pointPolicies,
  pointsLedger,
} from "../../db/schema";
import { validateJson, type PostsRouteApp } from "./helpers";

const logger = createLogger("posts");

function extractR2Key(fileUrl: string): string {
  if (!fileUrl) {
    return "";
  }

  return fileUrl
    .replace(/^.*\/files\//, "")
    .replace(/^.*\/r2\//, "")
    .replace(/^\/?r2\//, "");
}

const postRateLimit = rateLimitMiddleware({
  maxRequests: 10,
  windowMs: 60_000,
});

export const registerCrudRoutes = (app: PostsRouteApp): void => {
  app.post(
    "/",
    postRateLimit,
    validateJson("json", CreatePostSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { user } = c.get("auth");

      const data = c.req.valid("json" as never) as z.infer<
        typeof CreatePostSchema
      >;

      if (!data.siteId || !data.content) {
        return error(
          c,
          "MISSING_FIELDS",
          "siteId and content are required",
          400,
        );
      }

      await attendanceMiddleware(c, async () => {}, data.siteId);

      data.category = data.category || "HAZARD";
      data.visibility = data.visibility || "WORKER_PUBLIC";
      data.isAnonymous = data.isAnonymous ?? false;

      try {
        const userRecord = await db
          .select({ restrictedUntil: users.restrictedUntil })
          .from(users)
          .where(eq(users.id, user.id))
          .get();

        if (
          userRecord?.restrictedUntil &&
          userRecord.restrictedUntil > new Date()
        ) {
          return error(
            c,
            "USER_RESTRICTED",
            `Posting restricted until ${userRecord.restrictedUntil.toISOString()}`,
            403,
          );
        }

        const membership = await db
          .select()
          .from(siteMemberships)
          .where(
            and(
              eq(siteMemberships.userId, user.id),
              eq(siteMemberships.siteId, data.siteId),
              eq(siteMemberships.status, "ACTIVE"),
            ),
          )
          .get();

        if (!membership) {
          return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
        }

        // Idempotency: if clientMutationId was already processed, return that post
        if (data.clientMutationId) {
          const existingPost = await db
            .select({ id: posts.id })
            .from(posts)
            .where(eq(posts.clientMutationId, data.clientMutationId))
            .get();
          if (existingPost) {
            return success(c, { id: existingPost.id, deduplicated: true });
          }
        }

        const postId = crypto.randomUUID();
        const cutoff = Math.floor(Date.now() / 1000) - 86400;

        const canCheckDuplicate = Boolean(
          data.locationFloor && data.locationZone,
        );
        const duplicateConditions = [
          sql`${posts.siteId} = ${data.siteId}`,
          sql`${posts.locationFloor} = ${data.locationFloor ?? ""}`,
          sql`${posts.locationZone} = ${data.locationZone ?? ""}`,
          sql`${posts.createdAt} >= ${cutoff}`,
        ];

        if (data.hazardType) {
          duplicateConditions.push(
            sql`${posts.hazardType} = ${data.hazardType}`,
          );
        }

        const duplicateWhereSql = sql.join(duplicateConditions, sql` and `);

        let contentSimilar = false;
        if (data.content && data.content.length >= 10) {
          const keywords = data.content
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .split(/\s+/)
            .filter((w: string) => w.length >= 2)
            .slice(0, 5);

          if (keywords.length >= 2) {
            const likeConditions = keywords.map(
              (kw: string) => sql`${posts.content} LIKE ${"%" + kw + "%"}`,
            );
            const recentSimilar = await db
              .select({ id: posts.id })
              .from(posts)
              .where(
                and(
                  eq(posts.siteId, data.siteId),
                  sql`${posts.createdAt} >= ${cutoff}`,
                  sql`(${sql.join(likeConditions, sql` OR `)})`,
                ),
              )
              .limit(1)
              .all();
            contentSimilar = recentSimilar.length > 0;
          }
        }

        let duplicateOfPostId: string | null = null;
        if (canCheckDuplicate) {
          const dupResult = await db
            .select({ id: posts.id })
            .from(posts)
            .where(duplicateWhereSql)
            .orderBy(desc(posts.createdAt))
            .limit(1)
            .get();
          if (dupResult) {
            duplicateOfPostId = dupResult.id;
          }
        }

        const isPotentialDuplicate =
          canCheckDuplicate || contentSimilar
            ? canCheckDuplicate
              ? !!duplicateOfPostId
              : true
            : false;

        let imageDuplicate = false;
        const hashes = Array.isArray(data.imageHashes) ? data.imageHashes : [];
        if (hashes.some((h: string | null) => h)) {
          const recentImages = await db
            .select({
              imageHash: postImages.imageHash,
              postId: postImages.postId,
            })
            .from(postImages)
            .innerJoin(posts, eq(posts.id, postImages.postId))
            .where(
              and(
                eq(posts.siteId, data.siteId),
                sql`${posts.createdAt} >= ${cutoff}`,
                sql`${postImages.imageHash} IS NOT NULL`,
              ),
            )
            .all();

          for (const hash of hashes) {
            if (!hash) continue;
            for (const recent of recentImages) {
              if (
                recent.imageHash &&
                hammingDistance(hash, recent.imageHash) <= DUPLICATE_THRESHOLD
              ) {
                imageDuplicate = true;
                break;
              }
            }
            if (imageDuplicate) break;
          }
        }

        const finalIsPotentialDuplicate =
          isPotentialDuplicate || imageDuplicate;

        const insertPostQuery = db.insert(posts).values({
          id: postId,
          userId: user.id,
          siteId: data.siteId,
          content: data.content,
          category: data.category,
          hazardType: data.hazardType,
          hazardSubcategory:
            data.category === "HAZARD" ? data.hazardSubcategory : null,
          riskLevel: data.riskLevel,
          visibility: data.visibility,
          locationFloor: data.locationFloor,
          locationZone: data.locationZone,
          locationDetail: data.locationDetail,
          isAnonymous: data.isAnonymous,
          metadata: data.metadata,
          isPotentialDuplicate: finalIsPotentialDuplicate,
          duplicateOfPostId,
          clientMutationId: data.clientMutationId ?? null,
        });

        const imageInsertQueries = Array.isArray(data.imageUrls)
          ? data.imageUrls
              .filter((fileUrl: string) => Boolean(fileUrl))
              .map((fileUrl: string, idx: number) =>
                db.insert(postImages).values({
                  postId,
                  fileUrl,
                  thumbnailUrl: null,
                  imageHash: hashes[idx] ?? null,
                }),
              )
          : [];

        await db.batch([insertPostQuery, ...imageInsertQueries]);

        const newPost = await db
          .select()
          .from(posts)
          .where(eq(posts.id, postId))
          .get();

        if (!newPost) {
          return error(c, "POST_CREATION_FAILED", "Failed to create post", 500);
        }

        // Auto-award points for POST_SUBMITTED
        try {
          const postPolicy = await db
            .select()
            .from(pointPolicies)
            .where(
              and(
                eq(pointPolicies.siteId, data.siteId),
                eq(pointPolicies.reasonCode, "POST_SUBMITTED"),
                eq(pointPolicies.isActive, true),
              ),
            )
            .get();

          if (postPolicy) {
            const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const settleMonth = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}`;
            await db.insert(pointsLedger).values({
              userId: user.id,
              siteId: data.siteId,
              postId,
              amount: postPolicy.defaultAmount,
              reasonCode: "POST_SUBMITTED",
              reasonText: postPolicy.name,
              settleMonth,
              occurredAt: new Date(),
            });
          }
        } catch (pointErr) {
          logger.warn("Failed to auto-award POST_SUBMITTED points", {
            error: {
              name: pointErr instanceof Error ? pointErr.name : "Unknown",
              message:
                pointErr instanceof Error ? pointErr.message : String(pointErr),
            },
          });
        }

        const aiConfig = getAiCredentials(c.env);
        if (aiConfig) {
          c.executionCtx.waitUntil(
            (async () => {
              try {
                let imageData: ArrayBuffer | undefined;
                let imageMimeType: string | undefined;
                if (
                  Array.isArray(data.imageUrls) &&
                  data.imageUrls.length > 0
                ) {
                  const firstImageUrl = data.imageUrls[0];
                  const r2Key = extractR2Key(firstImageUrl);
                  if (r2Key) {
                    const r2Object = await c.env.R2.get(r2Key);
                    if (r2Object) {
                      imageData = await r2Object.arrayBuffer();
                      imageMimeType =
                        r2Object.httpMetadata?.contentType || "image/jpeg";
                    }
                  }
                }

                const classification = await classifyPost(
                  aiConfig,
                  data.content,
                  imageData,
                  imageMimeType,
                );

                if (classification) {
                  const updateData: Record<string, unknown> = {
                    aiClassification: JSON.stringify(classification),
                    aiClassifiedAt: new Date().toISOString(),
                  };

                  if (classification.suggestedRiskLevel === "HIGH") {
                    updateData.isUrgent = true;
                  }

                  await db
                    .update(posts)
                    .set(updateData)
                    .where(eq(posts.id, postId));
                }
              } catch (err) {
                logger.warn("Auto post AI classification failed", {
                  error: {
                    name: err instanceof Error ? err.name : "Unknown",
                    message: err instanceof Error ? err.message : String(err),
                  },
                  postId,
                });
              }
            })(),
          );
        }

        return success(c, { post: newPost }, 201);
      } catch (e) {
        logger.error("Failed to create post", e);
        return error(c, "INTERNAL_ERROR", "Failed to create post", 500);
      }
    },
  );

  app.get("/", async (c) => {
    const db = drizzle(c.env.DB);

    const parsedFilter = PostFilterSchema.safeParse({
      siteId: c.req.query("siteId"),
      category: c.req.query("category"),
      hazardSubcategory: c.req.query("hazardSubcategory"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    if (!parsedFilter.success) {
      return error(c, "INVALID_QUERY", "Invalid post list query", 400);
    }

    const {
      siteId,
      category,
      hazardSubcategory,
      limit: limitParam,
      offset: offsetParam,
    } = parsedFilter.data;
    const limit = Math.min(limitParam ?? 20, 100);
    const offset = offsetParam ?? 0;

    await attendanceMiddleware(c, async () => {}, siteId);

    const query = db
      .select({
        post: posts,
        author: {
          id: users.id,
          name: users.name,
          nameMasked: users.nameMasked,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    const conditions = [];
    if (siteId) {
      conditions.push(eq(posts.siteId, siteId));
    }
    if (category) {
      conditions.push(eq(posts.category, category));
    }
    if (hazardSubcategory) {
      conditions.push(eq(posts.hazardSubcategory, hazardSubcategory));
    }

    const result =
      conditions.length > 0
        ? await query.where(and(...conditions)).all()
        : await query.all();

    const postsWithAuthor = result.map((row) => ({
      ...row.post,
      author: row.post.isAnonymous
        ? null
        : {
            id: row.author?.id,
            name: row.author?.nameMasked,
          },
    }));

    return success(c, { posts: postsWithAuthor });
  });

  app.get("/me", async (c) => {
    await attendanceMiddleware(c, async () => {});
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");

    const siteId = c.req.query("siteId");
    const reviewStatus = c.req.query("reviewStatus");
    const cursor = c.req.query("cursor");
    const limit = Math.min(Number(c.req.query("limit")) || 20, 50);

    const conditions = [eq(posts.userId, user.id)];
    if (siteId) conditions.push(eq(posts.siteId, siteId));
    if (reviewStatus)
      conditions.push(sql`${posts.reviewStatus} = ${reviewStatus}`);
    if (cursor) conditions.push(lt(posts.createdAt, new Date(Number(cursor))));

    const imageCountSq = db
      .select({
        postId: postImages.postId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(postImages)
      .groupBy(postImages.postId)
      .as("img_count");

    const results = await db
      .select({
        id: posts.id,
        category: posts.category,
        content: posts.content,
        reviewStatus: posts.reviewStatus,
        actionStatus: posts.actionStatus,
        isUrgent: posts.isUrgent,
        createdAt: posts.createdAt,
        imageCount: sql<number>`coalesce(${imageCountSq.count}, 0)`,
      })
      .from(posts)
      .leftJoin(imageCountSq, eq(posts.id, imageCountSq.postId))
      .where(and(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)
      .all();

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? String(items[items.length - 1].createdAt)
      : undefined;

    return success(c, { items, nextCursor });
  });

  app.get("/:id", async (c) => {
    await attendanceMiddleware(c, async () => {});
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const postId = c.req.param("id");

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      return error(c, "POST_NOT_FOUND", "Post not found", 404);
    }

    const [author, images, postReviews] = await Promise.all([
      db.select().from(users).where(eq(users.id, post.userId)).get(),
      db
        .select()
        .from(postImages)
        .where(eq(postImages.postId, postId))
        .orderBy(desc(postImages.createdAt))
        .all(),
      db.select().from(reviews).where(eq(reviews.postId, postId)).all(),
    ]);

    if (images.length > 0) {
      await logAuditWithContext(
        c,
        db,
        "IMAGE_DOWNLOAD",
        user.id,
        "IMAGE",
        postId,
        {
          imageIds: images.map((img) => img.id),
          postId,
        },
      );
    }

    return success(c, {
      post: {
        ...post,
        author: post.isAnonymous
          ? null
          : {
              id: author?.id,
              name: author?.nameMasked,
            },
        images,
        reviews: postReviews,
      },
    });
  });

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

  app.delete("/:id", async (c) => {
    await attendanceMiddleware(c, async () => {});
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const postId = c.req.param("id");

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .get();

    if (!post) {
      return error(c, "POST_NOT_FOUND", "Post not found", 404);
    }

    if (post.userId !== user.id && user.role !== "SITE_ADMIN") {
      return error(
        c,
        "UNAUTHORIZED",
        "Not authorized to delete this post",
        403,
      );
    }

    const images = await db
      .select()
      .from(postImages)
      .where(eq(postImages.postId, postId))
      .all();

    for (const image of images) {
      await c.env.R2.delete(image.fileUrl);
    }

    await db.delete(posts).where(eq(posts.id, postId));

    return success(c, null);
  });
};
