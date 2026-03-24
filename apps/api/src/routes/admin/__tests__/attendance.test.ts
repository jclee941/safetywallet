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

const mockFasGetAttendanceList = vi.fn();
const mockFasGetDailyAttendance = vi.fn();
const DEFAULT_FAS_SOURCE = {
  dbName: "mdidev",
  siteCd: "10",
  d1SiteName: "송도세브란스",
  workerIdPrefix: "",
};
vi.mock("../../../lib/fas", () => ({
  resolveFasSource: vi.fn(() => DEFAULT_FAS_SOURCE),
  fasGetAttendanceList: (...args: unknown[]) =>
    mockFasGetAttendanceList(...args),
  fasGetDailyAttendance: (...args: unknown[]) =>
    mockFasGetDailyAttendance(...args),
}));

const mockGet = vi.fn();
let thenableResults: unknown[] = [];
let thenableIndex = 0;
let selectCallCount = 0;

function makeChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.offset = vi.fn(self);
  chain.get = mockGet;
  return chain;
}

function makeThenableChain(): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        const result = thenableResults[thenableIndex] ?? [];
        thenableIndex++;
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

const mockDb = {
  select: vi.fn(() => makeThenableChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  attendance: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    externalWorkerId: "externalWorkerId",
    checkinAt: "checkinAt",
    result: "result",
    source: "source",
    createdAt: "createdAt",
  },
  users: { id: "id", nameMasked: "nameMasked" },
  sites: { id: "id", name: "name" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
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
  const { default: attendanceRoute } = await import("../attendance");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", attendanceRoute);
  const env = {
    DB: {},
    FAS_HYPERDRIVE: { connectionString: "postgres://test" },
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thenableIndex = 0;
    thenableResults = [];
    selectCallCount = 0;
    mockDb.select.mockImplementation(() => makeThenableChain());
    mockFasGetAttendanceList.mockReset();
    mockFasGetDailyAttendance.mockReset();
  });

  describe("GET /attendance-logs", () => {
    it("returns attendance logs with pagination", async () => {
      thenableResults = [
        [{ id: "user-1", externalWorkerId: "EXT-001", nameMasked: "Kim**" }],
      ];
      mockFasGetAttendanceList.mockResolvedValue({
        total: 1,
        records: [
          {
            emplCd: "EXT-001",
            name: "김철수",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0830",
            outTime: "1730",
            accsDay: "20260220",
          },
        ],
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          logs: unknown[];
          requestedSource: string;
          requestedSiteCd: string;
          requestedSiteName: string;
          metric: { key: string; definition: string };
          pagination: { total: number };
        };
      };
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.pagination.total).toBe(1);
      expect(body.data.requestedSource).toBe("mdidev");
      expect(body.data.requestedSiteCd).toBe("10");
      expect(body.data.requestedSiteName).toBe("송도세브란스");
      expect(body.data.metric.key).toBe("totalLogs");
      expect(mockFasGetAttendanceList).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        "10",
        100,
        0,
        DEFAULT_FAS_SOURCE,
      );
    });

    it("returns 400 when siteId is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid query params", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance-logs?siteId=site-1&limit=0",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 503 when hyperdrive binding is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      delete env.FAS_HYPERDRIVE;

      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(503);
    });

    it("returns 403 for WORKER role", async () => {
      selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          const chain = makeChain();
          mockGet.mockResolvedValueOnce(null);
          return chain;
        }
        return makeThenableChain();
      });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("applies KST date range filter when date is provided", async () => {
      thenableResults = [[]];
      mockFasGetAttendanceList.mockResolvedValue({ total: 0, records: [] });
      const { app, env } = await createApp(makeAuth());

      const res = await app.request(
        "/attendance-logs?siteId=site-1&date=2026-02-20",
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(mockFasGetAttendanceList).toHaveBeenCalledWith(
        expect.anything(),
        "20260220",
        "10",
        100,
        0,
        DEFAULT_FAS_SOURCE,
      );
    });

    it("returns 400 for unsupported date format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance-logs?siteId=site-1&date=2026/02/20",
        {},
        env,
      );

      expect(res.status).toBe(400);
    });

    it("falls back to daily attendance query when attendance list fails", async () => {
      thenableResults = [
        [{ id: "user-1", externalWorkerId: "EXT-001", nameMasked: "Kim**" }],
      ];
      mockFasGetAttendanceList.mockRejectedValueOnce(new Error("sql fail"));
      mockFasGetDailyAttendance.mockResolvedValueOnce([
        {
          emplCd: "EXT-001",
          accsDay: "20260220",
          inTime: "0830",
          outTime: "1730",
          state: 0,
          partCd: "P001",
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance-logs?siteId=site-1&date=2026-02-20&limit=50&page=1",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          logs: Array<{ userName: string | null }>;
          pagination: { total: number };
        };
      };
      expect(body.data.pagination.total).toBe(1);
      expect(body.data.logs).toHaveLength(1);
      expect(body.data.logs[0]?.userName).toBe("Kim**");
      expect(mockFasGetDailyAttendance).toHaveBeenCalledWith(
        expect.anything(),
        "20260220",
        "10",
        DEFAULT_FAS_SOURCE,
      );
    });

    it("returns empty result immediately for FAIL filter", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance-logs?siteId=site-1&result=FAIL&limit=20&page=2",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          logs: unknown[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      };
      expect(body.data.logs).toHaveLength(0);
      expect(body.data.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
      expect(mockFasGetAttendanceList).not.toHaveBeenCalled();
    });

    it("uses source row name when linked user is missing", async () => {
      thenableResults = [[]];
      mockFasGetAttendanceList.mockResolvedValueOnce({
        total: 1,
        records: [
          {
            emplCd: "EXT-404",
            name: "원본 이름",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0830",
            outTime: "1730",
            accsDay: "20260220",
          },
        ],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        data: { logs: Array<{ userName: string | null }> };
      };
      expect(body.data.logs[0]?.userName).toBe("원본 이름");
    });

    it("ignores linked users with null externalWorkerId in attendance logs", async () => {
      thenableResults = [
        [{ id: "user-1", externalWorkerId: null, nameMasked: "Kim**" }],
      ];
      mockFasGetAttendanceList.mockResolvedValueOnce({
        total: 1,
        records: [
          {
            emplCd: "EXT-404",
            name: "연결 없음",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0830",
            outTime: "1730",
            accsDay: "20260220",
          },
        ],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance-logs?siteId=site-1", {}, env);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        data: {
          logs: Array<{ userName: string | null; userId: string | null }>;
        };
      };
      expect(body.data.logs[0]?.userName).toBe("연결 없음");
      expect(body.data.logs[0]?.userId).toBeNull();
    });
  });

  describe("GET /attendance/unmatched", () => {
    it("returns unmatched attendance records", async () => {
      thenableResults = [[{ externalWorkerId: "EXT-001" }]];
      mockFasGetAttendanceList.mockResolvedValue({
        total: 2,
        records: [
          {
            emplCd: "EXT-001",
            name: "김철수",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0830",
            outTime: "1730",
            accsDay: "20260220",
          },
          {
            emplCd: "EXT-002",
            name: "이영희",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0900",
            outTime: "1800",
            accsDay: "20260220",
          },
        ],
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          records: unknown[];
          requestedSource: string;
          requestedSiteCd: string;
          requestedSiteName: string;
          metric: { key: string; definition: string };
          pagination: { total: number };
        };
      };
      expect(body.data.records).toHaveLength(1);
      expect(body.data.pagination.total).toBe(1);
      expect(body.data.requestedSource).toBe("mdidev");
      expect(body.data.requestedSiteCd).toBe("10");
      expect(body.data.requestedSiteName).toBe("송도세브란스");
      expect(body.data.metric.key).toBe("unmatchedLogs");
    });

    it("returns 400 when siteId is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/attendance/unmatched", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 503 for unmatched route when hyperdrive is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      delete env.FAS_HYPERDRIVE;
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 400 for unmatched route invalid date format", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1&date=2026/02/20",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("falls back to daily attendance when list query fails", async () => {
      thenableResults = [[{ externalWorkerId: "EXT-001" }]];
      mockFasGetAttendanceList.mockRejectedValueOnce(new Error("sql fail"));
      mockFasGetDailyAttendance.mockResolvedValueOnce([
        {
          emplCd: "EXT-001",
          accsDay: "20260220",
          inTime: "0830",
          outTime: "1730",
          state: 0,
          partCd: "P001",
        },
        {
          emplCd: "EXT-002",
          accsDay: "20260220",
          inTime: "0900",
          outTime: "1800",
          state: 0,
          partCd: "P001",
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1&date=2026-02-20",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          records: Array<{ externalWorkerId: string }>;
          pagination: { total: number };
        };
      };
      expect(body.data.pagination.total).toBe(1);
      expect(body.data.records).toHaveLength(1);
      expect(body.data.records[0]?.externalWorkerId).toBe("EXT-002");
      expect(mockFasGetDailyAttendance).toHaveBeenCalledWith(
        expect.anything(),
        "20260220",
        "10",
        DEFAULT_FAS_SOURCE,
      );
    });

    it("returns empty unmatched result when no source rows exist", async () => {
      thenableResults = [];
      mockFasGetAttendanceList.mockResolvedValueOnce({
        total: 0,
        records: [],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { records: unknown[]; pagination: { total: number } };
      };
      expect(body.data.records).toHaveLength(0);
      expect(body.data.pagination.total).toBe(0);
    });

    it("ignores null externalWorkerId rows when building unmatched linked set", async () => {
      thenableResults = [[{ externalWorkerId: null }]];
      mockFasGetAttendanceList.mockResolvedValueOnce({
        total: 1,
        records: [
          {
            emplCd: "EXT-777",
            name: "미매칭 사용자",
            partCd: "P001",
            companyName: "제일건설",
            inTime: "0830",
            outTime: "1730",
            accsDay: "20260220",
          },
        ],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/attendance/unmatched?siteId=site-1",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          records: Array<{ externalWorkerId: string }>;
          pagination: { total: number };
        };
      };
      expect(body.data.pagination.total).toBe(1);
      expect(body.data.records[0]?.externalWorkerId).toBe("EXT-777");
    });
  });
});
