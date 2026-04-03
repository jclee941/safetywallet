import { createLogger } from "../logger";
import { AiCredentials, buildTextPart, callOpenRouterJson } from "./base";
import { isStringArray } from "./hazard";

const logger = createLogger("gemini-ai");

export const QUIZ_QUESTION_TYPES = ["SINGLE_CHOICE", "OX"] as const;

export interface QuizGenerationResult {
  quizTitle: string;
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    questionType: string;
  }>;
  modelVersion: string;
}

export function isValidQuizGenerationShape(
  value: unknown,
): value is Omit<QuizGenerationResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.quizTitle !== "string" || !Array.isArray(c.questions))
    return false;
  return c.questions.every((question) => {
    if (typeof question !== "object" || question === null) return false;
    const q = question as Record<string, unknown>;
    if (
      typeof q.question !== "string" ||
      !isStringArray(q.options) ||
      typeof q.correctAnswer !== "number" ||
      !Number.isInteger(q.correctAnswer) ||
      typeof q.explanation !== "string" ||
      typeof q.questionType !== "string" ||
      !QUIZ_QUESTION_TYPES.includes(
        q.questionType as (typeof QUIZ_QUESTION_TYPES)[number],
      )
    )
      return false;
    const expectedOptionCount = q.questionType === "OX" ? 2 : 4;
    return (
      q.options.length === expectedOptionCount &&
      q.correctAnswer >= 0 &&
      q.correctAnswer < q.options.length
    );
  });
}

export const QUIZ_GENERATION_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    quizTitle: { type: "STRING" as const },
    questions: {
      type: "ARRAY" as const,
      items: {
        type: "OBJECT" as const,
        properties: {
          question: { type: "STRING" as const },
          options: {
            type: "ARRAY" as const,
            items: { type: "STRING" as const },
          },
          correctAnswer: { type: "INTEGER" as const },
          explanation: { type: "STRING" as const },
          questionType: {
            type: "STRING" as const,
            enum: [...QUIZ_QUESTION_TYPES],
          },
        },
        required: [
          "question",
          "options",
          "correctAnswer",
          "explanation",
          "questionType",
        ],
      },
    },
  },
  required: ["quizTitle", "questions"],
};

export async function generateQuizFromContent(
  credentials: AiCredentials,
  options: { contentTitle: string; contentAnalysis: string },
): Promise<QuizGenerationResult | null> {
  try {
    if (!options.contentTitle || !options.contentAnalysis) return null;
    const prompt = `당신은 산업안전보건 교육 퀴즈 전문가입니다. 교육 콘텐츠 분석 결과를 바탕으로 학습 효과를 측정할 수 있는 퀴즈를 생성하세요.

Generate 5 quiz questions based on the education content analysis.
Requirements:
1) quizTitle: Korean quiz title derived from content
2) questions: array of 5 questions
   - question: Korean question text
   - options: 4 Korean answer choices (for SINGLE_CHOICE) or 2 choices ["O (맞다)", "X (틀리다)"] (for OX)
   - correctAnswer: 0-based index of correct option
   - explanation: Korean explanation of why the answer is correct
   - questionType: "SINGLE_CHOICE" or "OX"
3) Mix question types: at least 3 SINGLE_CHOICE and up to 2 OX questions

Output must be valid JSON and match the schema exactly.`;
    const result = await callOpenRouterJson<
      Omit<QuizGenerationResult, "modelVersion">
    >(credentials, {
      content: [
        buildTextPart(
          `${prompt}\n\n교육 콘텐츠 제목: ${options.contentTitle}\n\n교육 콘텐츠 분석 결과(JSON):\n${options.contentAnalysis}`,
        ),
      ],
      responseSchema: QUIZ_GENERATION_RESPONSE_SCHEMA,
    });
    if (!result || !isValidQuizGenerationShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI quiz generation failed", {
      error: {
        name: "AiQuizGenerationError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
