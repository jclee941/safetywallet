import type { AlertPayload } from "./dispatch";

export function buildFasDownAlert(errorMessage: string): AlertPayload {
  return {
    type: "FAS_DOWN",
    severity: "critical",
    title: "FAS MariaDB Connection Failed",
    message:
      "The FAS (Foreign Attendance System) database connection has failed. " +
      "Worker attendance verification is using graceful bypass mode.",
    timestamp: new Date().toISOString(),
    metadata: {
      error: errorMessage,
      impact: "Attendance verification bypassed",
    },
  };
}

export function buildHighErrorRateAlert(
  errorRate: number,
  threshold: number,
  total5xx: number,
  totalRequests: number,
): AlertPayload {
  return {
    type: "HIGH_ERROR_RATE",
    severity: errorRate > threshold * 2 ? "critical" : "warning",
    title: `High Error Rate: ${errorRate.toFixed(1)}%`,
    message:
      `The 5xx error rate has exceeded the threshold of ${threshold}%. ` +
      `Current rate: ${errorRate.toFixed(1)}% (${total5xx} errors out of ${totalRequests} requests).`,
    timestamp: new Date().toISOString(),
    metadata: {
      errorRatePercent: Math.round(errorRate * 100) / 100,
      thresholdPercent: threshold,
      total5xx,
      totalRequests,
    },
  };
}

export function buildHighLatencyAlert(
  avgMs: number,
  threshold: number,
  maxMs: number,
): AlertPayload {
  return {
    type: "HIGH_LATENCY",
    severity: avgMs > threshold * 2 ? "critical" : "warning",
    title: `High Latency: ${Math.round(avgMs)}ms avg`,
    message:
      `Average API response time (${Math.round(avgMs)}ms) exceeds the threshold of ${threshold}ms. ` +
      `Peak latency: ${Math.round(maxMs)}ms.`,
    timestamp: new Date().toISOString(),
    metadata: {
      avgDurationMs: Math.round(avgMs),
      maxDurationMs: Math.round(maxMs),
      thresholdMs: threshold,
    },
  };
}

export function buildCronFailureAlert(
  cronName: string,
  errorMessage: string,
): AlertPayload {
  return {
    type: "CRON_FAILURE",
    severity: "warning",
    title: `CRON Job Failed: ${cronName}`,
    message: `Scheduled task "${cronName}" failed after all retry attempts.`,
    timestamp: new Date().toISOString(),
    metadata: { cronName, error: errorMessage },
  };
}
