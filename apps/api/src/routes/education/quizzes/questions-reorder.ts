import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { quizzes, quizQuestions, siteMemberships } from "../../../db/schema";
import { error, success } from "../../../lib/response";
import type { AppType } from "../helpers";

const app = new Hono<AppType>();
const ReorderQuizQuestionsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1),
});

app.post(
  "/:quizId/questions/reorder",
  zValidator("json", ReorderQuizQuestionsSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const quizId = c.req.param("quizId");
    const { questionIds } = c.req.valid("json");

    const quiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();
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

    const existing = await db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .all();
    const existingSet = new Set(existing.map((row) => row.id));
    if (
      existing.length !== questionIds.length ||
      questionIds.some((id) => !existingSet.has(id))
    )
      return error(
        c,
        "INVALID_QUESTION_SET",
        "questionIds must include all quiz question ids exactly once",
        400,
      );

    await Promise.all(
      questionIds.map((id, orderIndex) =>
        db
          .update(quizQuestions)
          .set({ orderIndex })
          .where(
            and(eq(quizQuestions.id, id), eq(quizQuestions.quizId, quizId)),
          ),
      ),
    );
    return success(c, { reordered: true, count: questionIds.length });
  },
);

export default app;
