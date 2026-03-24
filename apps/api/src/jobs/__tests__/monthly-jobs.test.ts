import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDrizzle = vi.fn();
const mockAcquireSyncLock = vi.fn();
const mockReleaseSyncLock = vi.fn();
const mockDbBatchChunked = vi.fn();
const mockEnqueueNotification = vi.fn();
const mockGetKSTDate = vi.fn();
const mockGetMonthRange = vi.fn();
const mockFormatSettleMonth = vi.fn();
const mockGetOrCreateSystemUser = vi.fn();
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();

vi.mock("drizzle-orm/d1", () => ({
  drizzle: (...a: unknown[]) => mockDrizzle(...a),
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
  and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
  gte: vi.fn((...a: unknown[]) => ({ op: "gte", a })),
  lt: vi.fn((...a: unknown[]) => ({ op: "lt", a })),
  desc: vi.fn((...a: unknown[]) => ({ op: "desc", a })),
  inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", a })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
    as: (_alias: string) => ({ strings, values }),
  })),
}));

vi.mock("../../lib/sync-lock", () => ({
  acquireSyncLock: (...a: unknown[]) => mockAcquireSyncLock(...a),
  releaseSyncLock: (...a: unknown[]) => mockReleaseSyncLock(...a),
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: (...a: unknown[]) => mockDbBatchChunked(...a),
}));

vi.mock("../../lib/notification-queue", () => ({
  enqueueNotification: (...a: unknown[]) => mockEnqueueNotification(...a),
}));

vi.mock("../helpers", () => ({
  log: {
    info: (...a: unknown[]) => mockLogInfo(...a),
    warn: (...a: unknown[]) => mockLogWarn(...a),
    error: (...a: unknown[]) => mockLogError(...a),
  },
  getKSTDate: () => mockGetKSTDate(),
  getMonthRange: (...a: unknown[]) => mockGetMonthRange(...a),
  formatSettleMonth: (...a: unknown[]) => mockFormatSettleMonth(...a),
  getOrCreateSystemUser: (...a: unknown[]) => mockGetOrCreateSystemUser(...a),
  VOTE_REWARD_POINTS: [50, 30, 20],
  VOTE_REWARD_POINT_CODES: [
    "VOTE_REWARD_RANK_1",
    "VOTE_REWARD_RANK_2",
    "VOTE_REWARD_RANK_3",
  ],
}));

vi.mock("../../db/schema", () => ({
  pointsLedger: {
    id: "pointsLedger.id",
    amount: "pointsLedger.amount",
    reasonCode: "pointsLedger.reasonCode",
    settleMonth: "pointsLedger.settleMonth",
    userId: "pointsLedger.userId",
    siteId: "pointsLedger.siteId",
    createdAt: "pointsLedger.createdAt",
  },
  siteMemberships: {
    userId: "siteMemberships.userId",
    siteId: "siteMemberships.siteId",
    status: "siteMemberships.status",
  },
  auditLogs: { id: "auditLogs.id" },
  sites: {
    id: "sites.id",
    name: "sites.name",
    active: "sites.active",
    autoNominationTopN: "sites.autoNominationTopN",
  },
  voteCandidates: {},
  votePeriods: {
    siteId: "votePeriods.siteId",
    month: "votePeriods.month",
    endDate: "votePeriods.endDate",
  },
  votes: {
    candidateId: "votes.candidateId",
    siteId: "votes.siteId",
    month: "votes.month",
    votedAt: "votes.votedAt",
  },
  pointPolicies: {
    reasonCode: "pointPolicies.reasonCode",
    defaultAmount: "pointPolicies.defaultAmount",
    siteId: "pointPolicies.siteId",
    isActive: "pointPolicies.isActive",
  },
  pushSubscriptions: {
    id: "pushSubscriptions.id",
    userId: "pushSubscriptions.userId",
    endpoint: "pushSubscriptions.endpoint",
    p256dh: "pushSubscriptions.p256dh",
    auth: "pushSubscriptions.auth",
    failCount: "pushSubscriptions.failCount",
  },
}));

type SelectPlan = { all?: unknown[]; get?: unknown; awaited?: unknown };
const selectPlans: SelectPlan[] = [];
const insertCalls: unknown[] = [];

function selectChain(
  plan: SelectPlan,
): Promise<unknown> & Record<string, unknown> {
  const awaited = plan.awaited ?? plan.all ?? [];
  const chain = Promise.resolve(awaited) as Promise<unknown> &
    Record<string, unknown>;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.all = vi.fn(async () => plan.all ?? []);
  chain.get = vi.fn(async () => plan.get ?? null);
  return chain;
}

function insertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn((v: unknown) => {
    insertCalls.push(v);
    return chain;
  });
  chain.onConflictDoNothing = vi.fn(async () => undefined);
  return chain;
}

const mockDb = {
  select: vi.fn(() => selectChain(selectPlans.shift() ?? {})),
  insert: vi.fn(() => insertChain()),
};

