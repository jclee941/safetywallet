import { createLogger } from "../logger";
import { AiCredentials, buildTextPart, callOpenRouterJson } from "./base";

const logger = createLogger("gemini-ai");

export interface AnnouncementDraftResult {
  title: string;
  content: string;
  modelVersion: string;
}

export function isValidAnnouncementDraftShape(
  value: unknown,
): value is Omit<AnnouncementDraftResult, "modelVersion"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.content === "string";
}

export const ANNOUNCEMENT_DRAFT_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    title: { type: "STRING" as const },
    content: { type: "STRING" as const },
  },
  required: ["title", "content"],
};

export async function generateAnnouncementDraft(
  credentials: AiCredentials,
  keywords: string,
): Promise<AnnouncementDraftResult | null> {
  try {
    if (!keywords) return null;
    const prompt = `당신은 산업안전보건 공지사항 작성 전문가입니다. 주어진 키워드를 바탕으로 안전 관련 공지사항 초안을 작성하세요.

키워드: ${keywords}

Requirements:
1. title: 간결하고 명확한 공지사항 제목 (한국어)
2. content: HTML 형식의 공지사항 본문 (한국어)
   - <h3> 태그로 섹션 제목
   - <p> 태그로 본문 단락
   - <ul><li> 태그로 목록
   - <strong> 태그로 강조
   - 전문적이고 공식적인 어조
   - 구체적인 안전 지침 포함
   - 관련 법규나 규정 언급 (해당되는 경우)
   - 문의처 안내 포함

공지사항은 현장 근로자가 이해하기 쉽게 작성하세요.`;

    const result = await callOpenRouterJson<
      Omit<AnnouncementDraftResult, "modelVersion">
    >(credentials, {
      content: [buildTextPart(prompt)],
      responseSchema: ANNOUNCEMENT_DRAFT_RESPONSE_SCHEMA,
    });
    if (!result || !isValidAnnouncementDraftShape(result.parsed)) return null;
    return { ...result.parsed, modelVersion: result.modelVersion };
  } catch (err) {
    logger.error("AI announcement draft generation failed", {
      error: {
        name: "AiAnnouncementDraftGenerationError",
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}
