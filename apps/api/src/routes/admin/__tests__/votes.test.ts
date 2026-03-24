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

vi.mock("@hono/zod-validator", () => ({
  zValidator: (
    _target: string,
    schema: {
      safeParse?: (data: unknown) => { success: boolean; data: unknown };
    },
  ) => {
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
      if (typeof schema.safeParse === "function") {
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
              },
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        c.req.addValidatedData("json", parsed.data);
      } else {
        c.req.addValidatedData("json", body);
      }
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
let selectCallCount = 0;

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.groupBy = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.offset = vi.fn(self);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.values = mockInsertValues.mockReturnValue(chain);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = vi.fn(self);
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
  delete: vi.fn(() => makeDeleteChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

const sqlTaggedTemplate = Object.assign(
  (..._args: unknown[]) => ({
    as: () => "voteCount",
  }),
  {
    raw: vi.fn(),
  },
);

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: sqlTaggedTemplate,
}));

vi.mock("../../../db/schema", () => ({
  voteCandidates: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    month: "month",
    source: "source",
    createdAt: "createdAt",
  },
  votes: {
    id: "id",
    siteId: "siteId",
    month: "month",
    candidateId: "candidateId",
  },
  votePeriods: {
    id: "id",
    siteId: "siteId",
    month: "month",
    startDate: "startDate",
    endDate: "endDate",
  },
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    companyName: "companyName",
    tradeType: "tradeType",
  },
  auditLogs: {
    id: "id",
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
    reason: "reason",
  },
  sites: { id: "id", name: "name" },
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
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
  const { default: route } = await import("../votes");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/votes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("GET /votes/candidates", () => {
    it("returns candidates for site and month", async () => {
      mockAll.mockResolvedValueOnce([
        { id: "vc-1", user: { id: "u-1", nameMasked: "K**" } },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates?siteId=site-1&month=2025-01",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 when params missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/candidates", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 403 for WORKER", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/votes/candidates?siteId=s&month=2025-01",
        {},
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("POST /votes/candidates", () => {
    it("creates a new candidate", async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "vc-new", userId: "u-1" });
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "00000000-0000-0000-0000-000000000001",
            siteId: "00000000-0000-0000-0000-000000000002",
            month: "2025-01",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("continues when candidate audit insert fails", async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "vc-new", userId: "u-1" });
      mockDb.insert
        .mockImplementationOnce(() => makeInsertChain())
        .mockImplementationOnce(() => {
          throw new Error("audit insert failed");
        });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "00000000-0000-0000-0000-000000000001",
            siteId: "00000000-0000-0000-0000-000000000002",
            month: "2025-01",
          }),
        },
        env,
      );

      expect(res.status).toBe(201);
    });

    it("returns 409 for duplicate candidate", async () => {
      mockGet.mockResolvedValueOnce({ id: "vc-existing" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "00000000-0000-0000-0000-000000000001",
            siteId: "00000000-0000-0000-0000-000000000002",
            month: "2025-01",
          }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("returns 400 when required fields are missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "u-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid candidate schema payload", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "bad-user-id",
            siteId: "bad-site-id",
            month: "2025/01",
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });
  });

  describe("GET /votes/results", () => {
    it("returns vote results as JSON", async () => {
      mockAll.mockResolvedValueOnce([
        {
          candidateId: "vc-1",
          userId: "u-1",
          userName: "Kim",
          userNameMasked: "K**",
          userCompanyName: "Co",
          userTradeType: "Elec",
          voteCount: 5,
        },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/results?siteId=site-1&month=2025-01",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 when params missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/results", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid month format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/results?siteId=site-1&month=invalid",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns CSV when format=csv", async () => {
      mockAll.mockResolvedValueOnce([
        {
          candidateId: "vc-1",
          userId: "u-1",
          userName: "Kim",
          userNameMasked: "K**",
          userCompanyName: "Co",
          userTradeType: "Elec",
          voteCount: 5,
        },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/results?siteId=site-1&month=2025-01&format=csv",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/csv");
    });

    it("returns 400 for unsupported response format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/results?siteId=site-1&month=2025-01&format=xml",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("passes through null user fields without normalization", async () => {
      mockAll.mockResolvedValueOnce([
        {
          candidateId: "vc-1",
          userId: "u-1",
          userName: null,
          userNameMasked: null,
          userCompanyName: null,
          userTradeType: null,
          voteCount: 1,
        },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/results?siteId=site-1&month=2025-01",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ user: { nameMasked: string | null } }>;
      };
      expect(body.data[0].user.nameMasked).toBeNull();
    });
  });

  describe("DELETE /votes/candidates/:id", () => {
    it("deletes a candidate", async () => {
      mockGet.mockResolvedValueOnce({
        id: "vc-1",
        userId: "u-1",
        month: "2025-01",
      });
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates/vc-1",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 for unknown candidate", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates/unknown",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when id param is empty", async () => {
      const { default: route } = await import("../votes");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request(
        "/votes/candidates/vc-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("BAD_REQUEST");
    });

    it("returns success when audit log insert fails on delete", async () => {
      mockGet.mockResolvedValueOnce({
        id: "vc-1",
        userId: "u-1",
        month: "2025-01",
      });
      mockRun.mockResolvedValue(undefined);
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/candidates/vc-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("GET /votes/period/:siteId/:month", () => {
    it("returns 400 when siteId and month are empty", async () => {
      const { default: route } = await import("../votes");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = { DB: {} } as Record<string, unknown>;
      const res = await app.request("/votes/period/site-1/2025-01", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns vote period", async () => {
      mockGet.mockResolvedValueOnce({
        id: "vp-1",
        siteId: "site-1",
        month: "2025-01",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/period/site-1/2025-01", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 400 for invalid month", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/period/site-1/bad", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns null period when missing", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/period/site-1/2025-02", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { period: null } };
      expect(body.data.period).toBeNull();
    });
  });

  describe("PUT /votes/period/:siteId/:month", () => {
    it("returns 400 for invalid month format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/bad",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-31T23:59:59.000Z",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when startDate/endDate are missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: "2025-01-01T00:00:00.000Z" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid date format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: "bad", endDate: "bad" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when startDate is after endDate", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-01-31T00:00:00.000Z",
            endDate: "2025-01-01T00:00:00.000Z",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("updates existing vote period", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "vp-1",
          siteId: "site-1",
          month: "2025-01",
        })
        .mockResolvedValueOnce({
          id: "vp-1",
          siteId: "site-1",
          month: "2025-01",
        });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-31T23:59:59.000Z",
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("continues when vote period audit insert fails", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "vp-1",
          siteId: "site-1",
          month: "2025-01",
        })
        .mockResolvedValueOnce({
          id: "vp-1",
          siteId: "site-1",
          month: "2025-01",
        });
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-31T23:59:59.000Z",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("creates new vote period when missing", async () => {
      mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: "vp-2",
        siteId: "site-1",
        month: "2025-02",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-02",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-02-01T00:00:00.000Z",
            endDate: "2025-02-28T23:59:59.000Z",
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("returns 500 when period update/create returns null", async () => {
      mockGet.mockResolvedValueOnce({
        id: "vp-1",
        siteId: "site-1",
        month: "2025-01",
      });
      mockDb.update.mockImplementationOnce(() => {
        const chain = makeUpdateChain();
        chain.get = vi.fn().mockResolvedValueOnce(null);
        return chain;
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/period/site-1/2025-01",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2025-01-31T23:59:59.000Z",
          }),
        },
        env,
      );
      expect(res.status).toBe(500);
    });
  });

  describe("/votes/auto-nomination-config", () => {
    it("returns 400 when siteId is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/votes/auto-nomination-config", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 404 when site is not found", async () => {
      mockDb.select.mockImplementationOnce((_projection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/auto-nomination-config?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns site auto nomination config", async () => {
      mockDb.select.mockImplementationOnce((_projection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve([{ siteId: "site-1", autoNominationTopN: 5 }]),
            ),
          })),
        })),
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/auto-nomination-config?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 on patch when site does not exist", async () => {
      mockDb.select.mockImplementationOnce((_projection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/auto-nomination-config",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", topN: 3 }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("updates auto nomination config", async () => {
      mockDb.select.mockImplementationOnce((_projection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: "site-1" }])),
          })),
        })),
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/auto-nomination-config",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", topN: 7 }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns success when auto-nomination audit insert fails", async () => {
      mockDb.select.mockImplementationOnce((_projection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: "site-1" }])),
          })),
        })),
      }));
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/votes/auto-nomination-config",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            topN: 8,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });
});
