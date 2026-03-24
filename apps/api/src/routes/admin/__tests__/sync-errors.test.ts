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

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockUpdateGet = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockUpdateGet,
        })),
      })),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  syncErrors: {
    id: "id",
    status: "status",
    syncType: "syncType",
    siteId: "siteId",
    createdAt: "createdAt",
  },
  syncErrorStatusEnum: ["OPEN", "RESOLVED", "IGNORED"],
  syncTypeEnum: ["FAS"],
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          json: () => Promise<unknown>;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const body = await c.req.json();
      c.req.addValidatedData("json", body);
      await next();
    };
  },
}));

vi.mock("../../../validators/schemas", () => ({
  AdminResolveSyncErrorSchema: {},
}));

vi.mock("../../../validators/schemas", () => ({
  AdminResolveSyncErrorSchema: {},
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
  const { default: syncErrorsRoute } = await import("../sync-errors");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", syncErrorsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/sync-errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeChain());
    mockDb.update.mockImplementation(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: mockUpdateGet,
          })),
        })),
      })),
    }));
  });

  describe("GET /sync-errors", () => {
    it("returns sync errors list", async () => {
      mockAll.mockResolvedValueOnce([
        { id: "e-1", status: "OPEN", syncType: "FAS" },
      ]);
      mockGet.mockResolvedValueOnce({ count: 1 });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { errors: unknown[]; total: number };
      };
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.total).toBe(1);
    });

    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/sync-errors", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid status filter", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors?status=INVALID", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid syncType filter", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors?syncType=INVALID", {}, env);
      expect(res.status).toBe(400);
    });

    it("filters by syncType query param", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors?syncType=FAS", {}, env);
      expect(res.status).toBe(200);
    });

    it("filters by siteId query param", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });

    it("accepts valid status filter", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/sync-errors?status=OPEN", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /sync-errors/:id/status", () => {
    it("resolves a sync error", async () => {
      mockUpdateGet.mockResolvedValueOnce({ id: "e-1", status: "RESOLVED" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/sync-errors/e-1/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RESOLVED" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when sync error not found", async () => {
      mockUpdateGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/sync-errors/e-999/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RESOLVED" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid status in resolve body", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/sync-errors/e-1/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "INVALID" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/sync-errors/e-1/status",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RESOLVED" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });
});
