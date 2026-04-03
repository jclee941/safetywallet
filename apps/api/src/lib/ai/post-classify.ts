import { createLogger } from "../logger";
import {
  AiCredentials,
  OpenRouterContentPart,
  arrayBufferToBase64,
  buildImagePart,
  buildTextPart,
  callOpenRouterJson,
} from "./base";
import { isStringArray } from "./hazard";

const logger = createLogger("gemini-ai");

export const POST_CATEGORIES = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
] as const;
export const POST_RISK_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export const POST_HAZARD_SUBCATEGORIES = [
  "FALL",
  "COLLAPSE",
  "STRUCK_BY",
  "CAUGHT_IN",
  "ELECTROCUTION",
  "FIRE",
  "CHEMICAL",
  "OTHER",
] as const;

export interface PostClassificationResult {
  suggestedCategory: string;
  suggestedHazardType: string | null;
  suggestedHazardSubcategory: string | null;
  suggestedRiskLevel: string;
  classificationReason: string;
  keyFindings: string[];
  confidence: number;
  modelVersion: string;
}

export function isValidPostClassificationShape(
  value: unknown,
): value is Omit<PostClassificationResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  const category = c.suggestedCategory;
  const hazardType = c.suggestedHazardType;
  const hazardSubcategory = c.suggestedHazardSubcategory;
  if (
    typeof category !== "string" ||
    !POST_CATEGORIES.includes(category as (typeof POST_CATEGORIES)[number])
  )
    return false;
  if (category === "HAZARD") {
    if (typeof hazardType !== "string" || hazardType.length === 0) return false;
    if (
      typeof hazardSubcategory !== "string" ||
      !POST_HAZARD_SUBCATEGORIES.includes(
        hazardSubcategory as (typeof POST_HAZARD_SUBCATEGORIES)[number],
      )
    )
      return false;
  } else if (hazardType !== null) {
    return false;
  } else if (hazardSubcategory !== null && hazardSubcategory !== undefined) {
    return false;
  }
  return (
    typeof c.suggestedRiskLevel === "string" &&
    POST_RISK_LEVELS.includes(
      c.suggestedRiskLevel as (typeof POST_RISK_LEVELS)[number],
    ) &&
    typeof c.classificationReason === "string" &&
    isStringArray(c.keyFindings) &&
    typeof c.confidence === "number" &&
    c.confidence >= 0 &&
    c.confidence <= 1
  );
}

export const POST_CLASSIFICATION_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    suggestedCategory: { type: "STRING" as const, enum: [...POST_CATEGORIES] },
    suggestedHazardType: { type: "STRING" as const, nullable: true },
    suggestedHazardSubcategory: {
      type: "STRING" as const,
      enum: [...POST_HAZARD_SUBCATEGORIES],
      nullable: true,
    },
    suggestedRiskLevel: {
      type: "STRING" as const,
      enum: [...POST_RISK_LEVELS],
    },
    classificationReason: { type: "STRING" as const },
    keyFindings: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    confidence: { type: "NUMBER" as const },
  },
  required: [
    "suggestedCategory",
    "suggestedHazardType",
    "suggestedHazardSubcategory",
    "suggestedRiskLevel",
    "classificationReason",
    "keyFindings",
    "confidence",
  ],
};

export async function classifyPost(
  credentials: AiCredentials,
  content: string,
  imageData?: ArrayBuffer,
  mimeType?: string,
): Promise<PostClassificationResult | null> {
  try {
    if (!content || content.trim().length === 0) return null;
    const prompt = `당신은 건설 현장 산업안전보건 관리자입니다. 제보 텍스트(및 선택적 이미지)를 분석해 분류를 추천하세요.

You are an occupational safety manager for construction sites. Analyze the report content and optional image, and return strict JSON only.

Requirements:
1) suggestedCategory: choose exactly one from [HAZARD, UNSAFE_BEHAVIOR, INCONVENIENCE, SUGGESTION, BEST_PRACTICE].
2) suggestedHazardType: Korean/English hazard type label only when category is HAZARD, otherwise null.
3) suggestedHazardSubcategory: choose one of [FALL, COLLAPSE, STRUCK_BY, CAUGHT_IN, ELECTROCUTION, FIRE, CHEMICAL, OTHER] only when category is HAZARD, otherwise null.
4) suggestedRiskLevel: choose one of [HIGH, MEDIUM, LOW].
5) classificationReason: Korean explanation of why this category/risk was selected (1-3 sentences).
6) keyFindings: Korean bullet-style findings (2-5 items).
7) confidence: number between 0 and 1.

Output must be valid JSON and match the schema exactly.`;

    const parts: OpenRouterContentPart[] = [
      buildTextPart(`${prompt}\n\n제보 내용:\n${content}`),
    ];
    if (imageData && imageData.byteLength > 0) {
      parts.push(
        buildImagePart(
          mimeType || "image/jpeg",
          arrayBufferToBase64(imageData),
        ),
      );
    }
    const result = await callOpenRouterJson<
      Omit<PostClassificationResult, "modelVersion">
    >(credentials, {
      content: parts,
      responseSchema: POST_CLASSIFICATION_RESPONSE_SCHEMA,
      multimodal: parts.some((part) => part.type !== "text"),
    });
    if (!result || !isValidPostClassificationShape(result.parsed)) return null;
    return {
      ...result.parsed,
      suggestedHazardSubcategory:
        result.parsed.suggestedHazardSubcategory ?? null,
      modelVersion: result.modelVersion,
    };
  } catch (err) {
    logger.error("AI post classification failed", {
      error: {
        name: "AiPostClassificationError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
