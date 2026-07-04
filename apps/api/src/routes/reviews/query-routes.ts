import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { success, error } from "../../lib/response";
import { reviews, posts, siteMemberships, users } from "../../db/schema";
import { QueryIdSchema } from "../../validators/query";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/post/:postId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const postId = c.req.param("postId");

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

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

  if (!membership) {
    return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
  }

  const reviewsList = await db
    .select({
      review: reviews,
      admin: { id: users.id, nameMasked: users.nameMasked },
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.adminId, users.id))
    .where(eq(reviews.postId, postId))
    .orderBy(desc(reviews.createdAt))
    .all();

  const formattedReviews = reviewsList.map((row) => ({
    ...row.review,
    admin: row.admin,
  }));

  return success(c, formattedReviews);
});

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);

  const querySchema = z.object({
    siteId: QueryIdSchema,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return error(c, "INVALID_QUERY_PARAMS", parsed.error.message);
  }
  const { siteId, limit, offset } = parsed.data;

  const records = await db
    .select({
      id: reviews.id,
      postId: reviews.postId,
      action: reviews.action,
      comment: reviews.comment,
      adminId: reviews.adminId,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(posts, eq(reviews.postId, posts.id))
    .where(eq(posts.siteId, siteId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  return success(c, { reviews: records, limit, offset });
});

export default app;
