import { openDB, type IDBPDatabase } from "idb";

// ─── Types ──────────────────────────────────────────────────

export type OfflineMutationType =
  | "createPost"
  | "updateActionStatus"
  | "submitQuizAttempt"
  | "submitRecommendation";

export interface OfflineQueueEntry {
  id: string;
  type: OfflineMutationType;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  bodyJson?: string;
  blobIds: string[];
  clientMutationId: string;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "blocked";
  lastError?: string;
  baseUpdatedAt?: string;
}

export interface OfflineQueueBlob {
  id: string;
  queueEntryId: string;
  fieldName: string;
  blob: Blob;
  fileName: string;
  contentType: string;
}

// ─── IDB Setup ──────────────────────────────────────────────

const DB_NAME = "safetywallet-offline";
const DB_VERSION = 1;
const ENTRIES_STORE = "queueEntries";
const BLOBS_STORE = "queueBlobs";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable in SSR"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(ENTRIES_STORE)) {
          db.createObjectStore(ENTRIES_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(BLOBS_STORE)) {
          db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// ─── apiFetch setter (avoids circular import) ───────────────

type ApiFetchFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;
let _apiFetch: ApiFetchFn | null = null;

export function setApiFetch(fn: ApiFetchFn): void {
  _apiFetch = fn;
}

// ─── Queue Operations ───────────────────────────────────────

export async function enqueueOfflineRequest(
  endpoint: string,
  options: {
    method?: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
    offlineMutationType?: OfflineMutationType;
    clientMutationId?: string;
    baseUpdatedAt?: string;
  },
): Promise<void> {
  const db = await getDB();
  const entryId = crypto.randomUUID();
  const blobIds: string[] = [];

  let bodyJson: string | undefined;
  if (typeof options.body === "string") {
    bodyJson = options.body;
  } else if (options.body instanceof Blob) {
    // Store blob separately in IDB
    const blobId = crypto.randomUUID();
    blobIds.push(blobId);
    const blobEntry: OfflineQueueBlob = {
      id: blobId,
      queueEntryId: entryId,
      fieldName: "body",
      blob: options.body,
      fileName: "upload",
      contentType: options.body.type || "application/octet-stream",
    };
    await db.put(BLOBS_STORE, blobEntry);
  } else if (options.body instanceof FormData) {
    // Extract blobs from FormData, store JSON fields + blobs separately
    const jsonFields: Record<string, string> = {};
    for (const [key, value] of options.body.entries()) {
      if (value instanceof Blob) {
        const blobId = crypto.randomUUID();
        blobIds.push(blobId);
        const blobEntry: OfflineQueueBlob = {
          id: blobId,
          queueEntryId: entryId,
          fieldName: key,
          blob: value,
          fileName: value instanceof File ? value.name : key,
          contentType: value.type || "application/octet-stream",
        };
        await db.put(BLOBS_STORE, blobEntry);
      } else {
        jsonFields[key] = value;
      }
    }
    bodyJson = JSON.stringify(jsonFields);
  }

  const entry: OfflineQueueEntry = {
    id: entryId,
    type: options.offlineMutationType ?? "createPost",
    endpoint,
    method: options.method ?? "POST",
    headers: options.headers ?? {},
    bodyJson,
    blobIds,
    clientMutationId: options.clientMutationId ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 5,
    status: "pending",
    baseUpdatedAt: options.baseUpdatedAt,
  };

  await db.put(ENTRIES_STORE, entry);
}

/** Replay all pending queued requests. Blocked items are skipped. */
export async function flushOfflineQueue(): Promise<{
  succeeded: number;
  failed: number;
  blocked: number;
}> {
  if (!_apiFetch) {
    return { succeeded: 0, failed: 0, blocked: 0 };
  }

  const db = await getDB();
  const allEntries: OfflineQueueEntry[] = await db.getAll(ENTRIES_STORE);
  const pending = allEntries.filter((e) => e.status === "pending");

  if (pending.length === 0) {
    return {
      succeeded: 0,
      failed: 0,
      blocked: allEntries.filter((e) => e.status === "blocked").length,
    };
  }

  let succeeded = 0;
  let failed = 0;
  let blocked = 0;

  for (const entry of pending) {
    try {
      // Reconstruct body
      let body: BodyInit | undefined;
      if (entry.blobIds.length > 0) {
        // Reconstruct FormData with blobs
        const formData = new FormData();
        if (entry.bodyJson) {
          const jsonFields = JSON.parse(entry.bodyJson) as Record<
            string,
            string
          >;
          for (const [key, value] of Object.entries(jsonFields)) {
            formData.append(key, value);
          }
        }
        for (const blobId of entry.blobIds) {
          const blobEntry: OfflineQueueBlob | undefined = await db.get(
            BLOBS_STORE,
            blobId,
          );
          if (blobEntry) {
            formData.append(
              blobEntry.fieldName,
              blobEntry.blob,
              blobEntry.fileName,
            );
          }
        }
        body = formData;
      } else if (entry.bodyJson) {
        body = entry.bodyJson;
      }

      await _apiFetch(entry.endpoint, {
        method: entry.method,
        body,
        headers:
          entry.blobIds.length > 0
            ? // Let browser set Content-Type for FormData
              Object.fromEntries(
                Object.entries(entry.headers).filter(
                  ([k]) => k.toLowerCase() !== "content-type",
                ),
              )
            : entry.headers,
      });

      // Success — remove entry and blobs
      await db.delete(ENTRIES_STORE, entry.id);
      for (const blobId of entry.blobIds) {
        await db.delete(BLOBS_STORE, blobId);
      }
      succeeded++;
    } catch (err: unknown) {
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status
          : 0;
      const message =
        err instanceof Error ? err.message : "Unknown replay error";

      if (status === 409) {
        // Conflict — mark as blocked, do not retry
        entry.status = "blocked";
        entry.lastError = message;
        await db.put(ENTRIES_STORE, entry);
        blocked++;
      } else {
        entry.retryCount++;
        if (entry.retryCount >= entry.maxRetries) {
          // Max retries — mark as blocked
          entry.status = "blocked";
          entry.lastError = `Max retries exceeded: ${message}`;
          await db.put(ENTRIES_STORE, entry);
          blocked++;
        } else {
          entry.lastError = message;
          await db.put(ENTRIES_STORE, entry);
          failed++;
        }
      }
    }
  }

  return { succeeded, failed, blocked };
}

/** Get count of pending (non-blocked) queue entries */
export async function getOfflineQueueLength(): Promise<number> {
  try {
    const db = await getDB();
    const allEntries: OfflineQueueEntry[] = await db.getAll(ENTRIES_STORE);
    return allEntries.filter((e) => e.status === "pending").length;
  } catch {
    return 0;
  }
}

/** Get all blocked queue entries */
export async function getBlockedItems(): Promise<OfflineQueueEntry[]> {
  try {
    const db = await getDB();
    const allEntries: OfflineQueueEntry[] = await db.getAll(ENTRIES_STORE);
    return allEntries.filter((e) => e.status === "blocked");
  } catch {
    return [];
  }
}

/** Get total queue size (pending + blocked) */
export async function getTotalQueueSize(): Promise<{
  pending: number;
  blocked: number;
}> {
  try {
    const db = await getDB();
    const allEntries: OfflineQueueEntry[] = await db.getAll(ENTRIES_STORE);
    return {
      pending: allEntries.filter((e) => e.status === "pending").length,
      blocked: allEntries.filter((e) => e.status === "blocked").length,
    };
  } catch {
    return { pending: 0, blocked: 0 };
  }
}

/** Retry a blocked item (reset to pending) */
export async function retryBlockedItem(entryId: string): Promise<void> {
  const db = await getDB();
  const entry: OfflineQueueEntry | undefined = await db.get(
    ENTRIES_STORE,
    entryId,
  );
  if (entry && entry.status === "blocked") {
    entry.status = "pending";
    entry.retryCount = 0;
    entry.lastError = undefined;
    await db.put(ENTRIES_STORE, entry);
  }
}

/** Dismiss (permanently remove) a blocked item */
export async function dismissBlockedItem(entryId: string): Promise<void> {
  const db = await getDB();
  const entry: OfflineQueueEntry | undefined = await db.get(
    ENTRIES_STORE,
    entryId,
  );
  if (entry) {
    for (const blobId of entry.blobIds) {
      await db.delete(BLOBS_STORE, blobId);
    }
    await db.delete(ENTRIES_STORE, entry.id);
  }
}

// ─── Legacy Migration ───────────────────────────────────────

const LEGACY_QUEUE_KEY = "safetywallet_offline_queue";

interface LegacyQueuedRequest {
  id: string;
  endpoint: string;
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  };
  createdAt: string;
  retryCount: number;
}

