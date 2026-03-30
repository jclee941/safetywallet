import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { CreateQuizInputSchema } from "../../validators/schemas";
import {
  educationContents,
  quizzes,
  quizQuestions,
  siteMemberships,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import type {
  AppType,
  CreateQuizBody,
  CreateQuizQuestionBody,
  UpdateQuizQuestionBody,
} from "./helpers";
import {
  CreateQuizQuestionRequestSchema,
  UpdateQuizQuestionRequestSchema,
} from "./helpers";
import {
  validateCreateQuizQuestion,
  validateUpdateQuizQuestion,
} from "./quiz-question-validators";

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

app.post("/", zValidator("json", CreateQuizInputSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const body = c.req.valid("json") as CreateQuizBody;

  if (!body.siteId || !body.title) {
    return error(c, "MISSING_FIELDS", "siteId and title are required", 400);
  }

  if (
    body.status &&
    !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(body.status)
  ) {
    return error(c, "INVALID_STATUS", "Invalid status", 400);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, body.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  if (body.contentId) {
    const content = await db
      .select()
      .from(educationContents)
      .where(eq(educationContents.id, body.contentId))
      .get();
    if (!content || content.siteId !== body.siteId) {
      return error(
        c,
        "CONTENT_NOT_FOUND",
        "Education content not found for this site",
        404,
      );
    }
  }

  const quiz = await db
    .insert(quizzes)
    .values({
      siteId: body.siteId,
      contentId: body.contentId ?? null,
      title: body.title,
      description: body.description ?? null,
      status: body.status ?? "DRAFT",
      pointsReward: body.pointsReward ?? 0,
      timeLimitMinutes: body.timeLimitMinutes ?? null,
      createdById: user.id,
    })
    .returning()
    .get();

  await logAuditWithContext(c, db, "QUIZ_CREATED", user.id, "QUIZ", quiz.id, {
    siteId: quiz.siteId,
    title: quiz.title,
    status: quiz.status,
  });

  return success(c, quiz, 201);
});

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");
  const status = c.req.query("status");

  if (!siteId) {
    return error(c, "MISSING_SITE_ID", "siteId is required", 400);
  }

  if (status && !["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    return error(c, "INVALID_STATUS", "Invalid status", 400);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();
  if (!membership && user.role !== "SUPER_ADMIN") {
    return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
  }

  const limit = Math.min(
    Number.parseInt(c.req.query("limit") || "20", 10) || 20,
    100,
  );
  const offset = Number.parseInt(c.req.query("offset") || "0", 10) || 0;

  const whereClause = status
    ? and(
        eq(quizzes.siteId, siteId),
        eq(quizzes.status, status as "DRAFT" | "PUBLISHED" | "ARCHIVED"),
      )
    : eq(quizzes.siteId, siteId);

  const [list, countResult] = await Promise.all([
    db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        status: quizzes.status,
        passingScore: quizzes.passingScore,
        pointsReward: quizzes.pointsReward,
        createdAt: quizzes.createdAt,
        contentId: quizzes.contentId,
        siteId: quizzes.siteId,
        questionCount: sql<number>`(SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = quizzes.id)`,
        attemptCount: sql<number>`(SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = quizzes.id)`,
      })
      .from(quizzes)
      .where(whereClause)
      .orderBy(desc(quizzes.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(quizzes)
      .where(whereClause)
      .get(),
  ]);

  return success(c, {
    quizzes: list,
    total: countResult?.count ?? 0,
    limit,
    offset,
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, id)).get();

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

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(quizQuestions.orderIndex)
    .all();

  const mappedQuestions = questions.map((question) => ({
    ...question,
    questionType: question.questionType ?? "SINGLE_CHOICE",
    imageUrl: question.imageUrl ?? null,
  }));

  return success(c, { ...quiz, questions: mappedQuestions });
});

app.patch("/:id", zValidator("json", UpdateQuizMetadataSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, id)).get();

  if (!quiz) {
    return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
  }

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
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  if (body.contentId !== undefined) {
    const content = await db
      .select()
      .from(educationContents)
      .where(eq(educationContents.id, body.contentId))
      .get();
    if (!content || content.siteId !== quiz.siteId) {
      return error(
        c,
        "CONTENT_NOT_FOUND",
        "Education content not found for this site",
        404,
      );
    }
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

  if (!updated) {
    return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
  }

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

  if (!quiz) {
    return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
  }

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
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

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

    if (!quiz) {
      return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

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
    if (!adminMembership && user.role !== "SUPER_ADMIN") {
      return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
    }

    const body = c.req.valid("json") as CreateQuizQuestionBody;

    if (!body.question) {
      return error(c, "MISSING_FIELDS", "question is required", 400);
    }

    const validated = validateCreateQuizQuestion(body);
    if (!validated.ok) {
      return error(c, validated.code, validated.message, 400);
    }

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

    if (!quiz) {
      return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
    }

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
    if (!adminMembership && user.role !== "SUPER_ADMIN") {
      return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
    }

    const existingQuestion = await db
      .select()
      .from(quizQuestions)
      .where(
        and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
      )
      .get();

    if (!existingQuestion) {
      return error(c, "QUESTION_NOT_FOUND", "Quiz question not found", 404);
    }

    const body = c.req.valid("json") as UpdateQuizQuestionBody;

    const validated = validateUpdateQuizQuestion(body, existingQuestion);
    if (!validated.ok) {
      return error(c, validated.code, validated.message, 400);
    }

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

  if (!quiz) {
    return error(c, "QUIZ_NOT_FOUND", "Quiz not found", 404);
  }

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
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  const existingQuestion = await db
    .select()
    .from(quizQuestions)
    .where(
      and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
    )
    .get();

  if (!existingQuestion) {
    return error(c, "QUESTION_NOT_FOUND", "Quiz question not found", 404);
  }

  await db
    .delete(quizQuestions)
    .where(
      and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, quizId)),
    );

  return success(c, { deleted: true });
});

export default app;
