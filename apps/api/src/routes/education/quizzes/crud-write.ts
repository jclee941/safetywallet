import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  educationContents,
  quizzes,
  quizQuestions,
  siteMemberships,
} from "../../../db/schema";
import { error, success } from "../../../lib/response";
import { logAuditWithContext } from "../../../lib/audit";
import type { AppType } from "../helpers";

const app = new Hono<AppType>();
const UpdateQuizMetadataSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    pointsReward: z.number().int().optional(),
    timeLimitMinutes: z.number().int().optional(),
    contentId: z.string().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

app.patch("/:id", zValidator("json", UpdateQuizMetadataSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, id)).get();
  if (!quiz) return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, quiz.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  if (!adminMembership && user.role !== "SUPER_ADMIN")
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);

  if (body.contentId !== undefined) {
    const content = await db
      .select()
      .from(educationContents)
      .where(eq(educationContents.id, body.contentId))
      .get();
    if (!content || content.siteId !== quiz.siteId)
      return error(
        c,
        "CONTENT_NOT_FOUND",
        "Education content not found for this site",
        404,
      );
  }

  const changedFields = Object.keys(body);
  const updated = await db
    .update(quizzes)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.pointsReward !== undefined && {
        pointsReward: body.pointsReward,
      }),
      ...(body.timeLimitMinutes !== undefined && {
        timeLimitMinutes: body.timeLimitMinutes,
      }),
      ...(body.contentId !== undefined && { contentId: body.contentId }),
      updatedAt: new Date(new Date().toISOString()),
    })
    .where(and(eq(quizzes.id, id), eq(quizzes.siteId, quiz.siteId)))
    .returning()
    .get();
  if (!updated) return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);

  await logAuditWithContext(c, db, "QUIZ_UPDATED", user.id, "QUIZ", id, {
    action: "UPDATED",
    siteId: quiz.siteId,
    changedFields,
  });
  return success(c, updated);
});

app.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, id)).get();
  if (!quiz) return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, quiz.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  if (!adminMembership && user.role !== "SUPER_ADMIN")
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);

  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, id));
  await db
    .delete(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.siteId, quiz.siteId)));
  await logAuditWithContext(c, db, "QUIZ_DELETED", user.id, "QUIZ", id, {
    action: "DELETED",
    siteId: quiz.siteId,
    title: quiz.title,
  });
  return success(c, { deleted: true });
});

export default app;
