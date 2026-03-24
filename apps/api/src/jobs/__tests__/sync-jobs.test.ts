import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDrizzle = vi.fn();
const mockFasGetUpdatedEmployees = vi.fn();
const mockTestFasConnection = vi.fn();
const mockSyncFasEmployeesToD1 = vi.fn();
const mockDeactivateRetiredEmployees = vi.fn();
const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();
const mockWithRetry = vi.fn();
const mockGetOrCreateSystemUser = vi.fn();
const mockGetKSTDate = vi.fn();
const mockChunkArray = vi.fn();
const mockEnsureSiteMemberships = vi.fn();
const mockLogInfo = vi.fn();
const mockLogError = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("drizzle-orm/d1", () => ({
  drizzle: (...a: unknown[]) => mockDrizzle(...a),
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
  and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
  inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", a })),
  isNull: vi.fn((...a: unknown[]) => ({ op: "isNull", a })),
}));

vi.mock("../../lib/fas", () => ({
  fasGetUpdatedEmployees: (...a: unknown[]) => mockFasGetUpdatedEmployees(...a),
  testConnection: (...a: unknown[]) => mockTestFasConnection(...a),
}));

vi.mock("../../lib/fas-sync", () => ({
  syncFasEmployeesToD1: (...a: unknown[]) => mockSyncFasEmployeesToD1(...a),
  deactivateRetiredEmployees: (...a: unknown[]) =>
    mockDeactivateRetiredEmployees(...a),
}));

vi.mock("../../lib/sync-lock", () => ({
  acquireSyncLock: (...a: unknown[]) => mockAcquireSyncLock(...a),
  releaseSyncLock: (...a: unknown[]) => mockReleaseSyncLock(...a),
}));

vi.mock("../helpers", () => ({
  log: {
    info: (...a: unknown[]) => mockLogInfo(...a),
    error: (...a: unknown[]) => mockLogError(...a),
  },
  withRetry: (...a: unknown[]) => mockWithRetry(...a),
  getOrCreateSystemUser: (...a: unknown[]) => mockGetOrCreateSystemUser(...a),
  getKSTDate: () => mockGetKSTDate(),
  chunkArray: (...a: unknown[]) => mockChunkArray(...a),
  ensureSiteMemberships: (...a: unknown[]) => mockEnsureSiteMemberships(...a),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({ error: (...a: unknown[]) => mockLoggerError(...a) }),
}));

vi.mock("../../db/schema", () => ({
  users: {
    id: "users.id",
    externalSystem: "users.externalSystem",
    deletedAt: "users.deletedAt",
    externalWorkerId: "users.externalWorkerId",
  },
  auditLogs: { id: "auditLogs.id" },
}));

type SelectPlan = { all?: unknown[]; awaited?: unknown };
const selectPlans: SelectPlan[] = [];
const insertValues: unknown[] = [];

function selectChain(
  plan: SelectPlan,
): Promise<unknown> & Record<string, unknown> {
  const awaited = plan.awaited ?? plan.all ?? [];
  const chain = Promise.resolve(awaited) as Promise<unknown> &
    Record<string, unknown>;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.all = vi.fn(async () => plan.all ?? []);
  return chain;
}

const mockDb = {
  select: vi.fn(() => selectChain(selectPlans.shift() ?? {})),
  insert: vi.fn(() => ({
    values: vi.fn((v: unknown) => {
      insertValues.push(v);
      return Promise.resolve();
    }),
  })),
};

function env(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    KV: {
      get: vi.fn(),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    HMAC_SECRET: "hmac",
    ENCRYPTION_KEY: "enc",
    FAS_HYPERDRIVE: { connectionString: "conn" },
    ...overrides,
  };
}

