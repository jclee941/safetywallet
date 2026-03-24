import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

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

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: () => Promise<void>) => {
    c.set("auth", {
      user: {
        id: "admin-1",
        phone: "01012345678",
        role: "SUPER_ADMIN",
        name: "Admin",
        nameMasked: "Ad***",
      },
      loginDate: "2026-01-01",
    });
    await next();
  }),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

const mockFasRealtimeStats = vi.fn();
const mockFasCheckWorkerAttendance = vi.fn();
const mockFasGetDailyAttendance = vi.fn();
const DEFAULT_FAS_SOURCE = {
  dbName: "mdidev",
  siteCd: "10",
  d1SiteName: "송도세브란스",
  workerIdPrefix: "",
};
vi.mock("../../lib/fas", () => ({
  DEFAULT_FAS_SOURCE,
  resolveFasSource: vi.fn(() => DEFAULT_FAS_SOURCE),
  resolveFasSourceByWorkerId: vi.fn((externalWorkerId: string) => ({
    source: DEFAULT_FAS_SOURCE,
    rawEmplCd: externalWorkerId,
  })),
  fasGetDailyAttendanceRealtimeStats: (...args: unknown[]) =>
    mockFasRealtimeStats(...args),
  fasGetDailyAttendance: (...args: unknown[]) =>
    mockFasGetDailyAttendance(...args),
  fasCheckWorkerAttendance: (...args: unknown[]) =>
    mockFasCheckWorkerAttendance(...args),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("@hono/zod-validator", () => ({
  zValidator: () => {
    return async (_c: unknown, next: () => Promise<void>) => {
      await next();
    };
  },
}));

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : undefined;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function makeSelectChain() {
  const deferred = () => Promise.resolve(dequeueAll());
  const chain = Object.assign(deferred(), {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    get: vi.fn(() => dequeueGet()),
    all: vi.fn(() => dequeueAll()),
    as: vi.fn(),
    groupBy: vi.fn(),
  });
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.as.mockReturnValue(chain);
  chain.groupBy.mockReturnValue(chain);
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.get = vi.fn(() => undefined);
  chain.run = vi.fn(async () => ({ success: true }));
  chain.onConflictDoNothing = vi.fn(() => chain);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  attendance: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    externalWorkerId: "externalWorkerId",
    result: "result",
    source: "source",
    checkinAt: "checkinAt",
  },
  users: {
    id: "id",
    externalWorkerId: "externalWorkerId",
    name: "name",
    nameMasked: "nameMasked",
    deletedAt: "deletedAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  pointPolicies: {
    siteId: "siteId",
    reasonCode: "reasonCode",
    isActive: "isActive",
    defaultAmount: "defaultAmount",
  },
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    settleMonth: "settleMonth",
    occurredAt: "occurredAt",
  },
}));

vi.mock("../../utils/common", () => ({
  getTodayRange: vi.fn(() => ({
    start: new Date("2025-01-01T00:00:00Z"),
    end: new Date("2025-01-02T00:00:00Z"),
  })),
}));

