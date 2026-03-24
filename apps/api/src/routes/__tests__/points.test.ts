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

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async () => {}),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          raw: Request;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      if (_target === "query") {
        const url = new URL(c.req.raw.url);
        const queryObj: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          queryObj[k] = v;
        });
        c.req.addValidatedData("query", queryObj);
      } else {
        const cloned = c.req.raw.clone();
        try {
          const body = await cloned.json();
          c.req.addValidatedData("json", body);
        } catch {
          c.req.addValidatedData("json", {});
        }
      }
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockInsertGet = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.leftJoin = vi.fn(proxy);
  chain.innerJoin = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.groupBy = vi.fn(proxy);
  chain.having = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.as = vi.fn(() => "subquery");
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => ({
        get: mockInsertGet,
      })),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    settleMonth: "settleMonth",
    adminId: "adminId",
    createdAt: "createdAt",
  },
  pointPolicies: {
    id: "id",
    siteId: "siteId",
    reasonCode: "reasonCode",
    isActive: "isActive",
    defaultAmount: "defaultAmount",
  },
  sites: { id: "id", leaderboardEnabled: "leaderboardEnabled" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
  },
  users: { id: "id", nameMasked: "nameMasked" },
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
  const { default: pointsRoute } = await import("../points");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/points", pointsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

const SITE_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";

