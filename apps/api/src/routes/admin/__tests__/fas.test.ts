import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  fasGetAllEmployeesPaginated,
  fasGetDailyAttendanceRawRows,
  fasGetDailyAttendanceRawSummary,
  fasSearchEmployeeByName,
  fasSearchEmployeeByPhone,
} from "../../../lib/fas";
import type { FasEmployee } from "../../../lib/fas/types";
import {
  syncFasEmployeesToD1,
  deactivateRetiredEmployees,
} from "../../../lib/fas-sync";

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
      const cloned = c.req.raw.clone();
      const body = await cloned.json();
      c.req.addValidatedData("json", body);
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockInsertValues = vi.fn();

function makeFasEmployee(overrides: Partial<FasEmployee> = {}): FasEmployee {
  return {
    emplCd: "",
    name: "",
    partCd: "",
    companyName: "",
    phone: "",
    socialNo: "",
    gojoCd: "",
    jijoCd: "",
    careCd: "",
    roleCd: "",
    stateFlag: "W",
    entrDay: "",
    retrDay: "",
    rfid: "",
    violCnt: 0,
    updatedAt: new Date(),
    isActive: true,
    ...overrides,
  };
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.groupBy = vi.fn(self);
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
  chain.all = mockAll;
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(self);
  chain.run = mockRun;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn((s: string) => s),
  desc: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: {
    id: "id",
    externalWorkerId: "externalWorkerId",
    phoneHash: "phoneHash",
    phoneEncrypted: "phoneEncrypted",
    dobEncrypted: "dobEncrypted",
    name: "name",
    nameMasked: "nameMasked",
  },
  sites: { id: "id", name: "name" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  auditLogs: {
    id: "id",
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
    reason: "reason",
  },
  syncErrors: { status: "status" },
}));

