import type { Env } from "../types";
import { fireAlert, buildFasDownAlert } from "../lib/alerting";
import {
  runMonthEndSnapshot,
  runAutoNomination,
  runVoteRewardDistribution,
} from "./monthly-jobs";
import { runFasFullSync, runFasSyncIncremental } from "./sync-jobs";
import {
  runDataRetention,
  runOverdueActionCheck,
  runPiiLifecycleCleanup,
  publishScheduledAnnouncements,
  runMetricsAlertCheck,
} from "./daily";
import { log, withRetry, persistSyncFailure } from "./helpers";

export interface JobDefinition {
  name: string;
  fn: (env: Env) => Promise<void>;
  intervalMs: number;
  /** KST hour (0-23) to run. null = run at any time based on interval */
  kstHour: number | null;
  /** Day of week (0=Sun, 1=Mon, ...) or null for daily/interval */
  dayOfWeek: number | null;
  /** Day of month (1-31) or null */
  dayOfMonth: number | null;
  retryAttempts: number;
  retryBaseDelayMs: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH_APPROX_MS = 30 * 24 * 60 * 60 * 1000;

async function runFasFiveMinuteJob(env: Env): Promise<void> {
  const lastFullSync = await env.KV?.get("fas-last-full-sync");
  if (!lastFullSync) {
    try {
      await withRetry(() => runFasFullSync(env), 2, 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error("FAS bootstrap full sync failed", { error: errorMsg });
      await persistSyncFailure(env, {
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: errorMsg,
        lockName: "fas-full",
        setFasDownStatus: true,
      });
      if (env.KV) {
        await fireAlert(
          env.KV,
          buildFasDownAlert(errorMsg),
          env.ALERT_WEBHOOK_URL,
        ).catch((alertErr: unknown) => {
          log.error("Alert webhook delivery failed", {
            error:
              alertErr instanceof Error ? alertErr.message : String(alertErr),
          });
        });
      }
    }
  } else {
    try {
      await withRetry(() => runFasSyncIncremental(env), 3, 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorCode =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof err.code === "string"
          ? err.code
          : "UNKNOWN";
      log.error("FAS sync failed after 3 retries", {
        error: errorMsg,
        errorCode,
      });
      await persistSyncFailure(env, {
        syncType: "FAS_WORKER",
        errorCode,
        errorMessage: errorMsg,
        lockName: "fas",
        setFasDownStatus: true,
      });
      if (env.KV) {
        await fireAlert(
          env.KV,
          buildFasDownAlert(errorMsg),
          env.ALERT_WEBHOOK_URL,
        ).catch((alertErr: unknown) => {
          log.error("Alert webhook delivery failed", {
            error:
              alertErr instanceof Error ? alertErr.message : String(alertErr),
          });
        });
      }
    }
  }
}

export function getJobRegistry(env: Env): JobDefinition[] {
  void env;

  return [
    {
      name: "fas-sync",
      fn: runFasFiveMinuteJob,
      intervalMs: FIVE_MINUTES_MS,
      kstHour: null,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 1,
      retryBaseDelayMs: 1000,
    },
    {
      name: "publish-scheduled-announcements",
      fn: publishScheduledAnnouncements,
      intervalMs: FIVE_MINUTES_MS,
      kstHour: null,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 1,
      retryBaseDelayMs: 1000,
    },
    {
      name: "metrics-alert-check",
      fn: runMetricsAlertCheck,
      intervalMs: FIVE_MINUTES_MS,
      kstHour: null,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 1,
      retryBaseDelayMs: 1000,
    },
    {
      name: "fas-full-sync-daily",
      fn: runFasFullSync,
      intervalMs: ONE_DAY_MS,
      kstHour: 21,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 2,
      retryBaseDelayMs: 5000,
    },
    {
      name: "overdue-action-check",
      fn: runOverdueActionCheck,
      intervalMs: ONE_DAY_MS,
      kstHour: 21,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
    {
      name: "pii-lifecycle-cleanup",
      fn: runPiiLifecycleCleanup,
      intervalMs: ONE_DAY_MS,
      kstHour: 21,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
    {
      name: "vote-reward-distribution",
      fn: runVoteRewardDistribution,
      intervalMs: ONE_DAY_MS,
      kstHour: 21,
      dayOfWeek: null,
      dayOfMonth: null,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
    {
      name: "data-retention",
      fn: runDataRetention,
      intervalMs: ONE_WEEK_MS,
      kstHour: 3,
      dayOfWeek: 0,
      dayOfMonth: null,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
    {
      name: "month-end-snapshot",
      fn: runMonthEndSnapshot,
      intervalMs: ONE_MONTH_APPROX_MS,
      kstHour: 0,
      dayOfWeek: null,
      dayOfMonth: 1,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
    {
      name: "auto-nomination",
      fn: runAutoNomination,
      intervalMs: ONE_MONTH_APPROX_MS,
      kstHour: 0,
      dayOfWeek: null,
      dayOfMonth: 1,
      retryAttempts: 2,
      retryBaseDelayMs: 3000,
    },
  ];
}