/** Migrate items from localStorage queue to IDB. Idempotent. */
export async function migrateFromLocalStorage(): Promise<number> {
  if (typeof window === "undefined") return 0;

  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    if (!raw) return 0;

    const legacyItems: LegacyQueuedRequest[] = JSON.parse(raw);
    if (legacyItems.length === 0) return 0;

    const db = await getDB();
    let migrated = 0;

    for (const item of legacyItems) {
      const entry: OfflineQueueEntry = {
        id: item.id,
        type: "createPost", // Best guess for legacy items
        endpoint: item.endpoint,
        method: item.options.method ?? "POST",
        headers: item.options.headers ?? {},
        bodyJson: item.options.body,
        blobIds: [],
        clientMutationId: crypto.randomUUID(),
        createdAt: item.createdAt,
        retryCount: item.retryCount,
        maxRetries: 5,
        status: "pending",
      };
      await db.put(ENTRIES_STORE, entry);
      migrated++;
    }

    // Clear localStorage queue after successful migration
    localStorage.removeItem(LEGACY_QUEUE_KEY);
    return migrated;
  } catch {
    return 0;
  }
}

// ─── Replay Triggers ────────────────────────────────────────

let _initialized = false;

/** Initialize offline sync listeners. Call once at app startup. */
export function initOfflineSync(): void {
  if (typeof window === "undefined" || _initialized) return;
  _initialized = true;

  // Migrate legacy items on first init
  migrateFromLocalStorage();

  // Replay on coming back online
  window.addEventListener("online", () => {
    flushOfflineQueue();
  });

  // Replay on tab gaining focus (catches cases where online event was missed)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      flushOfflineQueue();
    }
  });

  // Replay on window focus
  window.addEventListener("focus", () => {
    if (navigator.onLine) {
      flushOfflineQueue();
    }
  });
}
