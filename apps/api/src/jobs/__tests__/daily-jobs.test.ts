import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDrizzle = vi.fn();
const mockDbBatchChunked = vi.fn();
const mockFireAlert = vi.fn();
const mockGetAlertConfig = vi.fn();
const mockBuildHighErrorRateAlert = vi.fn();
const mockBuildHighLatencyAlert = vi.fn();
const mockGetKSTDate = vi.fn();
const mockChunkArray = vi.fn();
const mockGetOrCreateSystemUser = vi.fn();
const mockDeleteFromOptionalTableByAge = vi.fn();
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();

vi.mock("drizzle-orm/d1", () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  gte: vi.fn((...args: unknown[]) => ({ op: "gte", args })),
  lt: vi.fn((...args: unknown[]) => ({ op: "lt", args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: (...args: unknown[]) => mockDbBatchChunked(...args),
}));

vi.mock("../../lib/alerting", () => ({
  fireAlert: (...args: unknown[]) => mockFireAlert(...args),
  getAlertConfig: (...args: unknown[]) => mockGetAlertConfig(...args),
  buildHighErrorRateAlert: (...args: unknown[]) =>
    mockBuildHighErrorRateAlert(...args),
  buildHighLatencyAlert: (...args: unknown[]) =>
    mockBuildHighLatencyAlert(...args),
}));

vi.mock("../helpers", () => ({
  log: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
  getKSTDate: () => mockGetKSTDate(),
  chunkArray: (...args: unknown[]) => mockChunkArray(...args),
  getOrCreateSystemUser: (...args: unknown[]) =>
    mockGetOrCreateSystemUser(...args),
  deleteFromOptionalTableByAge: (...args: unknown[]) =>
    mockDeleteFromOptionalTableByAge(...args),
}));

vi.mock("../../db/schema", () => ({
  pointsLedger: {
    id: "pointsLedger.id",
    reasonCode: "pointsLedger.reasonCode",
    createdAt: "pointsLedger.createdAt",
  },
  users: {
    id: "users.id",
    deletionRequestedAt: "users.deletionRequestedAt",
    deletedAt: "users.deletedAt",
  },
  siteMemberships: { userId: "siteMemberships.userId" },
  auditLogs: { id: "auditLogs.id", createdAt: "auditLogs.createdAt" },
  actions: {
    id: "actions.id",
    postId: "actions.postId",
    actionStatus: "actions.actionStatus",
    dueDate: "actions.dueDate",
    createdAt: "actions.createdAt",
  },
  posts: {
    id: "posts.id",
    createdAt: "posts.createdAt",
    userId: "posts.userId",
  },
  announcements: {
    isPublished: "announcements.isPublished",
    scheduledAt: "announcements.scheduledAt",
  },
  votes: { id: "votes.id", votedAt: "votes.votedAt" },
  attendance: {
    id: "attendance.id",
    createdAt: "attendance.createdAt",
    userId: "attendance.userId",
  },
  apiMetrics: {
    requestCount: "apiMetrics.requestCount",
    status5xx: "apiMetrics.status5xx",
    totalDurationMs: "apiMetrics.totalDurationMs",
    maxDurationMs: "apiMetrics.maxDurationMs",
    bucket: "apiMetrics.bucket",
  },
}));

type SelectPlan = {
  awaited?: unknown;
  all?: unknown[];
  get?: unknown;
};

type UpdatePlan = { meta?: { changes?: number } };

const state = {
  selectPlans: [] as SelectPlan[],
  deletePlans: [] as unknown[][],
  updatePlans: [] as UpdatePlan[],
  insertCalls: [] as unknown[],
};

function makeThenable<T>(value: T): Promise<T> & Record<string, unknown> {
  const promise = Promise.resolve(value) as Promise<T> &
    Record<string, unknown>;
  return promise;
}

function makeSelectChain(
  plan: SelectPlan,
): Promise<unknown> & Record<string, unknown> {
  const awaited = plan.awaited ?? plan.all ?? [];
  const chain = makeThenable(awaited);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => plan.all ?? []);
  chain.all = vi.fn(async () => plan.all ?? []);
  chain.get = vi.fn(async () => plan.get ?? null);
  return chain;
}

