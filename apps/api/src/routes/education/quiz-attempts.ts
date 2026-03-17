import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import {
  quizzes,
  quizQuestions,
  quizAttempts,
  pointPolicies,
  siteMemberships,
  pointsLedger,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import type { AppType, SubmitQuizAttemptBody } from "./helpers";
import { SubmitQuizAttemptRequestSchema, isQuizAnswerCorrect } from "./helpers";

const app = new Hono<AppType>();

app.post(
  "/:quizId/attempt",
  zValidator("json", SubmitQuizAttemptRequestSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const quizId = c.req.param("quizId");

    const quiz = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

    if (quiz.status !== "PUBLISHED") {
      return error(c, "QUIZ_NOT_PUBLISHED", "Quiz is not published", 400);
    }

    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, quiz.siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership && user.role !== "SUPER_ADMIN") {
      return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
    }

    const body = c.req.valid("json") as SubmitQuizAttemptBody;

    const answersByIndex = Array.isArray(body.answers) ? body.answers : null;
    const answersByQuestionId =
      !Array.isArray(body.answers) && body.answers ? body.answers : null;

    if (!answersByIndex && !answersByQuestionId) {
      return error(c, "INVALID_ANSWERS", "answers are required", 400);
    }

    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex)
      .all();

    if (questions.length === 0) {
      return error(c, "NO_QUESTIONS", "Quiz has no questions", 400);
    }

    const normalizedAnswers: Array<number | number[] | string> = questions.map(
      (question, index) => {
        if (answersByIndex) {
          return answersByIndex[index] ?? "";
        }
        return answersByQuestionId?.[question.id] ?? "";
      },
    );

    let correctCount = 0;
    for (let i = 0; i < questions.length; i += 1) {
      const submittedAnswer = normalizedAnswers[i];
      if (isQuizAnswerCorrect(questions[i], submittedAnswer)) {
        correctCount += 1;
      }
    }

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = true;

    const existingAttempt = await db
      .select({ id: quizAttempts.id, passed: quizAttempts.passed })
      .from(quizAttempts)
      .where(
        and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, user.id)),
      )
      .get();

    if (existingAttempt) {
      // Idempotent replay: if clientAttemptId was provided, treat as duplicate submission
      if (body.clientAttemptId) {
        return success(c, {
          attemptId: existingAttempt.id,
          passed: existingAttempt.passed,
          deduplicated: true,
        });
      }
      if (existingAttempt.passed) {
        return error(c, "ALREADY_COMPLETED", "Course already completed", 409);
      }

      return error(c, "ALREADY_SUBMITTED", "Quiz already submitted", 409);
    }

    const quizPassPolicy = await db
      .select({ defaultAmount: pointPolicies.defaultAmount })
      .from(pointPolicies)
      .where(
        and(
          eq(pointPolicies.siteId, quiz.siteId),
          eq(pointPolicies.reasonCode, "QUIZ_PASS"),
          eq(pointPolicies.isActive, true),
        ),
      )
      .get();

    const rewardAmount = quizPassPolicy?.defaultAmount ?? quiz.pointsReward;

    let pointsAwarded = 0;
    if (passed && rewardAmount > 0) {
      pointsAwarded = rewardAmount;

      await db.insert(pointsLedger).values({
        userId: user.id,
        siteId: quiz.siteId,
        amount: rewardAmount,
        reasonCode: "QUIZ_PASS",
        reasonText: `Quiz passed: ${quiz.title}`,
        settleMonth: new Date().toISOString().slice(0, 7),
        occurredAt: new Date(),
        adminId: quiz.createdById,
      });

      await logAuditWithContext(
        c,
        db,
        "QUIZ_POINTS_AWARDED",
        user.id,
        "QUIZ",
        quiz.id,
        {
          score,
          passingScore: quiz.passingScore,
          pointsAwarded,
        },
      );
    }

    const attempt = await db
      .insert(quizAttempts)
      .values({
        quizId,
        userId: user.id,
        siteId: quiz.siteId,
        answers: normalizedAnswers,
        score,
        passed,
        pointsAwarded,
        completedAt: new Date(),
      })
      .returning()
      .get();

    return success(
      c,
      {
        ...attempt,
        totalQuestions: questions.length,
        correctCount,
      },
      201,
    );
  },
);

app.get("/:quizId/my-attempts", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const quizId = c.req.param("quizId");

  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .get();

  if (!quiz) {
    return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, quiz.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership && user.role !== "SUPER_ADMIN") {
    return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
  }

  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, user.id)),
    )
    .orderBy(desc(quizAttempts.completedAt))
    .all();

  return success(c, { attempts });
});

export default app;
