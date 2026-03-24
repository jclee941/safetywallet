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

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.get = mockGet;
  chain.all = vi.fn();
  return chain;
}

const mockUpdateReturning = vi.fn();
const mockInsertReturning = vi.fn();

const mockDb = {
  select: vi.fn(() => makeChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: mockUpdateReturning,
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: mockInsertReturning,
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  accessPolicies: {
    siteId: "siteId",
    requireCheckin: "requireCheckin",
    dayCutoffHour: "dayCutoffHour",
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

const SITE_ID = "00000000-0000-0000-0000-000000000001";

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
  const { default: accessPoliciesRoute } = await import("../access-policies");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", accessPoliciesRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/access-policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeChain());
    mockDb.update.mockImplementation(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mockUpdateReturning,
        })),
      })),
    }));
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    }));
  });

  describe("GET /access-policies/:siteId", () => {
    it("returns 400 when siteId is empty", async () => {
      const { default: accessPoliciesRoute } =
        await import("../access-policies");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", accessPoliciesRoute);
      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request(`/access-policies/${SITE_ID}`, {}, env);
      expect(res.status).toBe(400);
    });

    it("returns existing policy", async () => {
      mockGet.mockResolvedValueOnce({
        siteId: SITE_ID,
        requireCheckin: true,
        dayCutoffHour: 5,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(`/access-policies/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { policy: { requireCheckin: boolean } };
      };
      expect(body.data.policy.requireCheckin).toBe(true);
    });

    it("returns default policy when none exists", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(`/access-policies/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { policy: { requireCheckin: boolean; dayCutoffHour: number } };
      };
      expect(body.data.policy.requireCheckin).toBe(true);
      expect(body.data.policy.dayCutoffHour).toBe(5);
    });
  });

  describe("PUT /access-policies/:siteId", () => {
    it("returns 400 when siteId is empty", async () => {
      const { default: accessPoliciesRoute } =
        await import("../access-policies");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", accessPoliciesRoute);
      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: true }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for malformed JSON body", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "{invalid",
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("updates existing policy", async () => {
      mockGet.mockResolvedValueOnce({ siteId: SITE_ID, requireCheckin: true });
      const updatedPolicy = {
        siteId: SITE_ID,
        requireCheckin: false,
        dayCutoffHour: 6,
      };
      mockUpdateReturning.mockResolvedValueOnce([updatedPolicy]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: false, dayCutoffHour: 6 }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("creates new policy when none exists", async () => {
      mockGet.mockResolvedValueOnce(null);
      const newPolicy = {
        siteId: SITE_ID,
        requireCheckin: true,
        dayCutoffHour: 5,
      };
      mockInsertReturning.mockResolvedValueOnce([newPolicy]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: true }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid requireCheckin", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: "not-a-bool" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid dayCutoffHour", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: true, dayCutoffHour: 25 }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 500 when update fails", async () => {
      mockGet.mockResolvedValueOnce(null);
      mockInsertReturning.mockResolvedValueOnce([undefined]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        `/access-policies/${SITE_ID}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requireCheckin: true }),
        },
        env,
      );
      expect(res.status).toBe(500);
    });
  });
});
