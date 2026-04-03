import type { Env } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import { gte, sql } from "drizzle-orm";
import { apiMetrics } from "../../db/schema";
import {
  fireAlert,
  getAlertConfig,
  buildHighErrorRateAlert,
  buildHighLatencyAlert,
} from "../../lib/alerting";

export async function processPendingAlerts(env: Env): Promise<void> {
  if (!env.KV) return;

  const config = await getAlertConfig(env.KV);
  if (!config.enabled || !config.webhookUrl) return;

  const db = drizzle(env.DB);
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const fromBucket = fiveMinAgo.toISOString().slice(0, 16);

  const [summary] = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${apiMetrics.requestCount}), 0)`,
      total5xx: sql<number>`coalesce(sum(${apiMetrics.status5xx}), 0)`,
      avgDurationMs: sql<number>`coalesce(cast(sum(${apiMetrics.totalDurationMs}) as real) / nullif(sum(${apiMetrics.requestCount}), 0), 0)`,
      maxDurationMs: sql<number>`coalesce(max(${apiMetrics.maxDurationMs}), 0)`,
    })
    .from(apiMetrics)
    .where(gte(apiMetrics.bucket, fromBucket));

  if (!summary || summary.totalRequests === 0) return;

  const errorRate = (summary.total5xx / summary.totalRequests) * 100;
  if (errorRate > config.errorRateThresholdPercent) {
    await fireAlert(
      env.KV,
      buildHighErrorRateAlert(
        errorRate,
        config.errorRateThresholdPercent,
        summary.total5xx,
        summary.totalRequests,
      ),
      env.ALERT_WEBHOOK_URL,
    );
  }

  if (summary.avgDurationMs > config.latencyThresholdMs) {
    await fireAlert(
      env.KV,
      buildHighLatencyAlert(
        summary.avgDurationMs,
        config.latencyThresholdMs,
        summary.maxDurationMs,
      ),
      env.ALERT_WEBHOOK_URL,
    );
  }
}

export const runMetricsAlertCheck = processPendingAlerts;