describe("routes/points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockAll.mockReset();
    mockInsertGet.mockReset();
    mockDb.select.mockImplementation(() => makeChain());
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: mockInsertGet,
        })),
      })),
    }));
  });

  describe("POST /points/award", () => {
    const validBody = {
      userId: USER_ID,
      siteId: SITE_ID,
      amount: 100,
      reasonCode: "MANUAL_AWARD",
    };

    it("awards points as SUPER_ADMIN", async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: USER_ID, status: "ACTIVE" })
        .mockResolvedValueOnce({ defaultAmount: 50 })
        .mockResolvedValueOnce({ id: USER_ID, nameMasked: "Te**" });
      mockInsertGet.mockResolvedValue({
        id: "entry-1",
        ...validBody,
        amount: 50,
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 for non-admin worker", async () => {
      mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 100 }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when target user is not active site member", async () => {
      mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when resolvedAmount is not a number (no policy and no amount)", async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: USER_ID, status: "ACTIVE" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/points/award",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: USER_ID,
            siteId: SITE_ID,
            reasonCode: "MANUAL_AWARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MISSING_REQUIRED_FIELDS");
    });
  });

  describe("GET /points/balance", () => {
    it("returns balance for site member", async () => {
      const getMock1 = vi
        .fn()
        .mockResolvedValue({ userId: "user-1", status: "ACTIVE" });
      const getMock2 = vi.fn().mockResolvedValue({ total: 250 });
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        const chain: Record<string, unknown> = {};
        const proxy = (): Record<string, unknown> => chain;
        chain.from = vi.fn(proxy);
        chain.leftJoin = vi.fn(proxy);
        chain.innerJoin = vi.fn(proxy);
        chain.where = vi.fn(proxy);
        chain.orderBy = vi.fn(proxy);
        chain.groupBy = vi.fn(proxy);
        chain.having = vi.fn(proxy);
        chain.limit = vi.fn(proxy);
        chain.offset = vi.fn(proxy);
        chain.as = vi.fn(() => "subquery");
        chain.get = selectCallCount === 1 ? getMock1 : getMock2;
        chain.all = mockAll;
        return chain;
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/balance?siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { balance: number } };
      expect(body.data.balance).toBe(250);
    });

    it("returns 403 when siteId missing (no membership match)", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/points/balance", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-member", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/balance?siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /points/history", () => {
    it("returns own history", async () => {
      mockAll.mockResolvedValue([
        { id: "e1", amount: 100, reasonCode: "SAFETY" },
      ]);
      mockGet.mockResolvedValue({ count: 1 });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/points/history", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { entries: unknown[]; total: number };
      };
      expect(body.data.entries).toHaveLength(1);
    });

    it("returns 400 for invalid query params", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/points/history?siteId=not-a-uuid",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for non-admin viewing other user without siteId", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/history?userId=${USER_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when non-super-admin without admin membership views other user", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER", "user-self"));
      const res = await app.request(
        `/points/history?userId=${USER_ID}&siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when requester is not site member for filtered site history", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request(
        `/points/history?siteId=${SITE_ID}`,
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns paginated history with explicit limit and offset", async () => {
      mockGet
        .mockResolvedValueOnce({
          userId: "user-1",
          siteId: SITE_ID,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({
          userId: "user-1",
          siteId: SITE_ID,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([{ id: "entry-1", amount: 10 }]);

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        `/points/history?siteId=${SITE_ID}&limit=10&offset=5`,
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          entries: unknown[];
          total: number;
          limit: number;
          offset: number;
        };
      };
      expect(body.data.entries).toHaveLength(1);
      expect(body.data.total).toBe(1);
      expect(body.data.limit).toBe(10);
      expect(body.data.offset).toBe(5);
    });
  });

  describe("GET /points", () => {
    it("returns 403 when siteId is missing (no membership match)", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/points", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 when user is not active site member", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points?siteId=${SITE_ID}`, {}, env);
      expect(res.status).toBe(403);
    });

    it("returns balance and latest history", async () => {
      mockGet
        .mockResolvedValueOnce({
          userId: "user-1",
          siteId: SITE_ID,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({ total: 250 });
      mockAll.mockResolvedValueOnce([
        { id: "e1", amount: 100, reasonCode: "MANUAL_AWARD" },
      ]);

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(`/points?siteId=${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { balance: number; history: unknown[] };
      };
      expect(body.data.balance).toBe(250);
      expect(body.data.history).toHaveLength(1);
    });
  });

  describe("GET /points/leaderboard/:siteId", () => {
    it("returns leaderboard for site with leaderboard enabled", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: true })
        .mockResolvedValueOnce({ userId: "user-1", status: "ACTIVE" });
      mockAll
        .mockResolvedValueOnce([
          { userId: "user-1", total: 500 },
          { userId: "user-2", total: 300 },
        ])
        .mockResolvedValueOnce([
          { id: "user-1", nameMasked: "Te**" },
          { id: "user-2", nameMasked: "Us**" },
        ]);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { leaderboard: unknown[] } };
      expect(body.data.leaderboard).toHaveLength(2);
    });

    it("returns 404 when site not found", async () => {
      mockGet.mockResolvedValue(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-member when leaderboard disabled", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: false })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 when leaderboard enabled but requester is not active member", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: true })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(`/points/leaderboard/${SITE_ID}`, {}, env);
      expect(res.status).toBe(403);
    });

    it("returns monthly leaderboard and computes myRank when current user is outside top list", async () => {
      mockGet
        .mockResolvedValueOnce({ leaderboardEnabled: true })
        .mockResolvedValueOnce({
          userId: "user-1",
          siteId: SITE_ID,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({ total: 120 })
        .mockResolvedValueOnce({ count: 3 });

      mockAll
        .mockResolvedValueOnce([
          { userId: "user-2", total: 500 },
          { userId: "user-3", total: 300 },
        ])
        .mockResolvedValueOnce([
          { id: "user-2", nameMasked: "U2**" },
          { id: "user-3", nameMasked: "U3**" },
        ]);

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        `/points/leaderboard/${SITE_ID}?type=monthly&limit=2`,
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { leaderboard: Array<{ userId: string }>; myRank: number | null };
      };
      expect(body.data.leaderboard).toHaveLength(2);
      expect(body.data.myRank).toBe(4);
    });
  });

  describe("GET /points/ranking/:siteId", () => {
    it("redirects to leaderboard endpoint with same query string", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        `/points/ranking/${SITE_ID}?limit=5`,
        {},
        env,
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain(
        `/api/points/leaderboard/${SITE_ID}?limit=5`,
      );
    });
  });
});
