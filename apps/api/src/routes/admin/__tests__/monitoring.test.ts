import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../helpers", () => ({
  requireAdmin: vi.fn(async (c: any, next: () => Promise<void>) => {
    const auth = c.get("auth");
    if (
      !auth?.user?.role ||
      (auth.user.role !== "SITE_ADMIN" && auth.user.role !== "SUPER_ADMIN")
    ) {
      return c.json({ error: "Admin access required" }, 403);
    }
    await next();
  }),
  requireSuperAdmin: vi.fn(async (c: any, next: () => Promise<void>) => {
    const auth = c.get("auth");
    if (auth?.user?.role !== "SUPER_ADMIN") {
      return c.json({ error: "Super admin access required" }, 403);
    }
    await next();
  }),
}));

let selectResult: unknown = [];

function makeChain(): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(selectResult);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

const mockDb = {
  select: vi.fn(() => makeChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  apiMetrics: {
    bucket: "bucket",
    endpoint: "endpoint",
    method: "method",
    requestCount: "requestCount",
    errorCount: "errorCount",
    totalDurationMs: "totalDurationMs",
    maxDurationMs: "maxDurationMs",
    status2xx: "status2xx",
    status4xx: "status4xx",
    status5xx: "status5xx",
  },
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

interface AuthContext {
  user: {
    id: string;
    phone: string;
    role: string;
    name: string;
    nameMasked: string;
  };
  loginDate: string;
}

function makeAuth(role = "SUPER_ADMIN"): AuthContext {
  return {
    user: {
      id: "admin-1",
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: monitoringRoute } = await import("../monitoring");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", monitoringRoute);
  const env = {
    DB: {},
    KV: {
      get: vi.fn(),
      put: vi.fn(),
    },
    R2: {
      list: vi.fn().mockResolvedValue({ objects: [] }),
    },
    VERSION: "test",
    JWT_SECRET: "test-secret",
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/monitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
    mockDb.select.mockImplementation(() => makeChain());
  });

  describe("GET /monitoring/metrics", () => {
    it("returns metrics grouped by bucket (default)", async () => {
      selectResult = [{ bucket: "2025-01-01T00:00", totalRequests: 100 }];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/metrics", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { groupBy: string; rows: unknown[] };
      };
      expect(body.data.groupBy).toBe("bucket");
      expect(body.data.rows).toHaveLength(1);
    });

    it("returns metrics grouped by endpoint", async () => {
      selectResult = [
        { endpoint: "/api/posts", method: "GET", totalRequests: 50 },
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/monitoring/metrics?groupBy=endpoint",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { groupBy: string } };
      expect(body.data.groupBy).toBe("endpoint");
    });

    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/monitoring/metrics", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /monitoring/top-errors", () => {
    it("returns top error endpoints", async () => {
      selectResult = [
        { endpoint: "/api/auth", method: "POST", totalErrors: 5 },
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/top-errors", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { rows: unknown[] } };
      expect(body.data.rows).toHaveLength(1);
    });

    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/monitoring/top-errors", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /monitoring/summary", () => {
    it("returns health summary", async () => {
      selectResult = [
        {
          totalRequests: 1000,
          totalErrors: 10,
          avgDurationMs: 45.5,
          maxDurationMs: 200,
          total2xx: 950,
          total4xx: 40,
          total5xx: 10,
        },
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/summary", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          totalRequests: number;
          errorRate: number;
          statusBreakdown: { "2xx": number; "4xx": number; "5xx": number };
        };
      };
      expect(body.data.totalRequests).toBe(1000);
      expect(body.data.errorRate).toBe(1);
      expect(body.data.statusBreakdown["2xx"]).toBe(950);
    });

    it("handles empty metrics gracefully", async () => {
      selectResult = [undefined];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/summary?minutes=30", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { totalRequests: number; errorRate: number };
      };
      expect(body.data.totalRequests).toBe(0);
      expect(body.data.errorRate).toBe(0);
    });

    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/monitoring/summary", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /monitoring/health", () => {
    it("returns health status with all checks", async () => {
      selectResult = [{ count: 1 }];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        status: string;
        version: string;
        checks: Record<string, { status: string; latency: number }>;
      };
      expect(body.status).toBe("healthy");
      expect(body.version).toBeDefined();
      expect(body.checks.d1).toBeDefined();
      expect(body.checks.kv).toBeDefined();
      expect(body.checks.r2).toBeDefined();
    });

    it("returns 503 when checks fail", async () => {
      // Simulate DB failure by throwing in mock
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("DB connection failed");
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(503);
      const body = (await res.json()) as {
        status: string;
        checks: Record<string, { status: string; error?: string }>;
      };
      expect(body.status).toBe("unhealthy");
      expect(body.checks.d1?.status).toBe("error");
      expect(body.checks.d1?.error).toBe("D1 query failed"); // Sanitized error
    });

    it("returns 503 when KV check fails", async () => {
      const { app, env } = await createApp(makeAuth());
      // Mock KV failure
      (env.KV as any).get = vi.fn().mockRejectedValue(new Error("KV error"));
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(503);
      const body = (await res.json()) as {
        status: string;
        checks: Record<string, { status: string; error?: string }>;
      };
      expect(body.status).toBe("unhealthy");
      expect(body.checks.kv?.status).toBe("error");
      expect(body.checks.kv?.error).toBe("KV access failed");
    });

    it("returns 503 when R2 check fails", async () => {
      const { app, env } = await createApp(makeAuth());
      // Mock R2 failure
      (env.R2 as any).list = vi.fn().mockRejectedValue(new Error("R2 error"));
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(503);
      const body = (await res.json()) as {
        status: string;
        checks: Record<string, { status: string; error?: string }>;
      };
      expect(body.status).toBe("unhealthy");
      expect(body.checks.r2?.status).toBe("error");
      expect(body.checks.r2?.error).toBe("R2 access failed");
    });
    it("returns 403 for non-super-admin (SITE_ADMIN)", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin (WORKER)", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/monitoring/health", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 401/403 when no auth header is provided", async () => {
      const { app, env } = await createApp();
      const res = await app.request("/monitoring/health", {}, env);
      expect([401, 403]).toContain(res.status);
    });
  });
});
