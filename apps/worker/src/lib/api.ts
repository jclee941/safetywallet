import { useAuthStore } from "@/stores/auth";
import {
  enqueueOfflineRequest,
  flushOfflineQueue as idbFlushOfflineQueue,
  getOfflineQueueLength as idbGetOfflineQueueLength,
  getTotalQueueSize,
  getBlockedItems,
  retryBlockedItem,
  dismissBlockedItem,
  setApiFetch,
  initOfflineSync,
  type OfflineMutationType,
} from "./offline-queue";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  /** If true, queue the request when offline instead of throwing */
  offlineQueue?: boolean;
  /** Mutation type for conflict-aware offline replay */
  offlineMutationType?: OfflineMutationType;
  /** Client-generated idempotency key */
  clientMutationId?: string;
  /** Optimistic concurrency: server timestamp for compare-and-set */
  baseUpdatedAt?: string;
}

// Mutex for concurrent token refresh (prevents race conditions)
let refreshPromise: Promise<boolean> | null = null;

// ─── Offline Queue (backward-compat re-exports) ────────────

/** @deprecated Use OfflineQueueEntry from offline-queue.ts */
export interface QueuedRequest {
  id: string;
  endpoint: string;
  options: { method?: string; body?: string; headers?: Record<string, string> };
  createdAt: string;
  retryCount: number;
}
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw) {
    return null as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(response.status, "Invalid response payload");
  }
}

// Legacy key migration (runs once at module load, per AGENTS.md constraint)
const QUEUE_KEY = "safetywallet_offline_queue";
if (typeof window !== "undefined") {
  try {
    const legacy = localStorage.getItem("safework2_offline_queue");
    if (legacy) {
      localStorage.setItem(QUEUE_KEY, legacy);
      localStorage.removeItem("safework2_offline_queue");
    }
  } catch {
    // ignore
  }
}

/** Replay all pending queued requests via IDB-backed queue */
export async function flushOfflineQueue(): Promise<{
  succeeded: number;
  failed: number;
  blocked?: number;
}> {
  return idbFlushOfflineQueue();
}

/** Get pending (non-blocked) queue entry count */
export async function getOfflineQueueLength(): Promise<number> {
  return idbGetOfflineQueueLength();
}

// Re-export queue management utilities for UI consumption
export {
  getTotalQueueSize,
  getBlockedItems,
  retryBlockedItem,
  dismissBlockedItem,
  initOfflineSync,
  type OfflineMutationType,
};

// Wire apiFetch into offline-queue replay (setter avoids circular import)
if (typeof window !== "undefined") {
  // Deferred to ensure apiFetch is defined before registration
  queueMicrotask(() => {
    setApiFetch(apiFetch);
    initOfflineSync();
  });
}

export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    skipAuth = false,
    offlineQueue = false,
    offlineMutationType,
    clientMutationId,
    baseUpdatedAt,
    headers: customHeaders,
    ...rest
  } = options;

  if (offlineQueue && typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueOfflineRequest(endpoint, {
      method: options.method,
      body: options.body,
      headers: customHeaders as Record<string, string>,
      offlineMutationType,
      clientMutationId,
      baseUpdatedAt,
    });
    return { success: true, data: null, queued: true } as unknown as T;
  }

  const isFormData = rest.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders as Record<string, string>),
  };

  function getHeaders(): Record<string, string> {
    const h = { ...baseHeaders };
    if (!skipAuth) {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        h["Authorization"] = `Bearer ${accessToken}`;
      }
    }
    return h;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: getHeaders(),
  });

  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...rest,
        headers: getHeaders(),
      });
      if (!retryResponse.ok) {
        throw new ApiError(retryResponse.status, await retryResponse.text());
      }
      return parseJsonResponse<T>(retryResponse);
    } else {
      useAuthStore.getState().logout();
      throw new ApiError(401, "Session expired");
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return parseJsonResponse<T>(response);
}

async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doRefresh(): Promise<boolean> {
  const storedRefreshToken = useAuthStore.getState().refreshToken;
  if (!storedRefreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    });

    if (!response.ok) return false;

    const data = await parseJsonResponse<{
      data?: { accessToken?: string; refreshToken?: string };
    }>(response);
    const accessToken = data?.data?.accessToken;
    const newRefreshToken = data?.data?.refreshToken;
    if (!accessToken || !newRefreshToken) return false;

    useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