function env(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    NOTIFICATION_QUEUE: { send: vi.fn() },
    ...overrides,
  };
}

describe("jobs/monthly-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectPlans.length = 0;
    insertCalls.length = 0;
    mockDrizzle.mockReturnValue(mockDb);
    mockGetKSTDate.mockReturnValue(new Date("2026-03-01T00:00:00Z"));
    mockGetMonthRange.mockReturnValue({
      start: new Date("2026-03-01T00:00:00Z"),
      end: new Date("2026-03-31T23:59:59Z"),
    });
    mockFormatSettleMonth.mockReturnValue("2026-03");
    mockGetOrCreateSystemUser.mockResolvedValue("system-user");
    mockAcquireSyncLock.mockResolvedValue({
      acquired: true,
      holder: "holder-1",
    });
    mockReleaseSyncLock.mockResolvedValue(undefined);
    mockDbBatchChunked.mockResolvedValue(undefined);
  });

  it("runMonthEndSnapshot skips when snapshot already exists", async () => {
    selectPlans.push({ all: [{ id: "existing" }] });
    const { runMonthEndSnapshot } = await import("../monthly-jobs");
    await runMonthEndSnapshot(env() as never);
    expect(mockDbBatchChunked).not.toHaveBeenCalled();
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Month-end snapshot already exists, skipping",
      { settleMonth: "2026-03" },
    );
  });

  it("runMonthEndSnapshot writes snapshots + audit for non-zero balances", async () => {
    selectPlans.push(
      { all: [] },
      {
        all: [
          { userId: "u1", siteId: "s1" },
          { userId: "u2", siteId: "s1" },
        ],
      },
      { get: { balance: 12 } },
      { get: { balance: 0 } },
    );
    const { runMonthEndSnapshot } = await import("../monthly-jobs");
    await runMonthEndSnapshot(env() as never);
    expect(mockDbBatchChunked).toHaveBeenCalledTimes(1);
    expect(mockLogInfo).toHaveBeenCalledWith("Snapshot complete", {
      snapshotCount: 1,
    });
  });

  it("runMonthEndSnapshot logs and rethrows batch failure", async () => {
    selectPlans.push(
      { all: [] },
      { all: [{ userId: "u1", siteId: "s1" }] },
      { get: { balance: 99 } },
    );
    mockDbBatchChunked.mockRejectedValueOnce(
      new Error("snapshot batch failed"),
    );
    const { runMonthEndSnapshot } = await import("../monthly-jobs");
    await expect(runMonthEndSnapshot(env() as never)).rejects.toThrow(
      "snapshot batch failed",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      "Month-end snapshot batch failed",
      expect.objectContaining({ settleMonth: "2026-03" }),
    );
  });

  it("runAutoNomination handles no sites and successful nomination flow", async () => {
    selectPlans.push({ awaited: [] });
    const { runAutoNomination } = await import("../monthly-jobs");
    await runAutoNomination(env() as never);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "No sites with auto-nomination enabled",
    );

    selectPlans.push(
      { awaited: [{ id: "s1", name: "Site", topN: 2 }] },
      {
        awaited: [
          { userId: "u1", totalPoints: 20 },
          { userId: "u2", totalPoints: 10 },
        ],
      },
      { awaited: [{ userId: "u1" }, { userId: "u2" }] },
    );
    insertCalls.length = 0;
    await runAutoNomination(env() as never);
    expect(mockDbBatchChunked).toHaveBeenCalled();
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it("runAutoNomination skips site when no point earners exist", async () => {
    selectPlans.push(
      { awaited: [{ id: "s1", name: "Site A", topN: 3 }] },
      { awaited: [] },
    );
    const { runAutoNomination } = await import("../monthly-jobs");
    await runAutoNomination(env() as never);
    expect(mockLogInfo).toHaveBeenCalledWith("No point earners for site", {
      siteId: "s1",
      siteName: "Site A",
    });
  });

  it("runAutoNomination skips site when no eligible earners after membership filter", async () => {
    selectPlans.push(
      { awaited: [{ id: "s1", name: "Site B", topN: 2 }] },
      { awaited: [{ userId: "u1", totalPoints: 50 }] },
      { awaited: [] },
    );
    const { runAutoNomination } = await import("../monthly-jobs");
    await runAutoNomination(env() as never);
    expect(mockLogInfo).toHaveBeenCalledWith("No eligible earners for site", {
      siteId: "s1",
    });
    expect(mockDbBatchChunked).not.toHaveBeenCalled();
  });

  it("runVoteRewardDistribution short-circuits on missing KV or lock", async () => {
    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(env({ KV: undefined }) as never);
    expect(mockAcquireSyncLock).not.toHaveBeenCalled();

    mockAcquireSyncLock.mockResolvedValueOnce({ acquired: false });
    await runVoteRewardDistribution(env() as never);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Vote reward distribution already in progress, skipping",
    );
  });

  it("runVoteRewardDistribution returns when no completed periods exist", async () => {
    selectPlans.push({ all: [] });
    const { runVoteRewardDistribution } = await import("../monthly-jobs");

    await runVoteRewardDistribution(env() as never);

    expect(mockLogInfo).toHaveBeenCalledWith(
      "No completed vote periods for reward distribution",
    );
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(
      expect.anything(),
      "vote-reward-distribution",
      "holder-1",
    );
  });

  it("runVoteRewardDistribution skips period when existing rewards already exist", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [{ id: "already-rewarded" }] },
    );
    const { runVoteRewardDistribution } = await import("../monthly-jobs");

    await runVoteRewardDistribution(env() as never);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("runVoteRewardDistribution skips period when winners are empty", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      { all: [] },
    );
    const { runVoteRewardDistribution } = await import("../monthly-jobs");

    await runVoteRewardDistribution(env() as never);

    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("runVoteRewardDistribution processes rewards, notifications, and releases lock", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      {
        all: [
          { candidateId: "u1", voteCount: 10 },
          { candidateId: "u2", voteCount: 8 },
        ],
      },
      { all: [{ reasonCode: "VOTE_REWARD_RANK_1", defaultAmount: 111 }] },
      {
        all: [
          {
            id: "sub1",
            userId: "u1",
            endpoint: "e",
            p256dh: "p",
            auth: "a",
            failCount: 0,
          },
        ],
      },
    );
    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(env() as never);

    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(insertCalls.length).toBeGreaterThan(0);
    expect(mockReleaseSyncLock).toHaveBeenCalledWith(
      expect.anything(),
      "vote-reward-distribution",
      "holder-1",
    );
  });

  it("runVoteRewardDistribution continues when enqueue notification fails", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      { all: [{ candidateId: "u1", voteCount: 10 }] },
      { all: [] },
      {
        all: [
          {
            id: "sub1",
            userId: "u1",
            endpoint: "e",
            p256dh: "p",
            auth: "a",
            failCount: 0,
          },
        ],
      },
    );
    mockEnqueueNotification.mockRejectedValueOnce(new Error("queue down"));

    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(env() as never);
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Failed to send reward notifications",
      expect.objectContaining({ error: expect.any(Object) }),
    );
    expect(mockReleaseSyncLock).toHaveBeenCalled();
  });

  it("runMonthEndSnapshot handles non-Error batch failure", async () => {
    selectPlans.push(
      { all: [] },
      { all: [{ userId: "u1", siteId: "s1" }] },
      { get: { balance: 99 } },
    );
    mockDbBatchChunked.mockRejectedValueOnce("string batch error");
    const { runMonthEndSnapshot } = await import("../monthly-jobs");
    await expect(runMonthEndSnapshot(env() as never)).rejects.toBe(
      "string batch error",
    );
    expect(mockLogError).toHaveBeenCalledWith(
      "Month-end snapshot batch failed",
      expect.objectContaining({
        error: "string batch error",
      }),
    );
  });

  it("runMonthEndSnapshot skips batch when all membership balances are zero", async () => {
    selectPlans.push(
      { all: [] },
      { all: [{ userId: "u1", siteId: "s1" }] },
      { get: { balance: 0 } },
    );
    const { runMonthEndSnapshot } = await import("../monthly-jobs");
    await runMonthEndSnapshot(env() as never);
    expect(mockDbBatchChunked).not.toHaveBeenCalled();
    expect(mockLogInfo).toHaveBeenCalledWith("Snapshot complete", {
      snapshotCount: 0,
    });
  });

  it("runVoteRewardDistribution skips notification when NOTIFICATION_QUEUE is absent", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      { all: [{ candidateId: "u1", voteCount: 10 }] },
      { all: [] },
    );
    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(
      env({ NOTIFICATION_QUEUE: undefined }) as never,
    );
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(insertCalls.length).toBeGreaterThan(0);
  });

  it("runVoteRewardDistribution skips enqueue when no push subscriptions exist", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      { all: [{ candidateId: "u1", voteCount: 10 }] },
      { all: [] },
      { all: [] },
    );
    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(env() as never);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("runVoteRewardDistribution handles non-Error notification failure", async () => {
    const nowEpoch = Math.floor(Date.now() / 1000);
    selectPlans.push(
      { all: [{ siteId: "s1", month: "2026-02", endDate: nowEpoch - 1 }] },
      { all: [] },
      { all: [{ candidateId: "u1", voteCount: 10 }] },
      { all: [] },
      {
        all: [
          {
            id: "sub1",
            userId: "u1",
            endpoint: "e",
            p256dh: "p",
            auth: "a",
            failCount: 0,
          },
        ],
      },
    );
    mockEnqueueNotification.mockRejectedValueOnce("string error");
    const { runVoteRewardDistribution } = await import("../monthly-jobs");
    await runVoteRewardDistribution(env() as never);
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Failed to send reward notifications",
      expect.objectContaining({
        error: { name: "UnknownError", message: "string error" },
      }),
    );
  });
});
