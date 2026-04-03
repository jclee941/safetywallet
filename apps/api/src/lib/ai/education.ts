import { createLogger } from "../logger";
import {
  AiCredentials,
  OpenRouterContentPart,
  arrayBufferToBase64,
  buildFilePart,
  buildImagePart,
  buildTextPart,
  callOpenRouterJson,
} from "./base";
import { isStringArray } from "./hazard";

const logger = createLogger("gemini-ai");

export const EDUCATION_QUALITY_LEVELS = [
  "excellent",
  "good",
  "adequate",
  "needs_improvement",
  "poor",
] as const;
export const EDUCATION_CATEGORIES = [
  "safety_training",
  "equipment_operation",
  "emergency_response",
  "hazard_awareness",
  "ppe_usage",
  "regulatory_compliance",
  "health_wellness",
  "general_safety",
] as const;

export interface EducationAnalysisResult {
  category: string;
  qualityLevel: string;
  summary: string;
  keyLearningPoints: string[];
  safetyRelevance: string;
  relatedStatutoryTraining: string[];
  improvements: string[];
  targetAudience: string;
  confidence: number;
  modelVersion: string;
}

export function isValidEducationAnalysisShape(
  value: unknown,
): value is Omit<EducationAnalysisResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.category === "string" &&
    EDUCATION_CATEGORIES.includes(
      c.category as (typeof EDUCATION_CATEGORIES)[number],
    ) &&
    typeof c.qualityLevel === "string" &&
    EDUCATION_QUALITY_LEVELS.includes(
      c.qualityLevel as (typeof EDUCATION_QUALITY_LEVELS)[number],
    ) &&
    typeof c.summary === "string" &&
    isStringArray(c.keyLearningPoints) &&
    typeof c.safetyRelevance === "string" &&
    isStringArray(c.relatedStatutoryTraining) &&
    isStringArray(c.improvements) &&
    typeof c.targetAudience === "string" &&
    typeof c.confidence === "number" &&
    c.confidence >= 0 &&
    c.confidence <= 1
  );
}

function buildEducationPrompt(contentType: string): string {
  const base = `당신은 산업안전보건 교육 전문가입니다. 교육 콘텐츠를 분석하여 품질과 안전교육 적합성을 평가하세요.

You are an occupational safety education specialist. Analyze the education content and return strict JSON only.

Requirements:
1) category: choose exactly one from [safety_training, equipment_operation, emergency_response, hazard_awareness, ppe_usage, regulatory_compliance, health_wellness, general_safety].
2) qualityLevel: choose one of [excellent, good, adequate, needs_improvement, poor].
3) summary: Korean summary of the education content (2-3 sentences).
4) keyLearningPoints: key learning objectives in Korean (3-5 items).
5) safetyRelevance: Korean explanation of how this content relates to workplace safety.
6) relatedStatutoryTraining: related Korean statutory training requirements (산업안전보건법 관련 법정교육).
7) improvements: Korean suggestions for improving the content.
8) targetAudience: Korean description of the target audience.
9) confidence: number between 0 and 1.

Output must be valid JSON and match the schema exactly.`;
  if (contentType === "IMAGE")
    return `${base}\n\nAnalyze the attached safety education image material.`;
  if (contentType === "DOCUMENT")
    return `${base}\n\nAnalyze the attached safety education document.`;
  return `${base}\n\nAnalyze the following safety education text content.`;
}

export const EDUCATION_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    category: { type: "STRING" as const, enum: [...EDUCATION_CATEGORIES] },
    qualityLevel: {
      type: "STRING" as const,
      enum: [...EDUCATION_QUALITY_LEVELS],
    },
    summary: { type: "STRING" as const },
    keyLearningPoints: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    safetyRelevance: { type: "STRING" as const },
    relatedStatutoryTraining: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    improvements: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    targetAudience: { type: "STRING" as const },
    confidence: { type: "NUMBER" as const },
  },
  required: [
    "category",
    "qualityLevel",
    "summary",
    "keyLearningPoints",
    "safetyRelevance",
    "relatedStatutoryTraining",
    "improvements",
    "targetAudience",
    "confidence",
  ],
};

export async function analyzeEducationContent(
  credentials: AiCredentials,
  contentType: "IMAGE" | "TEXT" | "DOCUMENT",
  options: {
    imageData?: ArrayBuffer;
    mimeType?: string;
    textContent?: string;
    title?: string;
  },
): Promise<EducationAnalysisResult | null> {
  try {
    const prompt = buildEducationPrompt(contentType);
    const parts: OpenRouterContentPart[] = [];
    if (options.title)
      parts.push(buildTextPart(`교육 콘텐츠 제목: ${options.title}`));
    parts.push(buildTextPart(prompt));
    if (
      (contentType === "IMAGE" || contentType === "DOCUMENT") &&
      options.imageData &&
      options.mimeType
    ) {
      if (options.imageData.byteLength === 0) return null;
      const base64 = arrayBufferToBase64(options.imageData);
      parts.push(
        options.mimeType.startsWith("image/")
          ? buildImagePart(options.mimeType, base64)
          : buildFilePart("education-content.pdf", options.mimeType, base64),
      );
    } else if (contentType === "TEXT") {
      if (!options.textContent) return null;
      parts.push(buildTextPart(`\n\n교육 내용:\n${options.textContent}`));
    } else {
      return null;
    }
    const result = await callOpenRouterJson<
      Omit<EducationAnalysisResult, "modelVersion">
    >(credentials, {
      content: parts,
      responseSchema: EDUCATION_RESPONSE_SCHEMA,
      multimodal: parts.some((part) => part.type !== "text"),
    });
    if (!result || !isValidEducationAnalysisShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI education analysis failed", {
      error: {
        name: "AiEducationAnalysisError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
