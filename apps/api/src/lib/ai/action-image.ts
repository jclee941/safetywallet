import { createLogger } from "../logger";
import {
  AiCredentials,
  buildImagePart,
  buildTextPart,
  callOpenRouterJson,
} from "./base";
import { ACTION_IMAGE_PROMPT, buildBeforeAfterPrompt } from "./prompts";
import {
  ACTION_IMAGE_RESPONSE_SCHEMA,
  BEFORE_AFTER_COMPARISON_RESPONSE_SCHEMA,
  isValidActionImageAnalysisShape,
  isValidBeforeAfterComparisonShape,
} from "./action-image-shared";
import type {
  ActionImageAnalysisResult,
  BeforeAfterComparisonResult,
} from "./action-image-shared";

export type {
  ActionImageAnalysisResult,
  BeforeAfterComparisonResult,
} from "./action-image-shared";
export {
  OVERALL_IMPROVEMENTS,
  SAFETY_RATINGS,
  isValidActionImageAnalysisShape,
  isValidBeforeAfterComparisonShape,
  ACTION_IMAGE_RESPONSE_SCHEMA,
  BEFORE_AFTER_COMPARISON_RESPONSE_SCHEMA,
} from "./action-image-shared";

const logger = createLogger("gemini-ai");

export async function analyzeActionImage(
  credentials: AiCredentials,
  imageData: string,
  mimeType: string,
): Promise<ActionImageAnalysisResult | null> {
  try {
    if (!mimeType || !imageData) return null;
    const result = await callOpenRouterJson<
      Omit<ActionImageAnalysisResult, "modelVersion">
    >(credentials, {
      content: [
        buildTextPart(ACTION_IMAGE_PROMPT),
        buildImagePart(mimeType, imageData),
      ],
      responseSchema: ACTION_IMAGE_RESPONSE_SCHEMA,
      multimodal: true,
    });
    if (!result || !isValidActionImageAnalysisShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI action image analysis failed", {
      error: {
        name: "AiActionImageAnalysisError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export async function compareBeforeAfterImages(
  credentials: AiCredentials,
  beforeImageData: string,
  afterImageData: string,
  mimeType: string,
  actionContext?: string,
): Promise<BeforeAfterComparisonResult | null> {
  try {
    if (!beforeImageData || !afterImageData || !mimeType) return null;
    const contextText = actionContext
      ? `\n\n조치 맥락(Action Context): ${actionContext}`
      : "";
    const result = await callOpenRouterJson<
      Omit<BeforeAfterComparisonResult, "modelVersion">
    >(credentials, {
      content: [
        buildTextPart(buildBeforeAfterPrompt(contextText)),
        buildImagePart(mimeType, beforeImageData),
        buildImagePart(mimeType, afterImageData),
      ],
      responseSchema: BEFORE_AFTER_COMPARISON_RESPONSE_SCHEMA,
      multimodal: true,
    });
    if (!result || !isValidBeforeAfterComparisonShape(result.parsed))
      return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI before/after comparison failed", {
      error: {
        name: "AiBeforeAfterComparisonError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
