import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { ReviewActionSchema } from "../../validators/schemas";
import { reviews, posts, siteMemberships, pointsLedger } from "../../db/schema";
import {
  validActions,
  isValidTransition,
  determineNewStatuses,
  DEFAULT_APPROVAL_POINTS,
} from "./helpers";
import type { ReviewStatus, ActionStatus } from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const validateJson = zValidator as (
  target: "json",
  schema: unknown,
) => ReturnType<typeof zValidator>;

app.post("/", validateJson("json", ReviewActionSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json" as never) as z.infer<
    typeof ReviewActionSchema
  >;

  if (!data.postId || !data.action) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "postId and action are required",
      400,
    );
  }

  if (!validActions.includes(data.action)) {
    return error(
      c,
      "INVALID_ACTION",
      `Invalid action. Must be one of: ${validActions.join(", ")}`,
      400,
    );
  }

  const post = await db
    .select()
    .from(posts)
    .where(eq(posts.id, data.postId))
    .get();

  if (!post) {
    return error(c, "POST_NOT_FOUND", "Post not found", 404);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, post.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();

  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(
      c,
      "INSUFFICIENT_PERMISSIONS",
      "Site admin access required",
      403,
    );
  }

  const currentReviewStatus = (post.reviewStatus as ReviewStatus) || "PENDING";
  if (!isValidTransition(currentReviewStatus, data.action)) {
    return error(
      c,
      "INVALID_TRANSITION",
      `Cannot ${data.action} a post in ${currentReviewStatus} status`,
      400,
    );
  }

  const currentActionStatus = (post.actionStatus as ActionStatus) || "NONE";
  const { newReviewStatus, newActionStatus } = determineNewStatuses(
    data.action,
    currentActionStatus,
  );

  const review = await db
    .insert(reviews)
    .values({
      postId: data.postId,
      adminId: user.id,
      action: data.action,
      comment: data.comment ?? null,
    })
    .returning()
    .get();

  const postUpdateData: {
    reviewStatus: ReviewStatus;
    actionStatus?: ActionStatus;
    isUrgent?: boolean;
    updatedAt: Date;
  } = {
    reviewStatus: newReviewStatus,
    updatedAt: new Date(),
  };

  if (newActionStatus) {
    postUpdateData.actionStatus = newActionStatus;
  }

  if (data.action === "MARK_URGENT") {
    postUpdateData.isUrgent = true;
  }

  const updatedPost = await db
    .update(posts)
    .set(postUpdateData)
    .where(
      and(
        eq(posts.id, data.postId),
        eq(posts.reviewStatus, post.reviewStatus),
        eq(posts.actionStatus, post.actionStatus),
      ),
    )
    .returning()
    .get();

  if (!updatedPost) {
    return error(
      c,
      "POST_STATUS_CONFLICT",
      "Post already reviewed or status changed",
      409,
    );
  }

  const oldReviewStatus = post.reviewStatus;
  const oldActionStatus = post.actionStatus;

  await logAuditWithContext(
    c,
    db,
    "FORCED_STATUS_CHANGE",
    user.id,
    "REVIEW",
    data.postId,
    {
      postId: data.postId,
      oldStatus: oldReviewStatus,
      newStatus: newReviewStatus,
      oldActionStatus,
      newActionStatus: newActionStatus ?? oldActionStatus,
      reason: data.comment,
      action: data.action,
    },
  );

  let pointsAwarded = 0;
  if (data.action === "APPROVE") {
    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    await db.insert(pointsLedger).values({
      userId: post.userId,
      siteId: post.siteId,
      amount: DEFAULT_APPROVAL_POINTS,
      reasonCode: "POST_APPROVED",
      postId: data.postId,
      settleMonth,
      adminId: user.id,
    });

    pointsAwarded = DEFAULT_APPROVAL_POINTS;
  }

  return success(
    c,
    { review, postStatus: newReviewStatus, pointsAwarded },
    201,
  );
});

export default app;
