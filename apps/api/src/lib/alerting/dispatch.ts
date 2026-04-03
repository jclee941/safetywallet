import { createLogger } from "../logger";
import { isCoolingDown, setCooldown } from "./cooldown";
import { sendWebhook } from "./webhooks";

const log = createLogger("alerting");

export type AlertType =
  | "FAS_DOWN"
  | "HIGH_ERROR_RATE"
  | "HIGH_LATENCY"
  | "SYNC_FAILURE"
  | "CRON_FAILURE";

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertConfig {
  webhookUrl: string;
  cooldownSeconds: number;
  enabled: boolean;
  errorRateThresholdPercent: number;
  latencyThresholdMs: number;
  fasFailureThreshold: number;
}

export interface AlertPayload {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: AlertConfig = {
  webhookUrl: "",
  cooldownSeconds: 300,
  enabled: true,
  errorRateThresholdPercent: 5,
  latencyThresholdMs: 3000,
  fasFailureThreshold: 1,
};

const CONFIG_KEY = "alert-config";

export async function getAlertConfig(kv: KVNamespace): Promise<AlertConfig> {
  try {
    const raw = await kv.get(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    try {
      return {
        ...DEFAULT_CONFIG,
        ...(JSON.parse(raw) as Partial<AlertConfig>),
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  } catch (err) {
    log.warn("KV alert-config read failed, using defaults", {
      key: CONFIG_KEY,
      error: { name: "KVError", message: String(err) },
    });
    return { ...DEFAULT_CONFIG };
  }
}

export async function setAlertConfig(
  kv: KVNamespace,
  config: Partial<AlertConfig>,
): Promise<AlertConfig> {
  const merged: AlertConfig = { ...(await getAlertConfig(kv)), ...config };
  try {
    await kv.put(CONFIG_KEY, JSON.stringify(merged));
  } catch (err) {
    log.warn("KV alert-config write failed", {
      key: CONFIG_KEY,
      error: { name: "KVError", message: String(err) },
    });
  }
  return merged;
}

export async function fireAlert(
  kv: KVNamespace,
  alert: AlertPayload,
  webhookUrlOverride?: string,
): Promise<boolean> {
  const config = await getAlertConfig(kv);
  if (!config.enabled) {
    log.debug("Alerting disabled, skipping", { alertType: alert.type });
    return false;
  }

  const webhookUrl = webhookUrlOverride || config.webhookUrl;
  if (!webhookUrl) {
    log.debug("No webhook URL configured, skipping alert", {
      alertType: alert.type,
    });
    return false;
  }

  if (await isCoolingDown(kv, alert.type)) {
    log.debug("Alert in cooldown, skipping", { alertType: alert.type });
    return false;
  }

  const sent = await sendWebhook(webhookUrl, alert);
  if (sent) await setCooldown(kv, alert.type, config.cooldownSeconds);
  return sent;
}