describe("jobs/sync-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectPlans.length = 0;
    insertValues.length = 0;
    mockDrizzle.mockReturnValue(mockDb);
    mockAcquireSyncLock.mockResolvedValue({ acquired: true });
    mockReleaseSyncLock.mockResolvedValue(undefined);
    mockTestFasConnection.mockResolvedValue(true);
    mockWithRetry.mockImplementation(async (fn: () => Promise<unknown>) =>
      fn(),
    );
    mockGetOrCreateSystemUser.mockResolvedValue("system-user");
    mockGetKSTDate.mockReturnValue(new Date("2026-03-20T12:00:00Z"));
    mockChunkArray.mockImplementation((arr: unknown[]) => [arr]);
    mockEnsureSiteMemberships.mockResolvedValue(2);
    mockSyncFasEmployeesToD1.mockResolvedValue({
      created: 1,
      updated: 0,
      skipped: 0,
      errors: [],
    });
    mockDeactivateRetiredEmployees.mockResolvedValue(1);
  });

  it("runFasFullSync returns when FAS binding is missing", async () => {
    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env({ FAS_HYPERDRIVE: undefined }) as never);
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  it("runFasFullSync returns when lock is not acquired", async () => {
    mockAcquireSyncLock.mockResolvedValueOnce({ acquired: false });
    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env() as never);
    expect(mockFasGetUpdatedEmployees).not.toHaveBeenCalled();
  });

  it("runFasFullSync throws on failed connection and releases lock", async () => {
    mockTestFasConnection.mockResolvedValueOnce(false);
    const { runFasFullSync } = await import("../sync-jobs");
    await expect(runFasFullSync(env() as never)).rejects.toThrow(
      "FAS MariaDB connection failed during full sync",
    );
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(
      expect.anything(),
      "fas-full",
    );
  });

  it("runFasFullSync processes active + retired employees and membership sync", async () => {
    selectPlans.push({ all: [{ id: "u1" }, { id: "u2" }] });
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
      { emplCd: "E2", stateFlag: "R" },
    ]);
    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env() as never);

    expect(mockSyncFasEmployeesToD1).toHaveBeenCalled();
    expect(mockDeactivateRetiredEmployees).toHaveBeenCalledWith(
      ["E2"],
      expect.anything(),
    );
    expect(mockEnsureSiteMemberships).toHaveBeenCalled();
    expect(insertValues.length).toBe(1);
  });

  it("runFasFullSync handles membership ensure failure without aborting", async () => {
    selectPlans.push({ all: [{ id: "u1" }] });
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);
    mockEnsureSiteMemberships.mockRejectedValueOnce(
      new Error("membership err"),
    );

    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env() as never);

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to ensure site memberships during full sync",
      expect.objectContaining({ error: "membership err" }),
    );
  });

  it("runFasFullSync returns early when FAS has no employees", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([]);
    const kvPut = vi.fn(async () => undefined);

    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(
      env({ KV: { get: vi.fn(), put: kvPut, delete: vi.fn() } }) as never,
    );

    expect(mockSyncFasEmployeesToD1).not.toHaveBeenCalled();
    expect(kvPut).not.toHaveBeenCalled();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(
      expect.anything(),
      "fas-full",
    );
  });

  it("runFasSyncIncremental handles no updates and KV delete error", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([]);
    const kvDelete = vi.fn(async () => {
      throw new Error("kv delete fail");
    });

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(
      env({ KV: { get: vi.fn(), put: vi.fn(), delete: kvDelete } }) as never,
    );

    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(expect.anything(), "fas");
  });

  it("runFasSyncIncremental cleans KV status when no employees updated", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([]);
    const kvDelete = vi.fn(async () => undefined);

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(
      env({ KV: { get: vi.fn(), put: vi.fn(), delete: kvDelete } }) as never,
    );

    expect(kvDelete).toHaveBeenCalledWith("fas-status");
    expect(mockSyncFasEmployeesToD1).not.toHaveBeenCalled();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(expect.anything(), "fas");
  });

  it("runFasSyncIncremental returns when FAS binding is missing", async () => {
    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env({ FAS_HYPERDRIVE: undefined }) as never);

    expect(mockAcquireSyncLock).not.toHaveBeenCalled();
  });

  it("runFasSyncIncremental returns when lock is not acquired", async () => {
    mockAcquireSyncLock.mockResolvedValueOnce({ acquired: false });
    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env() as never);

    expect(mockFasGetUpdatedEmployees).not.toHaveBeenCalled();
  });

  it("runFasSyncIncremental throws when FAS connection check fails", async () => {
    mockTestFasConnection.mockResolvedValueOnce(false);
    const { runFasSyncIncremental } = await import("../sync-jobs");

    await expect(runFasSyncIncremental(env() as never)).rejects.toThrow(
      "FAS MariaDB connection failed during incremental sync",
    );
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(expect.anything(), "fas");
  });

  it("runFasSyncIncremental skips membership sync when no active workers", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "R1", stateFlag: "R" },
    ]);

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env() as never);

    expect(mockChunkArray).not.toHaveBeenCalled();
    expect(mockEnsureSiteMemberships).not.toHaveBeenCalled();
    expect(mockDeactivateRetiredEmployees).toHaveBeenCalledWith(
      ["R1"],
      expect.anything(),
    );
  });

  it("runFasFullSync skips retire deactivation when retired list is empty", async () => {
    selectPlans.push({ all: [{ id: "u1" }] });
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);

    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env() as never);

    expect(mockDeactivateRetiredEmployees).not.toHaveBeenCalled();
    expect(mockEnsureSiteMemberships).toHaveBeenCalled();
  });

  it("runFasSyncIncremental processes updates, deactivations, memberships, and audit", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
      { emplCd: "E2", stateFlag: "R" },
    ]);
    selectPlans.push({ all: [{ id: "u1" }, { id: "u2" }] });

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env() as never);

    expect(mockSyncFasEmployeesToD1).toHaveBeenCalled();
    expect(mockDeactivateRetiredEmployees).toHaveBeenCalled();
    expect(mockEnsureSiteMemberships).toHaveBeenCalled();
    expect(insertValues.length).toBe(1);
  });

  it("runFasSyncIncremental logs membership failure without rethrowing", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);
    selectPlans.push({ all: [{ id: "u1" }] });
    mockEnsureSiteMemberships.mockRejectedValueOnce(
      new Error("membership err"),
    );

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env() as never);

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to ensure site memberships during incremental sync",
      { error: "membership err" },
    );
    expect(insertValues.length).toBe(1);
  });

  it("runFasSyncIncremental logs and rethrows with code fallback", async () => {
    const codedError = Object.assign(new Error("sync failed"), {
      code: "FAS_DOWN",
    });
    mockFasGetUpdatedEmployees.mockRejectedValueOnce(codedError);

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await expect(runFasSyncIncremental(env() as never)).rejects.toThrow(
      "sync failed",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      "FAS incremental sync failed",
      expect.objectContaining({ errorCode: "FAS_DOWN" }),
    );
  });

  it("runFasSyncIncremental uses UNKNOWN code fallback for non-coded errors", async () => {
    mockFasGetUpdatedEmployees.mockRejectedValueOnce(new Error("no code"));

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await expect(runFasSyncIncremental(env() as never)).rejects.toThrow(
      "no code",
    );

    expect(mockLogError).toHaveBeenCalledWith(
      "FAS incremental sync failed",
      expect.objectContaining({ errorCode: "UNKNOWN" }),
    );
  });

  it("runFasFullSync handles membership failure with non-Error thrown", async () => {
    selectPlans.push({ all: [{ id: "u1" }] });
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);
    mockEnsureSiteMemberships.mockRejectedValueOnce("string-err");

    const { runFasFullSync } = await import("../sync-jobs");
    await runFasFullSync(env() as never);

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to ensure site memberships during full sync",
      { error: "string-err" },
    );
  });

  it("runFasFullSync handles non-Error thrown in outer catch", async () => {
    mockFasGetUpdatedEmployees.mockRejectedValueOnce("fas-fetch-fail");

    const { runFasFullSync } = await import("../sync-jobs");
    await expect(runFasFullSync(env() as never)).rejects.toBe("fas-fetch-fail");

    expect(mockLogError).toHaveBeenCalledWith(
      "FAS full sync failed",
      expect.objectContaining({
        errorCode: "FULL_SYNC_FAILED",
        error: { name: "SyncFailureError", message: "fas-fetch-fail" },
      }),
    );
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(
      expect.anything(),
      "fas-full",
    );
  });

  it("runFasSyncIncremental returns early with no employees and no KV", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([]);

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env({ KV: undefined }) as never);

    expect(mockSyncFasEmployeesToD1).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(undefined, "fas");
  });

  it("runFasSyncIncremental handles KV delete non-Error during empty sync", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([]);
    const kvDelete = vi.fn(async () => {
      throw "string-kv-error";
    });

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(
      env({ KV: { get: vi.fn(), put: vi.fn(), delete: kvDelete } }) as never,
    );

    expect(mockLoggerError).toHaveBeenCalledWith(
      "[sync] Failed to delete fas-status from KV:",
      undefined,
    );
  });

  it("runFasSyncIncremental logs membership failure with non-Error thrown", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);
    selectPlans.push({ all: [{ id: "u1" }] });
    mockEnsureSiteMemberships.mockRejectedValueOnce("non-error-value");

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env() as never);

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to ensure site memberships during incremental sync",
      { error: "non-error-value" },
    );
  });

  it("runFasSyncIncremental succeeds without KV binding", async () => {
    mockFasGetUpdatedEmployees.mockResolvedValueOnce([
      { emplCd: "E1", stateFlag: "W" },
    ]);
    selectPlans.push({ all: [{ id: "u1" }] });

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await runFasSyncIncremental(env({ KV: undefined }) as never);

    expect(mockSyncFasEmployeesToD1).toHaveBeenCalled();
    expect(insertValues.length).toBe(1);
  });

  it("runFasSyncIncremental handles non-Error thrown in outer catch", async () => {
    mockFasGetUpdatedEmployees.mockRejectedValueOnce("string-failure");

    const { runFasSyncIncremental } = await import("../sync-jobs");
    await expect(runFasSyncIncremental(env() as never)).rejects.toBe(
      "string-failure",
    );

    expect(mockLogError).toHaveBeenCalledWith(
      "FAS incremental sync failed",
      expect.objectContaining({
        errorCode: "UNKNOWN",
        error: { name: "SyncFailureError", message: "string-failure" },
      }),
    );
  });
});
