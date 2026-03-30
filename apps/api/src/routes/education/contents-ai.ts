import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
  educationContents,
  siteMemberships,
  quizzes,
  quizQuestions,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import {
  analyzeEducationContent,
  generateQuizFromContent,
  getAiCredentials,
} from "../../lib/gemini-ai";
import type { AppType } from "./helpers";

export const contentsAi = new Hono<AppType>();

// Manual AI analysis trigger
contentsAi.post("/:id/analyze", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig) {
    return error(c, "AI_NOT_CONFIGURED", "AI service not configured", 503);
  }

  const content = await db
    .select()
    .from(educationContents)
    .where(eq(educationContents.id, id))
    .get();

  if (!content) {
    return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, content.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  if (content.contentType === "VIDEO") {
    return error(
      c,
      "VIDEO_NOT_SUPPORTED",
      "VIDEO 콘텐츠는 AI 분석을 지원하지 않습니다",
      400,
    );
  }

  let imageData: ArrayBuffer | undefined;
  let mimeType: string | undefined;
  let textContent: string | undefined;

  if (content.contentType === "IMAGE" && content.contentUrl) {
    const obj = await c.env.R2.get(content.contentUrl);
    if (obj) {
      imageData = await obj.arrayBuffer();
      mimeType = obj.httpMetadata?.contentType ?? "image/jpeg";
    }
  } else if (content.contentType === "DOCUMENT" && content.contentUrl) {
    const obj = await c.env.R2.get(content.contentUrl);
    if (obj) {
      imageData = await obj.arrayBuffer();
      mimeType = obj.httpMetadata?.contentType ?? "application/pdf";
    }
  } else if (content.contentType === "TEXT") {
    textContent = [content.title, content.description]
      .filter(Boolean)
      .join("\n\n");
  }

  const result = await analyzeEducationContent(
    aiConfig,
    content.contentType as "IMAGE" | "TEXT" | "DOCUMENT",
    { imageData, mimeType, textContent },
  );

  if (!result) {
    return error(c, "AI_ANALYSIS_FAILED", "AI 분석에 실패했습니다", 500);
  }

  const analyzedAt = new Date().toISOString();

  await db
    .update(educationContents)
    .set({
      aiAnalysis: JSON.stringify(result),
      aiAnalyzedAt: analyzedAt,
    })
    .where(eq(educationContents.id, id))
    .run();

  return success(c, { analysis: result, analyzedAt });
});

// Get AI analysis result
contentsAi.get("/:id/ai-analysis", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const content = await db
    .select()
    .from(educationContents)
    .where(eq(educationContents.id, id))
    .get();

  if (!content) {
    return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, content.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();
  if (!membership && user.role !== "SUPER_ADMIN") {
    return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
  }

  if (!content.aiAnalysis) {
    return success(c, { analysis: null, analyzedAt: null });
  }

  return success(c, {
    analysis: JSON.parse(content.aiAnalysis),
    analyzedAt: content.aiAnalyzedAt,
  });
});

contentsAi.post("/:id/generate-quiz", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const content = await db
    .select()
    .from(educationContents)
    .where(eq(educationContents.id, id))
    .get();

  if (!content) {
    return error(c, "NOT_FOUND", "Content not found", 404);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, content.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  if (!content.aiAnalysis) {
    return error(
      c,
      "NO_AI_ANALYSIS",
      "AI 분석이 없습니다. 먼저 AI 분석을 실행하세요.",
      400,
    );
  }

  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig) {
    return error(c, "AI_UNAVAILABLE", "AI not configured", 503);
  }

  const result = await generateQuizFromContent(aiConfig, {
    contentTitle: content.title,
    contentAnalysis: content.aiAnalysis,
  });

  if (!result) {
    return error(c, "AI_FAILED", "퀴즈 생성에 실패했습니다", 500);
  }

  const quiz = await db
    .insert(quizzes)
    .values({
      siteId: content.siteId,
      contentId: content.id,
      title: result.quizTitle,
      status: "DRAFT",
      pointsReward: 0,
      createdById: user.id,
    })
    .returning()
    .get();

  for (let i = 0; i < result.questions.length; i += 1) {
    const q = result.questions[i];
    await db.insert(quizQuestions).values({
      quizId: quiz.id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      orderIndex: i,
      questionType: q.questionType,
    });
  }

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.orderIndex)
    .all();

  return success(c, { ...quiz, questions }, 201);
});
