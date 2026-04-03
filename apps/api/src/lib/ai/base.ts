import { createLogger } from "../logger";
const logger = createLogger("gemini-ai");
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TEXT_MODEL = "openrouter/free";
const DEFAULT_MULTIMODAL_MODEL = "openrouter/free";

export interface OpenRouterTextPart {
  type: "text";
  text: string;
}
export interface OpenRouterImagePart {
  type: "image_url";
  image_url: { url: string };
}
export interface OpenRouterFilePart {
  type: "file";
  file: { filename: string; file_data: string };
}
export type OpenRouterContentPart =
  | OpenRouterTextPart
  | OpenRouterImagePart
  | OpenRouterFilePart;
interface OpenRouterApiResponse {
  model?: string;
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
  }>;
}
export interface AiCredentials {
  apiKey: string;
  textModel?: string;
  multimodalModel?: string;
  siteUrl?: string;
  appName?: string;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}
export function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}
export function buildTextPart(text: string): OpenRouterTextPart {
  return { type: "text", text };
}
export function buildImagePart(
  mimeType: string,
  base64: string,
): OpenRouterImagePart {
  return { type: "image_url", image_url: { url: toDataUrl(mimeType, base64) } };
}
export function buildFilePart(
  filename: string,
  mimeType: string,
  base64: string,
): OpenRouterFilePart {
  return {
    type: "file",
    file: { filename, file_data: toDataUrl(mimeType, base64) },
  };
}
export function extractTextContent(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part) => (typeof part?.text === "string" ? part.text : null))
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}
export function normalizeJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart)
    return trimmed.slice(objectStart, objectEnd + 1);
  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart)
    return trimmed.slice(arrayStart, arrayEnd + 1);
  return trimmed;
}
export function injectSchemaReference(
  content: OpenRouterContentPart[],
  responseSchema: Record<string, unknown>,
): OpenRouterContentPart[] {
  const schemaText = `\n\nJSON schema reference:\n${JSON.stringify(responseSchema)}`;
  const firstTextIndex = content.findIndex((part) => part.type === "text");
  if (firstTextIndex === -1)
    return [
      buildTextPart(
        `Return valid JSON matching this schema exactly.\n${JSON.stringify(responseSchema)}`,
      ),
      ...content,
    ];
  return content.map((part, index) =>
    index === firstTextIndex && part.type === "text"
      ? { ...part, text: `${part.text}${schemaText}` }
      : part,
  );
}
export function getAiCredentials(env: {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL_TEXT?: string;
  OPENROUTER_MODEL_MULTIMODAL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_APP_NAME?: string;
}): AiCredentials | null {
  if (!env.OPENROUTER_API_KEY) return null;
  return {
    apiKey: env.OPENROUTER_API_KEY,
    textModel: env.OPENROUTER_MODEL_TEXT,
    multimodalModel: env.OPENROUTER_MODEL_MULTIMODAL,
    siteUrl: env.OPENROUTER_SITE_URL,
    appName: env.OPENROUTER_APP_NAME,
  };
}

export async function callOpenRouterJson<T>(
  credentials: AiCredentials,
  options: {
    content: OpenRouterContentPart[];
    responseSchema: Record<string, unknown>;
    multimodal?: boolean;
  },
): Promise<{ parsed: T; modelVersion: string } | null> {
  const content = injectSchemaReference(
    options.content,
    options.responseSchema,
  );
  const usesFiles = content.some((part) => part.type === "file");
  const needsMultimodal =
    options.multimodal || content.some((part) => part.type !== "text");
  const requestedModel = needsMultimodal
    ? (credentials.multimodalModel ?? DEFAULT_MULTIMODAL_MODEL)
    : (credentials.textModel ?? DEFAULT_TEXT_MODEL);
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
      ...(credentials.siteUrl ? { "HTTP-Referer": credentials.siteUrl } : {}),
      ...(credentials.appName
        ? { "X-OpenRouter-Title": credentials.appName }
        : {}),
    },
    body: JSON.stringify({
      model: requestedModel,
      messages: [{ role: "user", content }],
      ...(usesFiles
        ? { plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }] }
        : {}),
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    logger.error("OpenRouter AI call failed", {
      error: {
        name: "OpenRouterApiError",
        message: `OpenRouter API returned status ${response.status}: ${details}`,
      },
    });
    return null;
  }
  const payload = (await response.json()) as OpenRouterApiResponse;
  const text = extractTextContent(payload.choices?.[0]?.message?.content);
  if (!text) return null;
  return {
    parsed: JSON.parse(normalizeJsonText(text)) as T,
    modelVersion:
      typeof payload.model === "string" ? payload.model : requestedModel,
  };
}
export async function callAiJson(
  credentials: AiCredentials,
  prompt: string,
  responseSchema: Record<string, unknown>,
): Promise<{ parsed: unknown; modelVersion: string } | null> {
  return callOpenRouterJson<unknown>(credentials, {
    content: [buildTextPart(prompt)],
    responseSchema,
  });
}
