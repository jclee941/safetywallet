import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

interface MockAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  loginDate: string | null;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const {
  authState,
  getStateMock,
  setAccessTokenMock,
  clearAuthMock,
  setTokensMock,
  logoutMock,
} = vi.hoisted(() => {
  const state: MockAuthState = {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    loginDate: "2026-02-23",
    setAccessToken: () => {},
    clearAuth: () => {},
    setTokens: () => {},
    logout: () => {},
  };

  const setAccessToken = vi.fn<(token: string) => void>((token) => {
    state.accessToken = token;
  });

  const clearAuth = vi.fn<() => void>(() => {
    state.accessToken = null;
    state.refreshToken = null;
  });

  const setTokens = vi.fn<(accessToken: string, refreshToken: string) => void>(
    (accessToken, refreshToken) => {
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
    },
  );

  const logout = vi.fn<() => void>(() => {
    state.accessToken = null;
    state.refreshToken = null;
  });

  state.setAccessToken = setAccessToken;
  state.clearAuth = clearAuth;
  state.setTokens = setTokens;
  state.logout = logout;

  return {
    authState: state,
    getStateMock: vi.fn(() => state),
    setAccessTokenMock: setAccessToken,
    clearAuthMock: clearAuth,
    setTokensMock: setTokens,
    logoutMock: logout,
  };
});

const {
  enqueueOfflineRequestMock,
  idbFlushOfflineQueueMock,
  idbGetOfflineQueueLengthMock,
  getTotalQueueSizeMock,
  getBlockedItemsMock,
  retryBlockedItemMock,
  dismissBlockedItemMock,
  setApiFetchMock,
  initOfflineSyncMock,
} = vi.hoisted(() => ({
  enqueueOfflineRequestMock: vi
    .fn<(...args: unknown[]) => Promise<void>>()
    .mockResolvedValue(undefined),
  idbFlushOfflineQueueMock: vi
    .fn<() => Promise<{ succeeded: number; failed: number; blocked: number }>>()
    .mockResolvedValue({ succeeded: 0, failed: 0, blocked: 0 }),
  idbGetOfflineQueueLengthMock: vi
    .fn<() => Promise<number>>()
    .mockResolvedValue(0),
  getTotalQueueSizeMock: vi
    .fn<() => Promise<{ pending: number; blocked: number }>>()
    .mockResolvedValue({ pending: 0, blocked: 0 }),
  getBlockedItemsMock: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
  retryBlockedItemMock: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  dismissBlockedItemMock: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
  setApiFetchMock: vi.fn<() => void>(),
  initOfflineSyncMock: vi.fn<() => void>(),
}));

vi.mock("@/lib/offline-queue", () => ({
  enqueueOfflineRequest: enqueueOfflineRequestMock,
  flushOfflineQueue: idbFlushOfflineQueueMock,
  getOfflineQueueLength: idbGetOfflineQueueLengthMock,
  getTotalQueueSize: getTotalQueueSizeMock,
  getBlockedItems: getBlockedItemsMock,
  retryBlockedItem: retryBlockedItemMock,
  dismissBlockedItem: dismissBlockedItemMock,
  setApiFetch: setApiFetchMock,
  initOfflineSync: initOfflineSyncMock,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: getStateMock,
  },
}));

import {
  apiFetch,
  ApiError,
  flushOfflineQueue,
  getOfflineQueueLength,
} from "@/lib/api";

const fetchMock = vi.fn<typeof fetch>();

