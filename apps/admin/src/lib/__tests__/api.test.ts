import { beforeEach, describe, expect, it, vi } from "vitest";

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthState = {
  tokens: Tokens | null;
  logout: () => void;
  setTokens: (tokens: Tokens) => void;
};

const mockGetState = vi.fn<() => AuthState>();

vi.mock("@/stores/auth", () => ({
  useAuthStore: {
    getState: () => mockGetState(),
  },
}));

const mockFetch = vi.fn<typeof fetch>();

function createJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function createNonJsonResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockRejectedValue(new Error("not-json")),
  } as unknown as Response;
}

describe("ApiError", () => {
  it("sets name, message, status, and code", async () => {
    const { ApiError } = await import("@/lib/api");
    const error = new ApiError("boom", 418, "TEAPOT");

    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("boom");
    expect(error.status).toBe(418);
    expect(error.code).toBe("TEAPOT");
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("calls API without Authorization when no tokens", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ ok: boolean }>("/health");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("adds Authorization header when access token exists", async () => {
    mockGetState.mockReturnValue({
      tokens: { accessToken: "token-a", refreshToken: "refresh-a" },
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(
      createJsonResponse(200, { data: { id: 1 } }),
    );

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ id: number }>("/users/me");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/users/me",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-a",
        },
      }),
    );
    expect(result).toEqual({ id: 1 });
  });

  it("refreshes token on 401 and retries request", async () => {
    const logout = vi.fn();
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout,
      setTokens,
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, { data: { success: true } }),
      );

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ success: boolean }>("/secure");

    expect(setTokens).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: "old-refresh" }),
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "/api/secure",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer new-access",
        },
      }),
    );
    expect(logout).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("accepts refresh response without data wrapper", async () => {
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout: vi.fn(),
      setTokens,
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          accessToken: "flat-access",
          refreshToken: "flat-refresh",
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

    const { apiFetch } = await import("@/lib/api");
    await apiFetch<{ ok: boolean }>("/secure-flat");

    expect(setTokens).toHaveBeenCalledWith({
      accessToken: "flat-access",
      refreshToken: "flat-refresh",
    });
  });

  it("logs out when refresh response is not ok", async () => {
    const logout = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout,
      setTokens: vi.fn(),
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "refresh failed" }),
      );

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/secure")).rejects.toMatchObject({
      name: "ApiError",
      message: "Session expired",
      status: 401,
      code: "SESSION_EXPIRED",
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("logs out when refresh response is missing tokens", async () => {
    const logout = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout,
      setTokens: vi.fn(),
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, { data: { accessToken: "only-one" } }),
      );

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/secure")).rejects.toMatchObject({
      message: "Invalid refresh response",
      status: 401,
      code: "SESSION_EXPIRED",
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("logs out when retried request is still 401", async () => {
    const logout = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout,
      setTokens: vi.fn(),
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "still unauthorized" }),
      );

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/secure")).rejects.toMatchObject({
      message: "Session invalid after refresh",
      status: 401,
      code: "SESSION_INVALID",
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("throws ApiError using json message and code on non-ok response", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(
      createJsonResponse(500, { message: "Server exploded", code: "E_BROKEN" }),
    );

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/boom")).rejects.toMatchObject({
      message: "Server exploded",
      status: 500,
      code: "E_BROKEN",
    });
  });

  it("throws fallback message when non-ok response has no json body", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(createNonJsonResponse(503));

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/service")).rejects.toMatchObject({
      message: "Request failed",
      status: 503,
      code: undefined,
    });
  });

  it("returns response.data when data wrapper exists", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(
      createJsonResponse(200, { data: { count: 3 } }),
    );

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ count: number }>("/wrapped");

    expect(result).toEqual({ count: 3 });
  });

  it("returns raw json when data wrapper is missing", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(
      createJsonResponse(200, { hello: "world" }),
    );

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ hello: string }>("/raw");

    expect(result).toEqual({ hello: "world" });
  });

  it("merges custom headers with default headers", async () => {
    mockGetState.mockReturnValue({
      tokens: { accessToken: "token-x", refreshToken: "refresh-x" },
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

    const { apiFetch } = await import("@/lib/api");
    await apiFetch("/headers", {
      headers: { "X-Request-Id": "req-1" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/headers",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "req-1",
          Authorization: "Bearer token-x",
        },
      }),
    );
  });

  it("returns 401 response error directly when no refresh token exists", async () => {
    mockGetState.mockReturnValue({
      tokens: { accessToken: "token-only", refreshToken: "" },
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(
      createJsonResponse(401, { message: "unauthorized-no-refresh" }),
    );

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/secure-no-refresh")).rejects.toMatchObject({
      message: "unauthorized-no-refresh",
      status: 401,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws timeout ApiError when request aborts", async () => {
    vi.useFakeTimers();
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });

    mockFetch.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const { apiFetch } = await import("@/lib/api");
    const requestPromise = apiFetch("/timeout");
    const assertion = expect(requestPromise).rejects.toMatchObject({
      name: "ApiError",
      message: "Request timed out",
      status: 0,
      code: "TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    vi.useRealTimers();
  });

  it("aborts immediately when provided signal is already aborted", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });

    mockFetch.mockImplementation(() => {
      throw new DOMException("Aborted", "AbortError");
    });

    const { apiFetch } = await import("@/lib/api");
    const externalController = new AbortController();
    externalController.abort("external-abort");

    await expect(
      apiFetch("/aborted", { signal: externalController.signal }),
    ).rejects.toMatchObject({
      message: "Request timed out",
      code: "TIMEOUT",
    });
  });

  it("re-throws non-AbortError from initial fetch", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });

    const networkError = new TypeError("Failed to fetch");
    mockFetch.mockRejectedValueOnce(networkError);

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/network-fail")).rejects.toBe(networkError);
  });

  it("wraps non-ApiError refresh failure with generic ApiError", async () => {
    const logout = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout,
      setTokens: vi.fn(),
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockRejectedValueOnce(new TypeError("Network error during refresh"));

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/secure")).rejects.toMatchObject({
      name: "ApiError",
      message: "Session expired",
      status: 401,
      code: "SESSION_EXPIRED",
    });
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("uses anySignal for retry when options.signal is provided", async () => {
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout: vi.fn(),
      setTokens,
    });

    const externalController = new AbortController();

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(200, { data: { ok: true } }));

    const { apiFetch } = await import("@/lib/api");
    const result = await apiFetch<{ ok: boolean }>("/secure", {
      signal: externalController.signal,
    });

    expect(result).toEqual({ ok: true });
    const retryCall = mockFetch.mock.calls[2];
    expect(retryCall[1]?.signal).toBeDefined();
  });

  it("throws timeout ApiError when retry request aborts", async () => {
    vi.useFakeTimers();
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout: vi.fn(),
      setTokens,
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockImplementationOnce(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      );

    const { apiFetch } = await import("@/lib/api");
    const requestPromise = apiFetch("/retry-timeout");
    const assertion = expect(requestPromise).rejects.toMatchObject({
      name: "ApiError",
      message: "Request timed out",
      status: 0,
      code: "TIMEOUT",
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    vi.useRealTimers();
  });

  it("re-throws non-AbortError from retry fetch", async () => {
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout: vi.fn(),
      setTokens,
    });

    const retryError = new TypeError("Retry network failure");

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockRejectedValueOnce(retryError);

    const { apiFetch } = await import("@/lib/api");

    await expect(apiFetch("/retry-fail")).rejects.toBe(retryError);
  });

  it("reuses in-flight refresh for concurrent 401s (mutex)", async () => {
    const setTokens = vi.fn();
    mockGetState.mockReturnValue({
      tokens: { accessToken: "old-access", refreshToken: "old-refresh" },
      logout: vi.fn(),
      setTokens,
    });

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: "unauthorized" }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(200, {
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      )
      .mockResolvedValueOnce(createJsonResponse(200, { data: { a: 1 } }))
      .mockResolvedValueOnce(createJsonResponse(200, { data: { b: 2 } }));

    const { apiFetch } = await import("@/lib/api");
    const [r1, r2] = await Promise.all([
      apiFetch<{ a: number }>("/path-a"),
      apiFetch<{ b: number }>("/path-b"),
    ]);

    expect(r1).toEqual({ a: 1 });
    expect(r2).toEqual({ b: 2 });
    const refreshCalls = mockFetch.mock.calls.filter(
      (c) => c[0] === "/api/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("covers anySignal addEventListener path with non-aborted signal", async () => {
    mockGetState.mockReturnValue({
      tokens: null,
      logout: vi.fn(),
      setTokens: vi.fn(),
    });
    mockFetch.mockResolvedValueOnce(createJsonResponse(200, { ok: true }));

    const { apiFetch } = await import("@/lib/api");
    const externalController = new AbortController();

    const result = await apiFetch<{ ok: boolean }>("/with-signal", {
      signal: externalController.signal,
    });

    expect(result).toEqual({ ok: true });
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]?.signal).toBeDefined();
  });
});
