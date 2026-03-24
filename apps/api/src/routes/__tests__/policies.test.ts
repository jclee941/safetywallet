import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

import { logAuditWithContext } from "../../lib/audit";

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsertReturningGet = vi.fn();
const mockUpdateReturningGet = vi.fn();
const mockDeleteWhere = vi.fn();

function makeDrizzleChain() {
  const promise = Promise.resolve().then(() => mockAll()) as Promise<unknown> &
    Record<string, unknown>;
  promise.get = mockGet;
  promise.all = mockAll;
  return promise;
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => makeDrizzleChain()),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        get: mockInsertReturningGet,
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockUpdateReturningGet,
        })),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere.mockResolvedValue(undefined),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  pointPolicies: {
    id: "id",
    siteId: "siteId",
    reasonCode: "reasonCode",
    name: "name",
    isActive: "isActive",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
  },
  auditLogs: {},
}));

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

function makeAuth(role = "SUPER_ADMIN", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: policiesRoute } = await import("../policies");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/policies", policiesRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

const SITE_ID = "00000000-0000-0000-0000-000000000001";

describe("routes/policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /policies/site/:siteId", () => {
    it("returns policies for a site", async () => {
      mockAll.mockResolvedValue([
        { id: "p1", siteId: SITE_ID, reasonCode: "SAFETY", name: "Safety" },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(`/policies/site/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { policies: unknown[] } };
      expect(body.data.policies).toHaveLength(1);
    });

    it("returns empty list for site with no policies", async () => {
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(`/policies/site/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { policies: unknown[] } };
      expect(body.data.policies).toHaveLength(0);
    });

    it("returns 403 when worker is not a site member", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(`/policies/site/${SITE_ID}`, {}, env);
      expect(res.status).toBe(403);
    });

    it("returns policies for active site member", async () => {
      mockGet.mockResolvedValue({
        userId: "worker-1",
        siteId: SITE_ID,
        role: "WORKER",
        status: "ACTIVE",
      });
      mockAll.mockResolvedValue([
        { id: "p2", siteId: SITE_ID, reasonCode: "QUALITY", name: "Quality" },
      ]);
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(`/policies/site/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { policies: unknown[] } };
      expect(body.data.policies).toHaveLength(1);
    });
  });

  describe("GET /policies/:id", () => {
    it("returns a single policy", async () => {
      mockGet.mockResolvedValue({ id: "p1", siteId: SITE_ID, name: "Test" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/policies/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { policy: { id: string } } };
      expect(body.data.policy.id).toBe("p1");
    });

    it("returns 404 when policy not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/policies/missing", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request("/policies/p1", {}, env);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /policies", () => {
    const validBody = {
      siteId: SITE_ID,
      reasonCode: "SAFETY_REPORT",
      name: "Safety Report",
      defaultAmount: 100,
    };

    it("creates policy as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValue(null);
      mockInsertReturningGet.mockResolvedValue({
        id: "p-new",
        ...validBody,
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 409 for duplicate reasonCode on same site", async () => {
      mockGet.mockResolvedValue({
        id: "existing",
        reasonCode: "SAFETY_REPORT",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("returns 403 for non-admin non-site-admin", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when WORKER has active membership but not SITE_ADMIN", async () => {
      mockGet.mockResolvedValueOnce({
        userId: "worker-1",
        siteId: SITE_ID,
        role: "WORKER",
        status: "ACTIVE",
      });
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid body", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Missing fields" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates policy as SITE_ADMIN with valid membership", async () => {
      mockGet
        .mockResolvedValueOnce({
          userId: "admin-1",
          siteId: SITE_ID,
          role: "SITE_ADMIN",
          status: "ACTIVE",
        })
        .mockResolvedValueOnce(null);
      mockInsertReturningGet.mockResolvedValue({
        id: "p-admin",
        ...validBody,
      });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("creates policy with all optional fields populated", async () => {
      mockGet.mockResolvedValue(null);
      const fullBody = {
        siteId: SITE_ID,
        reasonCode: "FULL_TEST",
        name: "Full Policy",
        description: "Has all fields",
        defaultAmount: 50,
        minAmount: 10,
        maxAmount: 200,
        dailyLimit: 3,
        monthlyLimit: 15,
      };
      mockInsertReturningGet.mockResolvedValue({
        id: "p-full",
        ...fullBody,
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullBody),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 when handler receives missing required fields", async () => {
      const { default: policiesRoute } = await import("../policies");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN"));
        c.req.valid = (() =>
          ({
            siteId: "",
            reasonCode: "",
            name: "",
            defaultAmount: undefined,
          }) as unknown) as typeof c.req.valid;
        await next();
      });
      app.route("/policies", policiesRoute);

      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request(
        "/policies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /policies/:id", () => {
    it("updates policy as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValue({
        id: "p1",
        siteId: SITE_ID,
        name: "Old",
        reasonCode: "SAFETY",
      });
      mockUpdateReturningGet.mockResolvedValue({
        id: "p1",
        name: "Updated",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(logAuditWithContext).toHaveBeenCalledTimes(1);
    });

    it("updates policy with all optional fields", async () => {
      mockGet.mockResolvedValue({
        id: "p1",
        siteId: SITE_ID,
        name: "Old",
        description: "old desc",
        defaultAmount: 10,
        minAmount: 1,
        maxAmount: 100,
        dailyLimit: 5,
        monthlyLimit: 20,
        isActive: true,
        reasonCode: "SAFETY",
      });
      mockUpdateReturningGet.mockResolvedValue({
        id: "p1",
        name: "New",
        description: "new desc",
        defaultAmount: 50,
        minAmount: 5,
        maxAmount: 200,
        dailyLimit: 10,
        monthlyLimit: 30,
        isActive: false,
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "New",
            description: "new desc",
            defaultAmount: 50,
            minAmount: 5,
            maxAmount: 200,
            dailyLimit: 10,
            monthlyLimit: 30,
            isActive: false,
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(logAuditWithContext).toHaveBeenCalledTimes(1);
    });

    it("updates policy as SITE_ADMIN with valid membership", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: SITE_ID,
          name: "Old",
          reasonCode: "SAFETY",
        })
        .mockResolvedValueOnce({
          userId: "admin-1",
          siteId: SITE_ID,
          role: "SITE_ADMIN",
          status: "ACTIVE",
        });
      mockUpdateReturningGet.mockResolvedValue({
        id: "p1",
        name: "Admin Updated",
      });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Admin Updated" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when policy not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies/missing",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "X" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when WORKER member attempts PATCH", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: SITE_ID,
          name: "Old",
          reasonCode: "SAFETY",
        })
        .mockResolvedValueOnce({
          userId: "worker-1",
          siteId: SITE_ID,
          role: "WORKER",
          status: "ACTIVE",
        });

      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Denied" }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/policies/p1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "NoAuth" }),
        },
        env,
      );

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /policies/:id", () => {
    it("returns 400 when policyId is empty", async () => {
      const { default: policiesRoute } = await import("../policies");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN"));
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/policies", policiesRoute);
      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("deletes policy as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValue({ id: "p1", siteId: SITE_ID });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("deletes policy as SITE_ADMIN with valid membership", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "p1", siteId: SITE_ID })
        .mockResolvedValueOnce({
          userId: "admin-1",
          siteId: SITE_ID,
          role: "SITE_ADMIN",
          status: "ACTIVE",
        });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when policy not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/policies/missing",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-admin", async () => {
      mockGet.mockResolvedValue({ id: "p1", siteId: SITE_ID });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when WORKER member attempts DELETE", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "p1", siteId: SITE_ID })
        .mockResolvedValueOnce({
          userId: "worker-1",
          siteId: SITE_ID,
          role: "WORKER",
          status: "ACTIVE",
        });

      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/policies/p1",
        {
          method: "DELETE",
        },
        env,
      );

      expect(res.status).toBe(401);
    });
  });
});
