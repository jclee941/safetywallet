import type { AlertPayload } from "../dispatch";
import { formatSlackPayload } from "./slack";

export function formatDiscordPayload(
  alert: AlertPayload,
  webhookUrl: string,
): { body: Record<string, unknown>; targetUrl: string } {
  return {
    body: formatSlackPayload(alert),
    targetUrl: webhookUrl.endsWith("/slack")
      ? webhookUrl
      : `${webhookUrl}/slack`,
  };
}
