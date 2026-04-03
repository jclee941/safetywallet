import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { attendanceMiddleware } from "../../middleware/attendance";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { createLogger } from "../../lib/logger";
import { classifyPost, getAiCredentials } from "../../lib/ai";
import { CreatePostSchema, PostFilterSchema } from "../../validators/schemas";
import {
  posts,
  postImages,
  siteMemberships,
  users,
  reviews,
} from "../../db/schema";
import { validateJson, type PostsRouteApp } from "./helpers";
import {
  extractR2Key,
  checkDuplicatePosts,
  autoAwardPostPoints,
} from "./post-helpers";

const logger = createLogger("posts");

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

        // Use helper for duplicate detection
        const duplicateResult = await checkDuplicatePosts(db, {
          siteId: data.siteId,
          content: data.content,
          hazardType: data.hazardType,
          locationFloor: data.locationFloor,
          locationZone: data.locationZone,
          imageHashes: data.imageHashes,
        });

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
          isPotentialDuplicate: duplicateResult.isPotentialDuplicate,
          duplicateOfPostId: duplicateResult.duplicateOfPostId,
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
                  imageHash: (data.imageHashes?.[idx] as string) ?? null,
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

        // Use helper for auto-awarding points
        await autoAwardPostPoints(db, user.id, data.siteId, postId);

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
};
