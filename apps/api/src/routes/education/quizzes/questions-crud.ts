import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { quizzes, quizQuestions, siteMemberships } from "../../../db/schema";
import { success, error } from "../../../lib/response";
import type {
  AppType,
  CreateQuizQuestionBody,
  UpdateQuizQuestionBody,
} from "../helpers";
import {
  CreateQuizQuestionRequestSchema,
  UpdateQuizQuestionRequestSchema,
} from "../helpers";
import {
  validateCreateQuizQuestion,
  validateUpdateQuizQuestion,
} from "../quiz-question-validators";

const app = new Hono<AppType>();
app.post(
  "/:quizId/questions",
  zValidator("json", CreateQuizQuestionRequestSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const quizId = c.req.param("quizId");
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
    const body = c.req.valid("json") as CreateQuizQuestionBody;
    if (!body.question)
      return error(c, "MISSING_FIELDS", "question is required", 400);
    const validated = validateCreateQuizQuestion(body);
    if (!validated.ok) return error(c, validated.code, validated.message, 400);
    const question = await db
      .insert(quizQuestions)
      .values({
        quizId,
        question: body.question,
        options: validated.data.options,
        correctAnswer: validated.data.correctAnswer,
        questionType: validated.data.questionType,
        imageUrl: validated.data.imageUrl,
        correctAnswerText: validated.data.correctAnswerText,
        explanation: body.explanation ?? null,
        orderIndex: body.orderIndex ?? 0,
      })
      .returning()
      .get();
    return success(
      c,
      {
        ...question,
        questionType: question.questionType ?? "SINGLE_CHOICE",
        imageUrl: question.imageUrl ?? null,
      },
      201,
    );
  },
);

app.put(
  "/:quizId/questions/:questionId",
  zValidator("json", UpdateQuizQuestionRequestSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const quizId = c.req.param("quizId");
    const questionId = c.req.param("questionId");
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
    const existingQuestion = await db
      .select()
      .from(quizQuestions)
      .where(
        and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
      )
      .get();
    if (!existingQuestion)
      return error(c, "QUESTION_NOT_FOUND", "Quiz question not found", 404);
    const body = c.req.valid("json") as UpdateQuizQuestionBody;
    const validated = validateUpdateQuizQuestion(body, existingQuestion);
    if (!validated.ok) return error(c, validated.code, validated.message, 400);
    const updated = await db
      .update(quizQuestions)
      .set({
        ...(body.question !== undefined && { question: body.question }),
        options: validated.data.options,
        correctAnswer: validated.data.correctAnswer,
        questionType: validated.data.questionType,
        imageUrl: validated.data.imageUrl,
        correctAnswerText: validated.data.correctAnswerText,
        ...(body.explanation !== undefined && {
          explanation: body.explanation,
        }),
        ...(body.orderIndex !== undefined && { orderIndex: body.orderIndex }),
      })
      .where(
        and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
      )
      .returning()
      .get();
    return success(c, {
      ...updated,
      questionType: updated.questionType ?? "SINGLE_CHOICE",
      imageUrl: updated.imageUrl ?? null,
    });
  },
);
app.delete("/:quizId/questions/:questionId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const quizId = c.req.param("quizId");
  const questionId = c.req.param("questionId");
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
  const existingQuestion = await db
    .select()
    .from(quizQuestions)
    .where(
      and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
    )
    .get();
  if (!existingQuestion)
    return error(c, "QUESTION_NOT_FOUND", "Quiz question not found", 404);
  await db
    .delete(quizQuestions)
    .where(
      and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
    );
  return success(c, { deleted: true });
});
export default app;