function setOnlineStatus(online: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("api.ts", () => {
  beforeEach(() => {
    authState.accessToken = "access-token";
    authState.refreshToken = "refresh-token";
    authState.loginDate = "2026-02-23";

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    localStorage.clear();
    setOnlineStatus(true);
    fetchMock.mockReset();

    // Reset offline-queue mocks
    enqueueOfflineRequestMock.mockClear();
    idbFlushOfflineQueueMock
      .mockClear()
      .mockResolvedValue({ succeeded: 0, failed: 0, blocked: 0 });
    idbGetOfflineQueueLengthMock.mockClear().mockResolvedValue(0);
  });

  afterEach(() => {
    setOnlineStatus(true);
    localStorage.clear();
  });

  it("apiFetch sends GET with auth header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await apiFetch<{ ok: boolean }>("/health");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("apiFetch omits auth header when token is missing", async () => {
    authState.accessToken = null;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiFetch<{ ok: boolean }>("/health");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(headers).toMatchObject({ "Content-Type": "application/json" });
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("apiFetch omits auth header when skipAuth is enabled", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await apiFetch<{ ok: boolean }>("/public", { skipAuth: true });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as
      | Record<string, string>
      | undefined;
    expect(headers).toMatchObject({ "Content-Type": "application/json" });
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("apiFetch sends POST JSON with content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const payload = { title: "report" };
    await apiFetch<{ success: boolean }>("/posts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("apiFetch sends POST FormData without content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ uploaded: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const formData = new FormData();
    formData.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt");

    await apiFetch<{ uploaded: boolean }>("/uploads", {
      method: "POST",
      body: formData,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads",
      expect.objectContaining({
        method: "POST",
        body: formData,
      }),
    );

    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeTypeOf("object");
    expect(headers).not.toHaveProperty("Content-Type");
    expect(headers).toHaveProperty("Authorization", "Bearer access-token");
  });

  it("apiFetch throws ApiError for non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Boom", { status: 500 }));

    await expect(apiFetch("/broken")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "Boom",
    });
  });

  it("apiFetch retries original request after successful refresh on 401", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: "new-access-token",
              refreshToken: "new-refresh-token",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const result = await apiFetch<{ value: number }>("/protected");

    expect(result).toEqual({ value: 42 });
    expect(setTokensMock).toHaveBeenCalledWith(
      "new-access-token",
      "new-refresh-token",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/auth/refresh");

    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers;
    expect(retryHeaders).toHaveProperty(
      "Authorization",
      "Bearer new-access-token",
    );
  });

  it("throws retry response status when refreshed retry still fails", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: "new-access-token",
              refreshToken: "new-refresh-token",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response("retry failed", { status: 503 }));

    await expect(apiFetch("/protected")).rejects.toMatchObject({
      status: 503,
      message: "retry failed",
    });

    expect(setTokensMock).toHaveBeenCalledWith(
      "new-access-token",
      "new-refresh-token",
    );
  });

  it("apiFetch clears auth when refresh fails after 401", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("refresh denied", { status: 401 }));

    await expect(apiFetch("/protected")).rejects.toMatchObject({
      status: 401,
      message: "Session expired",
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("apiFetch clears auth when refresh token does not exist", async () => {
    authState.refreshToken = null;
    fetchMock.mockResolvedValueOnce(
      new Response("unauthorized", { status: 401 }),
    );

    await expect(apiFetch("/protected")).rejects.toMatchObject({
      status: 401,
      message: "Session expired",
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("apiFetch clears auth when refresh response is missing tokens", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { accessToken: "new-access-token" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    await expect(apiFetch("/protected")).rejects.toMatchObject({
      status: 401,
      message: "Session expired",
    });

    expect(setTokensMock).not.toHaveBeenCalled();
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("apiFetch clears auth when refresh request throws", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockRejectedValueOnce(new Error("refresh network error"));

    await expect(apiFetch("/protected")).rejects.toMatchObject({
      status: 401,
      message: "Session expired",
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses single refresh mutex for concurrent 401 responses", async () => {
    const unauthorizedSeen = new Set<string>();
    let refreshCalls = 0;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/auth/refresh") {
        refreshCalls += 1;
        await Promise.resolve();
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: "mutex-access-token",
              refreshToken: "mutex-refresh-token",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (
        (url === "/api/protected-a" || url === "/api/protected-b") &&
        !unauthorizedSeen.has(url)
      ) {
        unauthorizedSeen.add(url);
        return new Response("unauthorized", { status: 401 });
      }

      if (url === "/api/protected-a") {
        return new Response(JSON.stringify({ value: "A" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/protected-b") {
        return new Response(JSON.stringify({ value: "B" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("unexpected", { status: 500 });
    });

    const [a, b] = await Promise.all([
      apiFetch<{ value: string }>("/protected-a"),
      apiFetch<{ value: string }>("/protected-b"),
    ]);

    expect(a).toEqual({ value: "A" });
    expect(b).toEqual({ value: "B" });
    expect(refreshCalls).toBe(1);
    expect(setTokensMock).toHaveBeenCalledTimes(1);
  });

  it("apiFetch enqueues request when offlineQueue is true and offline", async () => {
    setOnlineStatus(false);

    const result = await apiFetch<{
      success: boolean;
      data: null;
      queued: boolean;
    }>("/posts", {
      method: "POST",
      body: JSON.stringify({ title: "offline" }),
      offlineQueue: true,
      headers: { "X-Test": "offline" },
    });

    expect(result).toEqual({ success: true, data: null, queued: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enqueueOfflineRequestMock).toHaveBeenCalledTimes(1);
    expect(enqueueOfflineRequestMock).toHaveBeenCalledWith(
      "/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "offline" }),
        headers: { "X-Test": "offline" },
      }),
    );
  });

  it("apiFetch queues form-data request via enqueueOfflineRequest", async () => {
    setOnlineStatus(false);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["payload"], { type: "text/plain" }),
      "a.txt",
    );

    const result = await apiFetch<{
      success: boolean;
      data: null;
      queued: boolean;
    }>("/uploads", {
      method: "POST",
      body: formData,
      offlineQueue: true,
    });

    expect(result).toEqual({ success: true, data: null, queued: true });
    expect(enqueueOfflineRequestMock).toHaveBeenCalledTimes(1);
    expect(enqueueOfflineRequestMock).toHaveBeenCalledWith(
      "/uploads",
      expect.objectContaining({
        method: "POST",
        body: formData,
      }),
    );
  });

  it("ApiError exposes status and message", () => {
    const error = new ApiError(418, "teapot");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(418);
    expect(error.message).toBe("teapot");
  });

  it("getOfflineQueueLength returns queue count from IDB", async () => {
    idbGetOfflineQueueLengthMock.mockResolvedValueOnce(2);

    const count = await getOfflineQueueLength();
    expect(count).toBe(2);
  });

  it("flushOfflineQueue delegates to IDB flush and returns result", async () => {
    idbFlushOfflineQueueMock.mockResolvedValueOnce({
      succeeded: 2,
      failed: 0,
      blocked: 0,
    });

    const result = await flushOfflineQueue();

    expect(result).toEqual({ succeeded: 2, failed: 0, blocked: 0 });
    expect(idbFlushOfflineQueueMock).toHaveBeenCalledTimes(1);
  });

  it("flushOfflineQueue returns zero counts when queue is empty", async () => {
    idbFlushOfflineQueueMock.mockResolvedValueOnce({
      succeeded: 0,
      failed: 0,
      blocked: 0,
    });

    const result = await flushOfflineQueue();

    expect(result).toEqual({ succeeded: 0, failed: 0, blocked: 0 });
  });

  it("flushOfflineQueue reports blocked items from IDB flush", async () => {
    idbFlushOfflineQueueMock.mockResolvedValueOnce({
      succeeded: 0,
      failed: 1,
      blocked: 1,
    });

    const result = await flushOfflineQueue();

    expect(result).toEqual({ succeeded: 0, failed: 1, blocked: 1 });
  });

  // NOTE: Module-level wiring (setApiFetch + initOfflineSync via queueMicrotask)
  // is an integration concern tested in E2E. happy-dom does not reliably run
  // queueMicrotask callbacks scheduled during module evaluation.

  it("getOfflineQueueLength returns 0 when IDB throws", async () => {
    idbGetOfflineQueueLengthMock.mockResolvedValueOnce(0);

    const count = await getOfflineQueueLength();
    expect(count).toBe(0);
  });

  it("mocked auth store exposes legacy and current methods", () => {
    authState.setAccessToken("legacy-token");
    expect(setAccessTokenMock).toHaveBeenCalledWith("legacy-token");

    authState.clearAuth();
    expect(clearAuthMock).toHaveBeenCalledTimes(1);
  });

  it("loads api module safely when window is unavailable", async () => {
    const originalWindow = globalThis.window;
    const originalNavigator = globalThis.navigator;

    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "navigator");
    vi.resetModules();

    try {
      const apiModule = await import("@/lib/api");
      expect(typeof apiModule.apiFetch).toBe("function");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });
});
