import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, inArray } from "drizzle-orm";
import { siteMemberships, users, sites, syncErrors } from "../db/schema";
import { createLogger } from "../lib/logger";

export const log = createLogger("scheduled");
const DEFAULT_ELASTICSEARCH_INDEX_PREFIX = "safetywallet-logs";

export interface SyncFailureTelemetry {
  timestamp: string;
  correlationId: string;
  syncType: "FAS_WORKER";
  errorCode: string;
  errorMessage: string;
  lockName: string;
}

export function getElkDailyIndexDate(timestamp: string): string {
  return timestamp.slice(0, 10).replace(/-/g, ".");
}

export function buildSyncFailureEventId(
  telemetry: SyncFailureTelemetry,
): string {
  return `${telemetry.syncType}-${telemetry.correlationId}`;
}

export async function emitSyncFailureToElk(
  env: Env,
  telemetry: SyncFailureTelemetry,
): Promise<void> {
  if (!env.ELASTICSEARCH_URL) {
    return;
  }

  const indexDate = getElkDailyIndexDate(telemetry.timestamp);
  const eventId = buildSyncFailureEventId(telemetry);
  const indexPrefix =
    env.ELASTICSEARCH_INDEX_PREFIX ?? DEFAULT_ELASTICSEARCH_INDEX_PREFIX;
  const endpoint = `${env.ELASTICSEARCH_URL}/${indexPrefix}-${indexDate}/_doc/${eventId}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.ELASTICSEARCH_API_KEY) {
    headers["Authorization"] = `ApiKey ${env.ELASTICSEARCH_API_KEY}`;
  }

  await withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(endpoint, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            level: "error",
            module: "scheduled",
            service: "safetywallet",
            message: `Scheduled sync failed (${telemetry.syncType})`,
            msg: `Scheduled sync failed (${telemetry.syncType})`,
            timestamp: telemetry.timestamp,
            "@timestamp": telemetry.timestamp,
            action: "SYNC_FAILURE",
            metadata: {
              correlationId: telemetry.correlationId,
              syncType: telemetry.syncType,
              errorCode: telemetry.errorCode,
              errorMessage: telemetry.errorMessage,
              lockName: telemetry.lockName,
              eventId,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`ELK ingest failed with status ${response.status}`);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
    2,
    500,
  );
}
export interface PersistSyncFailureOptions {
  syncType: "FAS_WORKER";
  errorCode: string;
  errorMessage: string;
  lockName: string;
  setFasDownStatus?: boolean;
}

export async function persistSyncFailure(
  env: Env,
  options: PersistSyncFailureOptions,
): Promise<void> {
  const db = drizzle(env.DB);
  const timestamp = new Date().toISOString();
  const correlationId = crypto.randomUUID();

  void Promise.resolve().then(async () => {
    try {
      await emitSyncFailureToElk(env, {
        timestamp,
        correlationId,
        syncType: options.syncType,
        errorCode: options.errorCode,
        errorMessage: options.errorMessage,
        lockName: options.lockName,
      });
    } catch (elkErr) {
      log.warn("Failed to emit scheduled sync failure to ELK", {
        elkErrorMessage:
          elkErr instanceof Error ? elkErr.message : String(elkErr),
        correlationId,
        syncType: options.syncType,
        lockName: options.lockName,
      });
    }
  });

  if (options.setFasDownStatus) {
    try {
      await env.KV.put("fas-status", "down", { expirationTtl: 600 });
    } catch (e) {
      log.error(
        "[sync] Failed to set fas-status in KV:",
        e instanceof Error ? e : undefined,
      );
    }
  }

  try {
    await db.insert(syncErrors).values({
      syncType: options.syncType,
      status: "OPEN",
      errorCode: options.errorCode,
      errorMessage: options.errorMessage,
      payload: JSON.stringify({
        timestamp,
        correlationId,
        lockName: options.lockName,
      }),
    });
  } catch (e) {
    log.error(
      "[sync] Failed to insert sync error record:",
      e instanceof Error ? e : undefined,
    );
  }
}

export function getKSTDate(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + kstOffset * 60 * 1000);
}

export function getMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { start, end };
}

export function formatSettleMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const VOTE_REWARD_POINTS = [50, 30, 20] as const;
export const VOTE_REWARD_POINT_CODES = [
  "VOTE_REWARD_RANK_1",
  "VOTE_REWARD_RANK_2",
  "VOTE_REWARD_RANK_3",
] as const;

export async function tableExists(
  env: Env,
  tableName: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  )
    .bind(tableName)
    .first<{ name: string }>();

  return Boolean(row?.name);
}

export async function findExistingColumn(
  env: Env,
  tableName: string,
  candidateColumns: string[],
): Promise<string | null> {
  const info = await env.DB.prepare(`PRAGMA table_info("${tableName}")`).all<{
    name: string;
  }>();
  const columnSet = new Set(
    (Array.isArray(info.results) ? info.results : []).map((col) => col.name),
  );

  for (const column of candidateColumns) {
    if (columnSet.has(column)) {
      return column;
    }
  }

  return null;
}

export async function deleteFromOptionalTableByAge(
  env: Env,
  tableName: string,
  candidateColumns: string[],
  cutoffDate: Date,
): Promise<number> {
  const exists = await tableExists(env, tableName);
  if (!exists) {
    return 0;
  }

  const cutoffColumn = await findExistingColumn(
    env,
    tableName,
    candidateColumns,
  );
  if (!cutoffColumn) {
    log.warn("Data retention table has no usable cutoff column", {
      tableName,
      candidateColumns,
    });
    return 0;
  }

  const cutoffIso = cutoffDate.toISOString();
  const result = await env.DB.prepare(
    `DELETE FROM "${tableName}" WHERE ("${cutoffColumn}" < ? OR datetime("${cutoffColumn}", 'unixepoch') < ?)`,
  )
    .bind(cutoffIso, cutoffIso)
    .run();

  return result.meta?.changes ?? 0;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)),
      );
    }
  }
  throw new Error("Unreachable");
}

export async function getOrCreateSystemUser(
  db: ReturnType<typeof drizzle>,
): Promise<string> {
  const existingSystem = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "SYSTEM"))
    .get();

  if (existingSystem) {
    return existingSystem.id;
  }

  const systemUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: systemUserId,
    role: "SYSTEM",
    name: "시스템",
  });

  return systemUserId;
}

export async function ensureSiteMemberships(
  db: ReturnType<typeof drizzle>,
  userIds: string[],
): Promise<number> {
  if (userIds.length === 0) return 0;
  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) return 0;

  const activeSites = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.active, true))
    .all();

  if (activeSites.length === 0) return 0;

  let totalCreated = 0;
  const CHUNK_SIZE = 50;

  for (const site of activeSites) {
    const existingSet = new Set<string>();
    for (let i = 0; i < uniqueUserIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueUserIds.slice(i, i + CHUNK_SIZE);
      const existing = await db
        .select({ userId: siteMemberships.userId })
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.siteId, site.id),
            inArray(siteMemberships.userId, chunk),
          ),
        )
        .all();
      for (const m of existing) existingSet.add(m.userId);
    }

    const toInsert = uniqueUserIds
      .filter((id) => !existingSet.has(id))
      .map((userId) => ({
        userId,
        siteId: site.id,
        role: "WORKER" as const,
        status: "ACTIVE" as const,
      }));

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        await db.insert(siteMemberships).values(chunk).onConflictDoNothing();
      }
      totalCreated += toInsert.length;
    }
  }

  return totalCreated;
}
