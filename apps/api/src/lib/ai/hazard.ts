import { createLogger } from "../logger";
import {
  AiCredentials,
  arrayBufferToBase64,
  buildImagePart,
  buildTextPart,
  callOpenRouterJson,
} from "./base";

const logger = createLogger("gemini-ai");

export const HAZARD_TYPES = [
  "fall_hazard",
  "electrical",
  "chemical",
  "fire",
  "confined_space",
  "ppe_violation",
  "structural",
  "machinery",
  "general",
  "ergonomic",
  "environmental",
  "vehicle",
  "noise",
  "biological",
] as const;
export const SEVERITY_LEVELS = ["low", "medium", "high", "critical"] as const;

export interface GeminiAnalysisResult {
  hazardType: string;
  severity: string;
  description: string;
  recommendations: string[];
  detectedObjects: string[];
  confidence: number;
  relatedRegulations: string[];
  modelVersion: string;
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
export function isValidHazardType(value: unknown): value is string {
  return (
    typeof value === "string" &&
    HAZARD_TYPES.includes(value as (typeof HAZARD_TYPES)[number])
  );
}
export function isValidSeverity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SEVERITY_LEVELS.includes(value as (typeof SEVERITY_LEVELS)[number])
  );
}
export function isValidAnalysisResultShape(
  value: unknown,
): value is Omit<GeminiAnalysisResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isValidHazardType(c.hazardType) &&
    isValidSeverity(c.severity) &&
    typeof c.description === "string" &&
    isStringArray(c.recommendations) &&
    isStringArray(c.detectedObjects) &&
    typeof c.confidence === "number" &&
    c.confidence >= 0 &&
    c.confidence <= 1 &&
    isStringArray(c.relatedRegulations)
  );
}

export const HAZARD_ANALYSIS_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    hazardType: { type: "STRING" as const, enum: [...HAZARD_TYPES] },
    severity: { type: "STRING" as const, enum: [...SEVERITY_LEVELS] },
    description: { type: "STRING" as const },
    recommendations: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    detectedObjects: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    confidence: { type: "NUMBER" as const },
    relatedRegulations: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
  },
  required: [
    "hazardType",
    "severity",
    "description",
    "recommendations",
    "detectedObjects",
    "confidence",
    "relatedRegulations",
  ],
};

export async function analyzeHazardImage(
  credentials: AiCredentials,
  imageData: ArrayBuffer,
  mimeType: string,
): Promise<GeminiAnalysisResult | null> {
  try {
    if (!mimeType || imageData.byteLength === 0) return null;
    const base64 = arrayBufferToBase64(imageData);
    const prompt = `당신은 산업안전보건 관리자입니다. 작업 현장 이미지를 분석해 위험요소를 식별하고 한국 산업안전보건법 관점에서 개선 조치를 제안하세요.

You are an occupational safety manager. Analyze the workplace image and return strict JSON only.

Requirements:
1) hazardType: choose exactly one from [fall_hazard, electrical, chemical, fire, confined_space, ppe_violation, structural, machinery, general, ergonomic, environmental, vehicle, noise, biological].
2) severity: choose one of [low, medium, high, critical].
3) description: Korean description of the hazard with context.
4) recommendations: specific Korean corrective actions.
5) detectedObjects: objects/conditions detected in the image.
6) confidence: number between 0 and 1.
7) relatedRegulations: Korean OSHA references (산업안전보건법 및 관련 시행령/고시/안전보건규칙).

Output must be valid JSON and match the schema exactly.`;

    const result = await callOpenRouterJson<
      Omit<GeminiAnalysisResult, "modelVersion">
    >(credentials, {
      content: [buildTextPart(prompt), buildImagePart(mimeType, base64)],
      responseSchema: HAZARD_ANALYSIS_RESPONSE_SCHEMA,
      multimodal: true,
    });
    if (!result || !isValidAnalysisResultShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI hazard analysis failed", {
      error: {
        name: "AiHazardAnalysisError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
