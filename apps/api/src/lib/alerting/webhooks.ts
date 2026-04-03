import { createLogger } from "../logger";
import type { AlertPayload } from "./dispatch";
import { formatDiscordPayload, formatSlackPayload } from "./formatters";

const log = createLogger("alerting");

function formatGenericPayload(alert: AlertPayload): Record<string, unknown> {
  return { ...alert, service: "safetywallet" };
}

function detectWebhookFormat(url: string): "slack" | "discord" | "generic" {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "hooks.slack.com") return "slack";
    if (
      parsed.hostname === "discord.com" &&
      parsed.pathname.startsWith("/api/webhooks")
    ) {
      return "discord";
    }
  } catch {
    // Invalid URL — fall through to generic
  }
  return "generic";
}

export async function sendWebhook(
  webhookUrl: string,
  alert: AlertPayload,
): Promise<boolean> {
  const format = detectWebhookFormat(webhookUrl);

  let body: Record<string, unknown>;
  let targetUrl = webhookUrl;

  switch (format) {
    case "slack":
      body = formatSlackPayload(alert);
      break;
    case "discord": {
      const discord = formatDiscordPayload(alert, webhookUrl);
      body = discord.body;
      targetUrl = discord.targetUrl;
      break;
    }
    default:
      body = formatGenericPayload(alert);
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      log.warn("Webhook delivery failed", {
        statusCode: response.status,
        alertType: alert.type,
      });
      return false;
    }

    log.info("Webhook delivered", { alertType: alert.type, format });
    return true;
  } catch (err) {
    log.error("Webhook request error", {
      error: err instanceof Error ? err.message : String(err),
      alertType: alert.type,
    });
    return false;
  }
}
