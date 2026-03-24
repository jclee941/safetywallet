import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { gte, lt } from "drizzle-orm";

const mockFasRealtimeStats = vi.fn();
const DEFAULT_FAS_SOURCE = {
  dbName: "mdidev",
  siteCd: "10",
  d1SiteName: "송도세브란스",
  workerIdPrefix: "",
};
vi.mock("../../../lib/fas", () => ({
  FAS_SOURCES: [DEFAULT_FAS_SOURCE],
  fasGetDailyAttendanceRealtimeStats: (...args: unknown[]) =>
    mockFasRealtimeStats(...args),
}));

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

const fixedStart = new Date("2026-02-19T05:00:00.000Z");
const fixedEnd = new Date("2026-02-20T05:00:00.000Z");
const mockGetTodayRange = vi.fn(() => ({
  start: fixedStart,
  end: fixedEnd,
}));

vi.mock("../helpers", () => ({
  requireAdmin: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  getTodayRange: mockGetTodayRange,
}));

const mockGet = vi.fn();
const mockAll = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.leftJoin = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.groupBy = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
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
  gte: vi.fn(),
  lt: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: { id: "id" },
  sites: { id: "id" },
  posts: {
    id: "id",
    category: "category",
    reviewStatus: "reviewStatus",
    isUrgent: "isUrgent",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
  },
  attendance: { checkinAt: "checkinAt" },
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
  const { default: statsRoute } = await import("../stats");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", statsRoute);
  const env = {
    DB: {},
    FAS_HYPERDRIVE: { connectionString: "postgres://test" },
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeChain());
    mockFasRealtimeStats.mockReset();
    mockFasRealtimeStats.mockResolvedValue({
      source: "FAS_REALTIME",
      totalRows: 10,
      checkedInWorkers: 5,
      dedupCheckinEvents: 8,
    });
  });

  describe("GET /stats", () => {
    it("returns dashboard stats", async () => {
      mockGet.mockResolvedValue({ count: 10, avgHours: 2.5 });
      mockAll.mockResolvedValue([
        { category: "HAZARD", count: 5 },
        { category: "SAFETY", count: 3 },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: Record<string, unknown> };
      };
      expect(body.data.stats).toBeDefined();
      expect(body.data.stats.totalUsers).toBeDefined();
      expect(body.data.stats.categoryDistribution).toBeDefined();
      expect(mockGetTodayRange).toHaveBeenCalledTimes(1);
      expect(gte).toHaveBeenCalledWith("createdAt", fixedStart);
      expect(lt).toHaveBeenCalledWith("createdAt", fixedEnd);
      expect(mockFasRealtimeStats).toHaveBeenCalledWith(
        expect.anything(),
        "20260219",
        "10",
        DEFAULT_FAS_SOURCE,
      );
    });

    it("handles empty data gracefully", async () => {
      mockGet.mockResolvedValue(null);
      mockAll.mockResolvedValue([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: Record<string, unknown> };
      };
      expect(body.data.stats.totalUsers).toBe(0);
    });

    it("returns 403 when SITE_ADMIN requests unmanaged site", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/stats?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 when SITE_ADMIN has WORKER role membership", async () => {
      mockGet.mockResolvedValueOnce({ role: "WORKER" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/stats?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns stats filtered by siteId for SUPER_ADMIN", async () => {
      mockGet.mockResolvedValue({ count: 5, avgHours: 1.0 });
      mockAll.mockResolvedValue([{ category: "HAZARD", count: 3 }]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/stats?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: Record<string, unknown> };
      };
      expect(body.data.stats).toBeDefined();
      expect(body.data.stats.totalUsers).toBeDefined();
    });

    it("falls back to 0 active users when FAS call throws", async () => {
      mockGet.mockResolvedValue({ count: 10, avgHours: 1.2 });
      mockAll.mockResolvedValue([]);
      mockFasRealtimeStats.mockRejectedValueOnce(new Error("fas down"));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: { activeUsersToday: number } };
      };
      expect(body.data.stats.activeUsersToday).toBe(0);
    });

    it("returns 0 active users when FAS_HYPERDRIVE is missing", async () => {
      mockGet.mockResolvedValue({ count: 10, avgHours: 1.2 });
      mockAll.mockResolvedValue([]);

      const { app, env } = await createApp(makeAuth());
      delete (env as { FAS_HYPERDRIVE?: unknown }).FAS_HYPERDRIVE;
      const res = await app.request("/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { stats: { activeUsersToday: number } };
      };
      expect(body.data.stats.activeUsersToday).toBe(0);
    });

    it("returns 0 active users when FAS_SOURCES is empty", async () => {
      mockGet.mockResolvedValue({ count: 10, avgHours: 1.2 });
      mockAll.mockResolvedValue([]);

      const { FAS_SOURCES } = await import("../../../lib/fas");
      const saved = (FAS_SOURCES as unknown[]).splice(0);
      try {
        const { app, env } = await createApp(makeAuth());
        const res = await app.request("/stats", {}, env);
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          data: { stats: { activeUsersToday: number } };
        };
        expect(body.data.stats.activeUsersToday).toBe(0);
      } finally {
        (FAS_SOURCES as unknown[]).push(...saved);
      }
    });
  });
});
