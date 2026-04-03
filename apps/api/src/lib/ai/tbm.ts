import { createLogger } from "../logger";
import {
  AiCredentials,
  buildTextPart,
  callAiJson,
  callOpenRouterJson,
} from "./base";
import { TBM_ANALYSIS_PROMPT, buildTbmMinutesPrompt } from "./prompts";
import {
  TbmAnalysisResult,
  TbmMeetingMinutesResult,
  TBM_MEETING_MINUTES_RESPONSE_SCHEMA,
  TBM_RESPONSE_SCHEMA,
  TBM_RISK_LEVELS,
  isValidTbmAnalysisShape,
  isValidTbmMeetingMinutesShape,
} from "./tbm-shared";

export {
  TBM_RISK_LEVELS,
  isValidTbmAnalysisShape,
  isValidTbmMeetingMinutesShape,
  TBM_RESPONSE_SCHEMA,
  TBM_MEETING_MINUTES_RESPONSE_SCHEMA,
} from "./tbm-shared";

export type { TbmAnalysisResult, TbmMeetingMinutesResult } from "./tbm-shared";

const logger = createLogger("gemini-ai");

export async function analyzeTbmRecord(
  credentials: AiCredentials,
  options: {
    topic: string;
    content?: string | null;
    weatherCondition?: string | null;
    specialNotes?: string | null;
  },
): Promise<TbmAnalysisResult | null> {
  try {
    if (!options.topic) return null;
    const textParts: string[] = [
      TBM_ANALYSIS_PROMPT,
      `\n\nTBM 주제: ${options.topic}`,
    ];
    if (options.content) textParts.push(`\nTBM 내용: ${options.content}`);
    if (options.weatherCondition)
      textParts.push(`\n날씨 상태: ${options.weatherCondition}`);
    if (options.specialNotes)
      textParts.push(`\n특이사항: ${options.specialNotes}`);
    const result = await callOpenRouterJson<
      Omit<TbmAnalysisResult, "modelVersion">
    >(credentials, {
      content: [buildTextPart(textParts.join(""))],
      responseSchema: TBM_RESPONSE_SCHEMA,
    });
    if (!result || !isValidTbmAnalysisShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI TBM analysis failed", {
      error: {
        name: "AiTbmAnalysisError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

export async function generateTbmMeetingMinutes(
  credentials: AiCredentials,
  options: {
    topic: string;
    content?: string | null;
    weatherCondition?: string | null;
    specialNotes?: string | null;
    leaderName?: string | null;
    attendeeCount?: number | null;
    date?: string | null;
  },
): Promise<TbmMeetingMinutesResult | null> {
  try {
    if (!options.topic) return null;
    const result = await callAiJson(
      credentials,
      buildTbmMinutesPrompt(options),
      TBM_MEETING_MINUTES_RESPONSE_SCHEMA,
    );
    if (!result || !isValidTbmMeetingMinutesShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI TBM meeting minutes generation failed", {
      error: {
        name: "AiTbmMeetingMinutesGenerationError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
