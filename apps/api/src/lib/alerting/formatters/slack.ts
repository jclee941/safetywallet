import type { AlertPayload } from "../dispatch";

function severityTag(severity: AlertPayload["severity"]): string {
  return severity === "critical"
    ? "[CRITICAL]"
    : severity === "warning"
      ? "[WARNING]"
      : "[INFO]";
}

export function formatSlackPayload(
  alert: AlertPayload,
): Record<string, unknown> {
  const tag = severityTag(alert.severity);
  const metaLines = alert.metadata
    ? Object.entries(alert.metadata)
        .map(([k, v]) => `- ${k}: ${String(v)}`)
        .join("\n")
    : "";

  return {
    text: `${tag} ${alert.title}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${tag} ${alert.title}` },
      },
      { type: "section", text: { type: "mrkdwn", text: alert.message } },
      ...(metaLines
        ? [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Details:*\n${metaLines}` },
            },
          ]
        : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `송도세브란스 | ${alert.type} | ${alert.timestamp}`,
          },
        ],
      },
    ],
  };
}
