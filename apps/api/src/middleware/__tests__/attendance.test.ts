import { Hono } from "hono";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { attendanceMiddleware } from "../attendance";
import type { Env, AuthContext } from "../../types";

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function makeAuth(role = "WORKER", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      phone: "010-0000-0000",
      role,
      name: "테스트",
      nameMasked: "테*트",
    },
    loginDate: new Date().toISOString().split("T")[0],
  };
}

/**
 * Build a mock D1 that returns sequential `.raw()` results.
 * Drizzle's `.get()` with explicit `.select({fields})` calls D1's `.raw()`,
 * then maps the first row via `mapResultRow`.
 * Each call to `.raw()` shifts the next value from the queue.
 * Pass `[colValue]` for a "found" result, or `[]` for "not found".
 */
function createMockD1(...rawResults: Array<Array<unknown[]>>) {
  const queue = [...rawResults];
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      raw: vi.fn(async () => queue.shift() ?? []),
      run: vi.fn().mockResolvedValue({ results: [] }),
    })),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn(),
    dump: vi.fn(),
  };
}

function makeEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    DB: createMockD1() as unknown as D1Database,
    KV: { get: vi.fn().mockResolvedValue(null) } as unknown as KVNamespace,
    R2: {} as R2Bucket,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    JWT_SECRET: "test",
    HMAC_SECRET: "test",
    ENCRYPTION_KEY: "test",
    ENVIRONMENT: "test",
    REQUIRE_ATTENDANCE_FOR_POST: "true",
    REQUIRE_ATTENDANCE_FOR_LOGIN: "false",
    ...overrides,
  } as Env;
}

function createApp(siteIdParam?: string) {
  const app = new Hono<AppEnv>();

  // Pre-middleware to set auth
  app.use("*", async (c, next) => {
    const authHeader = c.req.header("X-Test-Auth");
    if (authHeader === "worker") {
      c.set("auth", makeAuth("WORKER"));
    } else if (authHeader === "admin") {
      c.set("auth", makeAuth("SITE_ADMIN"));
    }
    await next();
  });

  app.get("/check", async (c, next) => {
    const siteId = siteIdParam ?? c.req.query("siteId");
    return attendanceMiddleware(c, next, siteId);
  });

  app.get("/check", (c) => c.json({ ok: true }));

  return app;
}

describe("attendanceMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth and siteId provided", async () => {
    const app = createApp("site-1");
    const res = await app.request("http://localhost/check", {}, makeEnv());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a site member", async () => {
    const mockDb = createMockD1([]);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(403);
  });

  it("bypasses checks for SITE_ADMIN role", async () => {
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "admin" } },
      makeEnv(),
    );
    expect(res.status).toBe(200);
  });

  it("skips attendance when REQUIRE_ATTENDANCE_FOR_POST is false and no siteId", async () => {
    const app = createApp(undefined);
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ REQUIRE_ATTENDANCE_FOR_POST: "false" }),
    );
    expect(res.status).toBe(200);
  });

  it("skips attendance when REQUIRE_ATTENDANCE_FOR_POST is false and policy does not require checkin", async () => {
    const mockDb = createMockD1([["m-1"]], [[0]]);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb, REQUIRE_ATTENDANCE_FOR_POST: "false" }),
    );
    expect(res.status).toBe(200);
  });

  it("still checks attendance when REQUIRE_ATTENDANCE_FOR_POST is false but policy requires checkin", async () => {
    const mockDb = createMockD1([["m-1"]], [[1]], [], []);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb, REQUIRE_ATTENDANCE_FOR_POST: "false" }),
    );
    expect(res.status).toBe(403);
  });

  it("falls back to D1 when cached policy JSON is malformed", async () => {
    const mockDb = createMockD1([["m-1"]], [[0]]);
    const kvMock = {
      get: vi.fn().mockResolvedValue("{bad-json"),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({
        DB: mockDb,
        KV: kvMock,
        REQUIRE_ATTENDANCE_FOR_POST: "false",
      }),
    );

    expect(res.status).toBe(200);
    expect(kvMock.put).toHaveBeenCalled();
  });

  it("bypasses attendance check when FAS is down", async () => {
    const mockDb = createMockD1([["m-1"]]);
    const kvMock = { get: vi.fn().mockResolvedValue("down") };
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb, KV: kvMock }),
    );
    expect(res.status).toBe(200);
  });

  it("continues when KV read fails", async () => {
    const mockDb = createMockD1([["m-1"]], [["att-1"]]);
    const kvMock = {
      get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
    };
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb, KV: kvMock }),
    );
    expect(res.status).toBe(200);
  });

  it("allows when attendance record exists", async () => {
    const mockDb = createMockD1([["m-1"]], [["att-1"]]);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(200);
  });

  it("allows when manual approval exists but no attendance", async () => {
    const mockDb = createMockD1([["m-1"]], [], [["apr-1"]]);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when no attendance and no manual approval", async () => {
    const mockDb = createMockD1([["m-1"]], [], []);
    const app = createApp("site-1");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when no auth and REQUIRE_ATTENDANCE_FOR_POST is true and no siteId", async () => {
    const app = createApp(undefined);
    const res = await app.request("http://localhost/check", {}, makeEnv());
    expect(res.status).toBe(401);
  });

  it("checks attendance without siteId filter", async () => {
    const mockDb = createMockD1([["att-1"]]);
    const app = createApp(undefined);
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(200);
  });

  it("trims whitespace-only siteId to undefined", async () => {
    const mockDb = createMockD1([["att-1"]]);
    const app = createApp("   ");
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 without siteId when no attendance and no siteId for manual approval check", async () => {
    const mockDb = createMockD1([]);
    const app = createApp(undefined);
    const res = await app.request(
      "http://localhost/check",
      { headers: { "X-Test-Auth": "worker" } },
      makeEnv({ DB: mockDb }),
    );
    expect(res.status).toBe(403);
  });
});