vi.mock("../../../lib/crypto", () => ({
  hmac: vi.fn(async () => "hashed"),
  encrypt: vi.fn(async () => "encrypted"),
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

vi.mock("../../../db/helpers", () => ({
  dbBatch: vi.fn(async () => []),
}));

vi.mock("../../../lib/fas", () => {
  const source = {
    dbName: "mdidev",
    siteCd: "10",
    d1SiteName: "송도세브란스",
    workerIdPrefix: "",
  };
  return {
    FAS_SOURCES: [source],
    resolveFasSource: vi.fn(() => source),
    fasSearchEmployeeByPhone: vi.fn(async () => null),
    fasSearchEmployeeByName: vi.fn(async () => []),
    fasGetAllEmployeesPaginated: vi.fn(async () => ({
      employees: [],
      total: 0,
    })),
    fasGetDailyAttendanceRawRows: vi.fn(async () => ({
      source: "none",
      rows: [],
    })),
    fasGetDailyAttendanceRawSummary: vi.fn(async () => ({
      source: "none",
      totalRows: 0,
      checkins: 0,
      uniqueWorkers: 0,
      workerIds: [],
    })),
  };
});

vi.mock("../../../lib/fas-sync", () => ({
  syncFasEmployeesToD1: vi.fn(async () => ({
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  })),
  deactivateRetiredEmployees: vi.fn(async () => 0),
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
  const { default: route } = await import("../fas");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = {
    DB: {},
    KV: { get: vi.fn(async () => null) },
    HMAC_SECRET: "secret",
    ENCRYPTION_KEY: "enc-key",
    FAS_HYPERDRIVE: null,
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/fas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
  });

  describe("POST /fas/sync-workers", () => {
    it("syncs workers successfully", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });
      mockAll.mockResolvedValueOnce([]);
      mockAll.mockResolvedValueOnce([]);
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "1990-01-01",
              },
            ],
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 for unknown site", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "unknown-site",
            workers: [],
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for WORKER", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [],
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 when payload is missing required fields", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("skips invalid workers and returns zero results", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "1990-01-01",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          results: {
            created: number;
            updated: number;
            membershipCreated: number;
          };
        };
      };
      expect(body.data.results).toEqual({
        created: 0,
        updated: 0,
        membershipCreated: 0,
      });
    });

    it("retries user update without phone/dob when first update fails", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });
      mockAll
        .mockResolvedValueOnce([
          {
            id: "user-1",
            externalWorkerId: "EXT-001",
            phoneHash: "hashed",
          },
        ])
        .mockResolvedValueOnce([]);
      mockRun
        .mockRejectedValueOnce(new Error("unique constraint"))
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "1990-01-01",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockRun).toHaveBeenCalledTimes(2);
    });

    it("creates memberships from inserted users", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });
      mockAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "new-user-1" }])
        .mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-NEW",
                name: "Lee",
                phone: "010-2222-3333",
                dob: "1991-01-01",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { results: { membershipCreated: number } };
      };
      expect(body.data.results.membershipCreated).toBe(1);
    });

    it("uses chunked user lookup when workers exceed in-query chunk size", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });
      mockAll.mockResolvedValue([]);

      const workers = Array.from({ length: 51 }, (_, index) => ({
        externalWorkerId: `EXT-${index + 1}`,
        name: `Kim${index + 1}`,
        phone: `010-1234-${String(index + 1).padStart(4, "0")}`,
        dob: "1990-01-01",
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("keeps success response when workers-sync audit logging fails", async () => {
      mockGet.mockResolvedValueOnce({ id: "site-1", name: "Severance" });
      mockDb.insert.mockImplementation(() => ({
        values: vi.fn(() => {
          throw new Error("audit log write failed");
        }),
      }));

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-workers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("GET /fas/search-mariadb", () => {
    it("returns error when no query param", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/search-mariadb", {}, env);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: { code: string } };
      expect(body.error?.code).toBe("VALIDATION_ERROR");
    });

    it("returns error when FAS_HYPERDRIVE not configured", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/search-mariadb?name=Kim", {}, env);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error?: { code: string } };
      expect(body.error?.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("searches by phone when hyperdrive is configured", async () => {
      vi.mocked(fasSearchEmployeeByPhone).mockResolvedValueOnce(
        makeFasEmployee({ emplCd: "E-1" }),
      );
      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};

      const res = await app.request(
        "/fas/search-mariadb?phone=01012345678",
        {},
        env,
      );
      expect(res.status).toBe(200);
      expect(fasSearchEmployeeByPhone).toHaveBeenCalled();
    });

    it("searches by name and returns multiple rows", async () => {
      vi.mocked(fasSearchEmployeeByName).mockResolvedValueOnce([
        makeFasEmployee({ emplCd: "E-1" }),
      ]);
      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};

      const res = await app.request("/fas/search-mariadb?name=Kim", {}, env);
      expect(res.status).toBe(200);
      expect(fasSearchEmployeeByName).toHaveBeenCalled();
    });

    it("prefers phone search when both phone and name are provided", async () => {
      vi.mocked(fasSearchEmployeeByPhone).mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};

      const res = await app.request(
        "/fas/search-mariadb?phone=01012345678&name=Kim",
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(fasSearchEmployeeByPhone).toHaveBeenCalledTimes(1);
      expect(fasSearchEmployeeByName).not.toHaveBeenCalled();
      const body = (await res.json()) as { data: { count: number } };
      expect(body.data.count).toBe(0);
    });

    it("returns internal error when search fails", async () => {
      vi.mocked(fasSearchEmployeeByName).mockRejectedValueOnce(
        new Error("search failed"),
      );
      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};

      const res = await app.request("/fas/search-mariadb?name=Kim", {}, env);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /fas/sync-status", () => {
    it("returns validation error for invalid accsDay", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-status?accsDay=2026-02",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns status payload without integrity when no date requested", async () => {
      mockGet.mockResolvedValueOnce({
        total: 1,
        fasLinked: 1,
        missingPhone: 0,
        deleted: 0,
      });
      mockAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/sync-status", {}, env);

      expect(res.status).toBe(200);
    });

    it("returns service unavailable when integrity check requested without hyperdrive", async () => {
      mockGet.mockResolvedValueOnce({
        total: 0,
        fasLinked: 0,
        missingPhone: 0,
        deleted: 0,
      });
      mockAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-status?accsDay=2026-02-06",
        {},
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns integrity details when hyperdrive is configured", async () => {
      mockGet.mockResolvedValueOnce({
        total: 5,
        fasLinked: 4,
        missingPhone: 0,
        deleted: 0,
      });
      mockAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "u1" }]);
      vi.mocked(fasGetDailyAttendanceRawSummary).mockResolvedValueOnce({
        source: "access_daily.raw",
        totalRows: 3,
        checkins: 3,
        uniqueWorkers: 2,
        workerIds: ["E-1", "E-2"],
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-status?accsDay=20260206",
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(fasGetDailyAttendanceRawSummary).toHaveBeenCalled();
    });

    it("maps sync error statuses and null log timestamps", async () => {
      mockGet.mockResolvedValueOnce({
        total: 4,
        fasLinked: 3,
        missingPhone: 1,
        deleted: 0,
      });
      mockAll
        .mockResolvedValueOnce([
          { status: "OPEN", count: 2 },
          { status: "RESOLVED", count: 1 },
          { status: "IGNORED", count: 5 },
        ])
        .mockResolvedValueOnce([
          {
            id: "log-1",
            action: "FAS_SYNC_COMPLETED",
            reason: "ok",
            createdAt: null,
          },
        ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/sync-status", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          syncErrorCounts: { open: number; resolved: number; ignored: number };
          recentSyncLogs: Array<{ createdAt: string | null }>;
        };
      };
      expect(body.data.syncErrorCounts).toEqual({
        open: 2,
        resolved: 1,
        ignored: 5,
      });
      expect(body.data.recentSyncLogs[0]?.createdAt).toBeNull();
    });

    it("defaults user stats to zero when aggregate row is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/sync-status", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          userStats: {
            total: number;
            fasLinked: number;
            missingPhone: number;
            deleted: number;
          };
        };
      };
      expect(body.data.userStats).toEqual({
        total: 0,
        fasLinked: 0,
        missingPhone: 0,
        deleted: 0,
      });
    });
  });

  describe("GET /fas/raw-attendance", () => {
    it("returns validation error when accsDay is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/fas/raw-attendance", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns service unavailable when hyperdrive is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/raw-attendance?accsDay=20260206",
        {},
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns raw rows with safe parsed limit", async () => {
      vi.mocked(fasGetDailyAttendanceRawRows).mockResolvedValueOnce({
        source: "access_daily.raw",
        rows: [{ id: 1 }],
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/raw-attendance?accsDay=2026-02-06&limit=not-a-number",
        {},
        env,
      );

      expect(res.status).toBe(200);
      expect(fasGetDailyAttendanceRawRows).toHaveBeenCalled();
    });

    it("clamps raw attendance limit to min and max boundaries", async () => {
      vi.mocked(fasGetDailyAttendanceRawRows).mockResolvedValue({
        source: "access_daily.raw",
        rows: [],
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};

      const lowRes = await app.request(
        "/fas/raw-attendance?accsDay=20260206&limit=0",
        {},
        env,
      );
      expect(lowRes.status).toBe(200);

      const highRes = await app.request(
        "/fas/raw-attendance?accsDay=20260206&limit=50000",
        {},
        env,
      );
      expect(highRes.status).toBe(200);

      const firstCall = vi.mocked(fasGetDailyAttendanceRawRows).mock.calls[0];
      const secondCall = vi.mocked(fasGetDailyAttendanceRawRows).mock.calls[1];
      expect(firstCall?.[3]).toBe(1);
      expect(secondCall?.[3]).toBe(1000);
    });
  });

  describe("POST /fas/sync-hyperdrive", () => {
    it("returns service unavailable when hyperdrive is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/sync-hyperdrive",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns validation error for invalid accsDay", async () => {
      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accsDay: "bad-date" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("syncs hyperdrive employees and deactivates retired workers", async () => {
      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees: [
          makeFasEmployee({ emplCd: "E-1", stateFlag: "W" }),
          makeFasEmployee({ emplCd: "E-2", stateFlag: "R", isActive: false }),
        ],
        total: 2,
      });
      vi.mocked(syncFasEmployeesToD1).mockResolvedValueOnce({
        created: 1,
        updated: 0,
        skipped: 0,
        errors: [],
      });
      vi.mocked(deactivateRetiredEmployees).mockResolvedValueOnce(1);

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: 0, limit: 100 }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(fasGetAllEmployeesPaginated).toHaveBeenCalled();
      expect(syncFasEmployeesToD1).toHaveBeenCalled();
      expect(deactivateRetiredEmployees).toHaveBeenCalled();
    });

    it("returns internal error when sync throws", async () => {
      vi.mocked(fasGetAllEmployeesPaginated).mockRejectedValueOnce(
        new Error("sync failed"),
      );

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("accepts invalid JSON body by falling back to defaults", async () => {
      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees: [],
        total: 0,
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        },
        env,
      );

      expect(res.status).toBe(200);
      const call = vi.mocked(fasGetAllEmployeesPaginated).mock.calls[0];
      expect(call?.[1]).toBe(0);
      expect(call?.[2]).toBe(100);
    });

    it("continues sync when trigger audit log insertion fails", async () => {
      let insertCall = 0;
      mockDb.insert.mockImplementation(() => {
        insertCall += 1;
        if (insertCall === 1) {
          return {
            values: vi.fn(() => {
              throw new Error("trigger audit failed");
            }),
          };
        }
        return makeInsertChain();
      });
      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees: [],
        total: 0,
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("continues sync when completion audit log insertion fails", async () => {
      let insertCall = 0;
      mockDb.insert.mockImplementation(() => {
        insertCall += 1;
        if (insertCall === 2) {
          return {
            values: vi.fn(() => {
              throw new Error("completion audit failed");
            }),
          };
        }
        return makeInsertChain();
      });
      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees: [
          {
            emplCd: "E-1",
            name: "Kim",
            partCd: "P1",
            companyName: "ABC",
            phone: "010-0000-0000",
            socialNo: "900101-1234567",
            gojoCd: "G1",
            jijoCd: "J1",
            careCd: "C1",
            roleCd: "R1",
            stateFlag: "W",
            entrDay: "20200101",
            retrDay: "",
            rfid: "RFID-1",
            violCnt: 0,
            updatedAt: new Date("2025-01-01T00:00:00.000Z"),
            isActive: true,
          },
        ],
        total: 1,
      });

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("returns 500 even when failure audit log insertion also fails", async () => {
      let insertCall = 0;
      mockDb.insert.mockImplementation(() => {
        insertCall += 1;
        if (insertCall === 2) {
          return {
            values: vi.fn(() => {
              throw new Error("failure audit insert failed");
            }),
          };
        }
        return makeInsertChain();
      });
      vi.mocked(fasGetAllEmployeesPaginated).mockRejectedValueOnce(
        new Error("fas read failed"),
      );

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("handles non-Error failures and non-Error audit log write failures", async () => {
      let insertCall = 0;
      mockDb.insert.mockImplementation(() => {
        insertCall += 1;
        if (insertCall === 2) {
          return {
            values: vi.fn(() => {
              throw "audit-string-error";
            }),
          };
        }
        return makeInsertChain();
      });
      vi.mocked(fasGetAllEmployeesPaginated).mockRejectedValueOnce(
        "fas-string-failure",
      );

      const { app, env } = await createApp(makeAuth());
      env.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "/fas/sync-hyperdrive",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(500);
    });
  });
});