function makeAuth(role = "WORKER", userId = "user-1"): AuthContext {
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

const mockKvGet = vi.fn();
const mockKvPut = vi.fn();

async function createApp(auth?: AuthContext) {
  const { default: attendanceRoute } = await import("../attendance");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/attendance", attendanceRoute);
  const env = {
    DB: {},
    KV: { get: mockKvGet, put: mockKvPut },
    FAS_HYPERDRIVE: { connectionString: "postgres://test" },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockFasRealtimeStats.mockReset();
    mockFasCheckWorkerAttendance.mockReset();
    mockFasGetDailyAttendance.mockReset();
  });

  describe("GET /attendance/today", () => {
    it("returns attendance records for today", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockResolvedValue({
        hasAttendance: true,
        records: [
          {
            emplCd: "FAS-001",
            accsDay: "20250101",
            inTime: "0830",
            outTime: "1730",
            state: 0,
            partCd: "P001",
          },
        ],
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(true);
      expect(body.data.records).toHaveLength(1);
    });

    it("returns hasAttendance=false when no SUCCESS records", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockResolvedValue({
        hasAttendance: false,
        records: [],
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(false);
    });

    it("returns empty when no records", async () => {
      mockGetQueue.push({ externalWorkerId: null });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(false);
      expect(body.data.records).toHaveLength(0);
    });

    it("returns 503 when FAS_HYPERDRIVE is missing", async () => {
      const { default: attendanceRoute } = await import("../attendance");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        await next();
      });
      app.route("/attendance", attendanceRoute);

      const env = {
        DB: {},
        KV: { get: mockKvGet, put: mockKvPut },
      } as Record<string, unknown>;

      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(503);
    });

    it("returns empty result when FAS check throws", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockRejectedValueOnce(new Error("fas down"));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasAttendance: boolean; records: unknown[] };
      };
      expect(body.data.hasAttendance).toBe(false);
      expect(body.data.records).toHaveLength(0);
    });
  });

  describe("GET /attendance/site/:siteId/report", () => {
    it("returns 400 when siteId parameter is missing", async () => {
      const { handleSiteReport } = await import("../attendance/routes");
      const response = await handleSiteReport({
        env: { DB: {}, KV: { get: mockKvGet, put: mockKvPut } },
        get: vi.fn(() => makeAuth("SUPER_ADMIN", "admin-1")),
        req: {
          param: vi.fn(() => ""),
          query: vi.fn(() => undefined),
        },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
      } as unknown as Parameters<typeof handleSiteReport>[0]);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("BAD_REQUEST");
    });

    it("returns 403 when non-site-admin requests site report", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("WORKER", "worker-1"));
        await next();
      });

      mockGetQueue.push(null);

      const { app, env } = await createApp();
      const res = await app.request("/attendance/site/site-1/report", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 503 when FAS binding is unavailable", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      const { app } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request("/attendance/site/site-1/report", {}, {
        DB: {},
        KV: { get: mockKvGet, put: mockKvPut },
      } as Record<string, unknown>);
      expect(res.status).toBe(503);
    });

    it("returns seven-day site report with linked users", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      mockFasGetDailyAttendance.mockResolvedValue([
        {
          accsDay: "20250101",
          emplCd: "E001",
          inTime: "0830",
          outTime: "1730",
        },
      ]);
      mockAllQueue.push([
        {
          id: "user-1",
          externalWorkerId: "E001",
          name: "Kim",
          nameMasked: "K**",
        },
      ]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request(
        "/attendance/site/site-1/report?source=mdidev",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{
          date: string;
          records: Array<{ userId: string | null }>;
        }>;
      };
      expect(body.data).toHaveLength(7);
      expect(body.data.some((day) => day.records.length > 0)).toBe(true);
    });
  });

  describe("POST /attendance/sync", () => {
    it("returns 403 for non-admin sync requests", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("WORKER", "worker-1"));
        await next();
      });

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: [] }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for missing events array", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        },
        env,
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_JSON");
    });

    it("inserts new attendance events successfully", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          processed: number;
          inserted: number;
          skipped: number;
          failed: number;
        };
      };
      expect(body.data.processed).toBe(1);
      expect(body.data.inserted).toBe(1);
      expect(body.data.skipped).toBe(0);
      expect(body.data.failed).toBe(0);
    });

    it("skips duplicate attendance events", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      const checkinTime = new Date("2025-01-01T08:00:00Z");
      mockAllQueue.push([
        {
          workerId: "FAS-001",
          siteId: "site-1",
          checkinAt: checkinTime,
        },
      ]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: checkinTime.toISOString(),
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number; skipped: number };
      };
      expect(body.data.skipped).toBe(1);
      expect(body.data.inserted).toBe(0);
    });

    it("fails when user not found for fasUserId", async () => {
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "NONEXISTENT",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.results[0].result).toBe("NOT_FOUND");
    });

    it("fails when event has no siteId", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.results[0].result).toBe("MISSING_SITE");
    });

    it("returns cached response for duplicate idempotency key", async () => {
      const cached = {
        processed: 1,
        inserted: 1,
        skipped: 0,
        failed: 0,
        results: [],
      };
      mockKvGet.mockResolvedValue(JSON.stringify(cached));

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-123",
          },
          body: JSON.stringify({ events: [] }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: typeof cached };
      expect(body.data.processed).toBe(1);
    });

    it("stores response in KV when idempotency key is provided", async () => {
      mockKvGet.mockResolvedValue(null);
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "idem-new",
          },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "NONEXISTENT",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(mockKvPut).toHaveBeenCalledWith(
        "attendance:idempotency:idem-new",
        expect.any(String),
        { expirationTtl: 3600 },
      );
    });

    it("handles batch insert failure gracefully", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked).mockRejectedValueOnce(
        new Error("DB batch error"),
      );

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { failed: number };
      };
      expect(body.data.failed).toBe(1);
    });

    it("keeps sync successful when point auto-award fails", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);
      mockAllQueue.push([
        {
          siteId: "site-1",
          reasonCode: "ATTENDANCE_CHECK_IN",
          isActive: true,
          defaultAmount: 10,
        },
      ]);
      mockAllQueue.push([]);

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked)
        .mockResolvedValueOnce({
          totalOps: 1,
          completedOps: 1,
          failedChunks: 0,
          errors: [],
        })
        .mockRejectedValueOnce(new Error("points insert failed"));

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-point-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number; failed: number };
      };
      expect(body.data.inserted).toBe(1);
      expect(body.data.failed).toBe(0);
    });

    it("handles multiple events with mixed results", async () => {
      mockAllQueue.push([
        { id: "user-1", externalWorkerId: "FAS-001" },
        { id: "user-2", externalWorkerId: "FAS-002" },
      ]);
      mockAllQueue.push([]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
              {
                fasEventId: "evt-2",
                fasUserId: "FAS-002",
                checkinAt: "2025-01-01T09:00:00Z",
              },
              {
                fasEventId: "evt-3",
                fasUserId: "UNKNOWN",
                checkinAt: "2025-01-01T10:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          processed: number;
          inserted: number;
          failed: number;
          results: Array<{ fasEventId: string; result: string }>;
        };
      };
      expect(body.data.processed).toBe(3);
      expect(body.data.inserted).toBe(1);
      expect(body.data.failed).toBe(2);
    });
  });

  describe("GET /attendance/realtime", () => {
    it("returns real-time stats from FAS MariaDB", async () => {
      mockFasRealtimeStats.mockResolvedValue({
        source: "access_daily+access+access_history",
        totalRows: 150,
        checkedInWorkers: 120,
        dedupCheckinEvents: 140,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/realtime", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          date: string;
          siteCd: string;
          siteName: string;
          source: string;
          realtimeDataSource: string;
          checkedInWorkers: number;
          metric: { key: string; definition: string };
          queriedAt: string;
        };
      };
      expect(body.data.checkedInWorkers).toBe(120);
      expect(body.data.siteCd).toBe("10");
      expect(body.data.siteName).toBe("송도세브란스");
      expect(body.data.source).toBe("mdidev");
      expect(body.data.realtimeDataSource).toBe(
        "access_daily+access+access_history",
      );
      expect(body.data.metric.key).toBe("checkedInWorkers");
      expect(body.data.queriedAt).toBeDefined();
    });

    it("accepts date query parameter in YYYYMMDD format", async () => {
      mockFasRealtimeStats.mockResolvedValue({
        source: "access_daily+access+access_history",
        totalRows: 50,
        checkedInWorkers: 40,
        dedupCheckinEvents: 45,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/realtime?date=20250221",
        {},
        env,
      );
      expect(res.status).toBe(200);
      expect(mockFasRealtimeStats).toHaveBeenCalledWith(
        expect.anything(),
        "20250221",
        "10",
        DEFAULT_FAS_SOURCE,
      );
    });

    it("accepts date query parameter in YYYY-MM-DD format", async () => {
      mockFasRealtimeStats.mockResolvedValue({
        source: "test",
        totalRows: 0,
        checkedInWorkers: 0,
        dedupCheckinEvents: 0,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/realtime?date=2025-02-21",
        {},
        env,
      );
      expect(res.status).toBe(200);
      expect(mockFasRealtimeStats).toHaveBeenCalledWith(
        expect.anything(),
        "20250221",
        "10",
        DEFAULT_FAS_SOURCE,
      );
    });

    it("returns 400 for invalid date format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/realtime?date=abc", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 503 when FAS_HYPERDRIVE is not configured", async () => {
      const { default: attendanceRoute } = await import("../attendance");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        await next();
      });
      app.route("/attendance", attendanceRoute);
      const env = {
        DB: {},
        KV: { get: mockKvGet, put: mockKvPut },
      } as Record<string, unknown>;
      const res = await app.request("/attendance/realtime", {}, env);
      expect(res.status).toBe(503);
    });

    it("returns 500 when FAS query fails", async () => {
      mockFasRealtimeStats.mockRejectedValue(new Error("Connection refused"));
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/realtime", {}, env);
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FAS_QUERY_FAILED");
    });
  });

  describe("formatting edge cases", () => {
    it("returns null checkin/checkout for missing times", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockResolvedValueOnce({
        hasAttendance: true,
        records: [
          {
            emplCd: "FAS-001",
            accsDay: "20250101",
            inTime: null,
            outTime: null,
          },
        ],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/today", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          records: Array<{
            checkinAt: string | null;
            checkoutAt: string | null;
          }>;
        };
      };
      expect(body.data.records[0].checkinAt).toBeNull();
      expect(body.data.records[0].checkoutAt).toBeNull();
    });

    it("ignores linked users missing externalWorkerId in report map", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      mockFasGetDailyAttendance.mockResolvedValue([
        {
          accsDay: "20250101",
          emplCd: "E001",
          inTime: "0800",
          outTime: "1700",
        },
      ]);
      mockAllQueue.push([
        { id: "u-1", externalWorkerId: null, name: "NoExt", nameMasked: "N**" },
      ]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request("/attendance/site/site-1/report", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns empty records when FAS returns no rows for any day", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      mockFasGetDailyAttendance.mockResolvedValue([]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request("/attendance/site/site-1/report", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ date: string; records: unknown[] }>;
      };
      expect(body.data).toHaveLength(7);
      expect(body.data.every((day) => day.records.length === 0)).toBe(true);
    });

    it("falls back to emplCd when linked user has no name or nameMasked", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      mockFasGetDailyAttendance.mockResolvedValue([
        {
          accsDay: "20250101",
          emplCd: "E999",
          inTime: "0900",
          outTime: "1800",
        },
      ]);
      // No linked users found
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request("/attendance/site/site-1/report", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{
          date: string;
          records: Array<{ userName: string; userId: string | null }>;
        }>;
      };
      const dayWithRecords = body.data.find((d) => d.records.length > 0);
      expect(dayWithRecords).toBeDefined();
      expect(dayWithRecords!.records[0].userName).toBe("E999");
      expect(dayWithRecords!.records[0].userId).toBeNull();
    });

    it("uses nameMasked when linked user has no name", async () => {
      const { authMiddleware } = await import("../../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (c, next) => {
        c.set("auth", makeAuth("SUPER_ADMIN", "admin-1"));
        await next();
      });

      mockFasGetDailyAttendance.mockResolvedValue([
        {
          accsDay: "20250101",
          emplCd: "E010",
          inTime: "0800",
          outTime: null,
        },
      ]);
      mockAllQueue.push([]);
      mockAllQueue.push([
        {
          id: "user-masked",
          externalWorkerId: "E010",
          name: null,
          nameMasked: "K**",
        },
      ]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN", "admin-1"));
      const res = await app.request("/attendance/site/site-1/report", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{
          records: Array<{ userName: string }>;
        }>;
      };
      const dayWithRecords = body.data.find((d) => d.records.length > 0);
      expect(dayWithRecords!.records[0].userName).toBe("K**");
    });
  });

  describe("POST /attendance/sync — edge cases", () => {
    it("handles empty events array with zero processing", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: [] }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          processed: number;
          inserted: number;
          skipped: number;
          failed: number;
        };
      };
      expect(body.data.processed).toBe(0);
      expect(body.data.inserted).toBe(0);
      expect(body.data.skipped).toBe(0);
      expect(body.data.failed).toBe(0);
    });

    it("skips user mapping when user record has null externalWorkerId", async () => {
      // User exists in DB but externalWorkerId is null
      mockAllQueue.push([{ id: "user-no-ext", externalWorkerId: null }]);
      mockAllQueue.push([]); // existing attendance

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-NO-EXT",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { failed: number; results: Array<{ result: string }> };
      };
      // User with null externalWorkerId is not added to userMap, so fasUserId lookup fails
      expect(body.data.failed).toBe(1);
      expect(body.data.results[0].result).toBe("NOT_FOUND");
    });

    it("skips existing attendance records with null fields", async () => {
      // User found
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      // Existing attendance has record with null workerId (covers line 140 false)
      mockAllQueue.push([
        {
          workerId: null,
          siteId: "site-1",
          checkinAt: new Date("2025-01-01T08:00:00Z"),
        },
      ]);

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number };
      };
      // Record with null workerId is not added to existingSet, so event is inserted
      expect(body.data.inserted).toBe(1);
    });

    it("handles batch insert non-Error throw gracefully", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]);

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked).mockRejectedValueOnce("string batch error");

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { failed: number };
      };
      expect(body.data.failed).toBe(1);
    });

    it("auto-award skips points when all eligible pairs already awarded today", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]); // no existing attendance duplicates
      // Policies: active ATTENDANCE_CHECK_IN for site-1
      mockAllQueue.push([
        {
          siteId: "site-1",
          reasonCode: "ATTENDANCE_CHECK_IN",
          isActive: true,
          defaultAmount: 10,
        },
      ]);
      // Existing awards: user-1 already awarded today
      mockAllQueue.push([{ userId: "user-1", siteId: "site-1" }]);

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked).mockResolvedValueOnce({
        totalOps: 1,
        completedOps: 1,
        failedChunks: 0,
        errors: [],
      });
      // Second dbBatchChunked should NOT be called (pointInserts empty)

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-award-1",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number; failed: number };
      };
      expect(body.data.inserted).toBe(1);
      expect(body.data.failed).toBe(0);
      // Only one dbBatchChunked call (attendance insert), not two
      expect(vi.mocked(dbBatchChunked)).toHaveBeenCalledTimes(1);
    });

    it("auto-award skips records with no matching policy for site", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]); // no existing attendance duplicates
      // Policy exists for a DIFFERENT site
      mockAllQueue.push([
        {
          siteId: "other-site",
          reasonCode: "ATTENDANCE_CHECK_IN",
          isActive: true,
          defaultAmount: 5,
        },
      ]);
      // No existing awards query needed (eligiblePairs will be empty)

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked).mockResolvedValueOnce({
        totalOps: 1,
        completedOps: 1,
        failedChunks: 0,
        errors: [],
      });

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-nopolicy",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(dbBatchChunked)).toHaveBeenCalledTimes(1);
    });

    it("auto-award catches non-Error point award failure", async () => {
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "FAS-001" }]);
      mockAllQueue.push([]); // no existing attendance
      mockAllQueue.push([
        {
          siteId: "site-1",
          reasonCode: "ATTENDANCE_CHECK_IN",
          isActive: true,
          defaultAmount: 10,
        },
      ]);
      mockAllQueue.push([]); // no existing awards

      const { dbBatchChunked } = await import("../../db/helpers");
      vi.mocked(dbBatchChunked)
        .mockResolvedValueOnce({
          totalOps: 1,
          completedOps: 1,
          failedChunks: 0,
          errors: [],
        })
        .mockRejectedValueOnce("string point error"); // non-Error

      const { app, env } = await createApp();
      const res = await app.request(
        "/attendance/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: [
              {
                fasEventId: "evt-npe",
                fasUserId: "FAS-001",
                checkinAt: "2025-01-01T08:00:00Z",
                siteId: "site-1",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { inserted: number; failed: number };
      };
      expect(body.data.inserted).toBe(1);
      expect(body.data.failed).toBe(0);
    });
  });

  describe("handleToday — FAS error with log available", () => {
    it("logs Error details when FAS check throws and c.var.log exists", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockRejectedValueOnce(
        new Error("conn timeout"),
      );

      const mockWarn = vi.fn();
      const { handleToday } = await import("../attendance/routes");
      const response = await handleToday({
        env: {
          DB: {},
          FAS_HYPERDRIVE: { connectionString: "postgres://test" },
        },
        get: vi.fn(() => makeAuth()),
        var: {
          log: {
            warn: mockWarn,
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
        req: { param: vi.fn(), query: vi.fn() },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
      } as unknown as Parameters<typeof handleToday>[0]);

      expect(response.status).toBe(200);
      expect(mockWarn).toHaveBeenCalledWith(
        "FAS attendance query failed, returning empty",
        expect.objectContaining({
          error: { name: "Error", message: "conn timeout" },
        }),
      );
    });

    it("logs non-Error details when FAS check throws string", async () => {
      mockGetQueue.push({ externalWorkerId: "FAS-001" });
      mockFasCheckWorkerAttendance.mockRejectedValueOnce("string fas error");

      const mockWarn = vi.fn();
      const { handleToday } = await import("../attendance/routes");
      const response = await handleToday({
        env: {
          DB: {},
          FAS_HYPERDRIVE: { connectionString: "postgres://test" },
        },
        get: vi.fn(() => makeAuth()),
        var: {
          log: {
            warn: mockWarn,
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
        req: { param: vi.fn(), query: vi.fn() },
        json: (payload: unknown, status = 200) =>
          new Response(JSON.stringify(payload), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
      } as unknown as Parameters<typeof handleToday>[0]);

      expect(response.status).toBe(200);
      expect(mockWarn).toHaveBeenCalledWith(
        "FAS attendance query failed, returning empty",
        expect.objectContaining({
          error: { name: "UnknownError", message: "string fas error" },
        }),
      );
    });
  });

  describe("GET /attendance/realtime — non-Error throw", () => {
    it("handles non-Error FAS query failure", async () => {
      mockFasRealtimeStats.mockRejectedValue("non-error rejection");
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/realtime", {}, env);
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FAS_QUERY_FAILED");
    });
  });
});