function makeDeleteChain() {
  return {
    where: vi.fn(() => ({
      returning: vi.fn(async () => state.deletePlans.shift() ?? []),
    })),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn(() => ({
      where: vi.fn(
        async () => state.updatePlans.shift() ?? { meta: { changes: 0 } },
      ),
    })),
  };
}

function makeInsertChain() {
  return {
    values: vi.fn((value: unknown) => {
      state.insertCalls.push(value);
      return Promise.resolve();
    }),
  };
}

const mockDb = {
  select: vi.fn(() => makeSelectChain(state.selectPlans.shift() ?? {})),
  delete: vi.fn(() => makeDeleteChain()),
  update: vi.fn(() => makeUpdateChain()),
  insert: vi.fn(() => makeInsertChain()),
};

function buildEnv(overrides: Record<string, unknown> = {}) {
  const r2List = vi.fn(async () => ({
    truncated: false,
    objects: [] as Array<{ key: string; uploaded: Date }>,
  }));
  const r2Delete = vi.fn(async () => undefined);
  return {
    DB: {},
    R2: {
      list: r2List,
      delete: r2Delete,
    },
    KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    ALERT_WEBHOOK_URL: "https://webhook.example",
    ...overrides,
  };
}

describe("jobs/daily-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectPlans = [];
    state.deletePlans = [];
    state.updatePlans = [];
    state.insertCalls = [];
    mockDrizzle.mockReturnValue(mockDb);
    mockGetKSTDate.mockReturnValue(new Date("2026-03-20T00:00:00Z"));
    mockChunkArray.mockImplementation((items: unknown[]) => [items]);
    mockGetOrCreateSystemUser.mockResolvedValue("system-user");
    mockDeleteFromOptionalTableByAge.mockResolvedValue(0);
    mockGetAlertConfig.mockResolvedValue({
      enabled: false,
      webhookUrl: "",
      errorRateThresholdPercent: 10,
      latencyThresholdMs: 500,
    });
    mockBuildHighErrorRateAlert.mockReturnValue({ type: "high-error" });
    mockBuildHighLatencyAlert.mockReturnValue({ type: "high-latency" });
  });

  it("runDataRetention deletes old records, optional tables, R2 keys, and writes audit", async () => {
    const env = buildEnv();
    const oldDate = new Date("2020-01-01T00:00:00Z");
    const newDate = new Date("2026-03-19T00:00:00Z");
    const r2List = vi
      .fn()
      .mockResolvedValueOnce({
        truncated: true,
        cursor: "next",
        objects: [
          { key: "old-1", uploaded: oldDate },
          { key: "new-1", uploaded: newDate },
        ],
      })
      .mockResolvedValueOnce({
        truncated: false,
        objects: [{ key: "old-2", uploaded: oldDate }],
      });
    env.R2.list = r2List;
    const r2Delete = vi.fn(async () => undefined);
    env.R2.delete = r2Delete;

    state.deletePlans.push(
      [{ id: "a1" }],
      [{ id: "p1" }],
      [{ id: "l1" }],
      [{ id: "at1" }],
      [{ id: "v1" }],
      [{ id: "pl1" }],
    );
    mockDeleteFromOptionalTableByAge
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5);

    const { runDataRetention } = await import("../daily-jobs");
    await runDataRetention(env as never);

    expect(mockDeleteFromOptionalTableByAge).toHaveBeenCalledTimes(3);
    expect(r2List).toHaveBeenCalledTimes(2);
    expect(r2Delete).toHaveBeenCalledWith(["old-1", "old-2"]);
    expect(state.insertCalls).toHaveLength(1);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Deleted data retention entries",
      expect.objectContaining({
        actions: 1,
        posts: 1,
        auditLogs: 1,
        attendanceLogs: 1,
        votes: 1,
        pointsLedger: 1,
        notifications: 3,
      }),
    );
  });

  it("runOverdueActionCheck returns early when no overdue actions", async () => {
    state.selectPlans.push({ awaited: [] });
    const env = buildEnv();

    const { runOverdueActionCheck } = await import("../daily-jobs");
    await runOverdueActionCheck(env as never);

    expect(mockDbBatchChunked).not.toHaveBeenCalled();
  });

  it("runOverdueActionCheck updates actions/posts and writes audit ops", async () => {
    state.selectPlans.push({
      awaited: [
        { id: "act-1", postId: "post-1" },
        { id: "act-2", postId: null },
      ],
    });
    const env = buildEnv();

    const { runOverdueActionCheck } = await import("../daily-jobs");
    await runOverdueActionCheck(env as never);

    expect(mockDbBatchChunked).toHaveBeenCalledTimes(1);
    const [, ops] = mockDbBatchChunked.mock.calls[0] as [unknown, unknown[]];
    expect(ops).toHaveLength(4);
    expect(mockLogInfo).toHaveBeenCalledWith("Overdue action check complete", {
      count: 2,
    });
  });

  it("runPiiLifecycleCleanup returns early when no users need cleanup", async () => {
    state.selectPlans.push({ awaited: [] });
    const { runPiiLifecycleCleanup } = await import("../daily-jobs");
    await runPiiLifecycleCleanup(buildEnv() as never);

    expect(mockDbBatchChunked).not.toHaveBeenCalled();
    expect(mockLogInfo).not.toHaveBeenCalledWith(
      "PII lifecycle cleanup",
      expect.anything(),
    );
  });

  it("runPiiLifecycleCleanup throws when initial batch fails", async () => {
    state.selectPlans.push({ awaited: [{ id: "u1" }] });
    mockDbBatchChunked.mockRejectedValueOnce(new Error("batch failed"));

    const { runPiiLifecycleCleanup } = await import("../daily-jobs");
    await expect(runPiiLifecycleCleanup(buildEnv() as never)).rejects.toThrow(
      "batch failed",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      "PII lifecycle cleanup batch failed",
      expect.objectContaining({ userCount: 1 }),
    );
  });

  it("runPiiLifecycleCleanup executes user + cascade batches", async () => {
    state.selectPlans.push({ awaited: [{ id: "u1" }, { id: "u2" }] });
    mockDbBatchChunked.mockResolvedValue(undefined);

    const { runPiiLifecycleCleanup } = await import("../daily-jobs");
    await runPiiLifecycleCleanup(buildEnv() as never);

    expect(mockDbBatchChunked).toHaveBeenCalledTimes(2);
    expect(mockLogInfo).toHaveBeenCalledWith("PII lifecycle cleanup", {
      usersHardDeleted: 2,
    });
  });

  it("publishScheduledAnnouncements logs only when rows changed", async () => {
    state.updatePlans.push({ meta: { changes: 2 } });
    const { publishScheduledAnnouncements } = await import("../daily-jobs");
    await publishScheduledAnnouncements(buildEnv() as never);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Published scheduled announcements",
      { count: 2 },
    );

    state.updatePlans.push({ meta: { changes: 0 } });
    mockLogInfo.mockClear();
    await publishScheduledAnnouncements(buildEnv() as never);
    expect(mockLogInfo).not.toHaveBeenCalled();
  });

  it("runMetricsAlertCheck returns early when KV/config/data are not actionable", async () => {
    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv({ KV: undefined }) as never);
    expect(mockGetAlertConfig).not.toHaveBeenCalled();

    await runMetricsAlertCheck(buildEnv() as never);
    expect(mockFireAlert).not.toHaveBeenCalled();

    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "yes",
      errorRateThresholdPercent: 10,
      latencyThresholdMs: 500,
    });
    state.selectPlans.push({
      awaited: [
        { totalRequests: 0, total5xx: 0, avgDurationMs: 0, maxDurationMs: 0 },
      ],
    });
    await runMetricsAlertCheck(buildEnv() as never);
    expect(mockFireAlert).not.toHaveBeenCalled();
  });

  it("runMetricsAlertCheck fires high-error and high-latency alerts", async () => {
    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "https://alert.example",
      errorRateThresholdPercent: 10,
      latencyThresholdMs: 500,
    });
    state.selectPlans.push({
      awaited: [
        {
          totalRequests: 20,
          total5xx: 5,
          avgDurationMs: 1200,
          maxDurationMs: 3000,
        },
      ],
    });

    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv() as never);

    expect(mockBuildHighErrorRateAlert).toHaveBeenCalled();
    expect(mockBuildHighLatencyAlert).toHaveBeenCalled();
    expect(mockFireAlert).toHaveBeenCalledTimes(2);
  });

  it("runMetricsAlertCheck skips alerting when summary is undefined", async () => {
    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "https://alert.example",
      errorRateThresholdPercent: 10,
      latencyThresholdMs: 500,
    });
    state.selectPlans.push({ awaited: [] });

    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv() as never);

    expect(mockFireAlert).not.toHaveBeenCalled();
  });

  it("runMetricsAlertCheck does not fire on threshold equality", async () => {
    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "https://alert.example",
      errorRateThresholdPercent: 25,
      latencyThresholdMs: 1000,
    });
    state.selectPlans.push({
      awaited: [
        {
          totalRequests: 20,
          total5xx: 5,
          avgDurationMs: 1000,
          maxDurationMs: 1200,
        },
      ],
    });

    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv() as never);

    expect(mockFireAlert).not.toHaveBeenCalled();
  });

  it("runDataRetention skips R2 delete when no stale images exist", async () => {
    const env = buildEnv();
    state.deletePlans.push([], [], [], [], [], []);
    mockDeleteFromOptionalTableByAge
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const { runDataRetention } = await import("../daily-jobs");
    await runDataRetention(env as never);

    expect(env.R2.delete).not.toHaveBeenCalled();
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Deleted data retention entries",
      expect.objectContaining({ r2Images: 0 }),
    );
  });

  it("runMetricsAlertCheck fires only latency alert when error rate is normal", async () => {
    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "https://alert.example",
      errorRateThresholdPercent: 50,
      latencyThresholdMs: 500,
    });
    state.selectPlans.push({
      awaited: [
        {
          totalRequests: 100,
          total5xx: 2,
          avgDurationMs: 1200,
          maxDurationMs: 3000,
        },
      ],
    });

    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv() as never);

    expect(mockBuildHighErrorRateAlert).not.toHaveBeenCalled();
    expect(mockBuildHighLatencyAlert).toHaveBeenCalled();
    expect(mockFireAlert).toHaveBeenCalledTimes(1);
  });

  it("runMetricsAlertCheck fires only error alert when latency is normal", async () => {
    mockGetAlertConfig.mockResolvedValueOnce({
      enabled: true,
      webhookUrl: "https://alert.example",
      errorRateThresholdPercent: 10,
      latencyThresholdMs: 5000,
    });
    state.selectPlans.push({
      awaited: [
        {
          totalRequests: 20,
          total5xx: 5,
          avgDurationMs: 200,
          maxDurationMs: 800,
        },
      ],
    });

    const { runMetricsAlertCheck } = await import("../daily-jobs");
    await runMetricsAlertCheck(buildEnv() as never);

    expect(mockBuildHighErrorRateAlert).toHaveBeenCalled();
    expect(mockBuildHighLatencyAlert).not.toHaveBeenCalled();
    expect(mockFireAlert).toHaveBeenCalledTimes(1);
  });
});
