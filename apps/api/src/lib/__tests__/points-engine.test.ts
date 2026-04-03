import { describe, it, expect, vi, beforeEach } from "vitest";

let dailyStatsResult: unknown[] = [{ postCount: 0, totalPoints: 0 }];
let sitePolicyResult: unknown[] = [];
let duplicateCheckResult: unknown[] = [];
let falseReportResult: unknown[] = [];

const mockDb = {
  select: vi.fn().mockImplementation((selectArg: Record<string, unknown>) => {
    if (selectArg && "postCount" in selectArg) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dailyStatsResult),
        }),
      };
    }
    if (selectArg && "defaultAmount" in selectArg) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(sitePolicyResult),
          }),
        }),
      };
    }
    if (selectArg && "amount" in selectArg) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(falseReportResult),
          }),
        }),
      };
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(duplicateCheckResult),
        }),
      }),
    };
  }),
  insert: vi.fn(() => ({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "ledger-1" }]),
    }),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(() => "postCount"),
  sum: vi.fn(() => "totalPoints"),
}));

vi.mock("../../db/schema", () => ({
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    postId: "postId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    adminId: "adminId",
    settleMonth: "settleMonth",
    occurredAt: "occurredAt",
    createdAt: "createdAt",
  },
  pointPolicies: {
    siteId: "siteId",
    reasonCode: "reasonCode",
    defaultAmount: "defaultAmount",
    isActive: "isActive",
  },
  posts: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    category: "category",
    locationFloor: "locationFloor",
    locationZone: "locationZone",
    createdAt: "createdAt",
  },
}));

import {
  calculateApprovalPoints,
  calculateFalseReportPenalty,
  awardApprovalPoints,
  applyFalseReportPenalty,
} from "../points";

const baseInput = {
  postId: "post-1",
  userId: "user-1",
  siteId: "site-1",
  category: "HAZARD" as const,
  riskLevel: "HIGH" as const,
  locationFloor: "3F",
  locationZone: "A",
};

describe("calculateApprovalPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dailyStatsResult = [{ postCount: 0, totalPoints: 0 }];
    sitePolicyResult = [];
    duplicateCheckResult = [];
  });

  it("blocks duplicate within 24h", async () => {
    duplicateCheckResult = [{ id: "dup" }];
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("DUPLICATE_WITHIN_24H");
    expect(result.totalPoints).toBe(0);
  });

  it("blocks when daily post limit exceeded", async () => {
    dailyStatsResult = [{ postCount: 3, totalPoints: 20 }];
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("DAILY_POST_LIMIT");
  });

  it("calculates default base + risk bonus for HAZARD/HIGH", async () => {
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.blocked).toBe(false);
    expect(result.basePoints).toBe(10);
    expect(result.riskBonus).toBe(5);
    expect(result.totalPoints).toBe(15);
  });

  it("caps total at remaining daily points", async () => {
    dailyStatsResult = [{ postCount: 1, totalPoints: 28 }];
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.totalPoints).toBe(2);
    expect(result.blocked).toBe(false);
  });

  it("blocks when daily point limit already reached", async () => {
    dailyStatsResult = [{ postCount: 1, totalPoints: 30 }];
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("DAILY_POINT_LIMIT");
  });

  it("uses site policy defaultAmount when available", async () => {
    sitePolicyResult = [{ defaultAmount: 20 }];
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.basePoints).toBe(20);
    expect(result.riskBonus).toBe(5);
    expect(result.totalPoints).toBe(25);
  });

  it("returns 0 risk bonus when riskLevel is null", async () => {
    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      riskLevel: null,
    });
    expect(result.riskBonus).toBe(0);
    expect(result.basePoints).toBe(10);
    expect(result.totalPoints).toBe(10);
  });

  it("includes risk bonus label in breakdown", async () => {
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.breakdown).toContain("위험도 보너스");
  });

  it("uses SUGGESTION base points (7)", async () => {
    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      category: "SUGGESTION",
      riskLevel: null,
    });
    expect(result.basePoints).toBe(7);
  });

  it("uses INCONVENIENCE base points (5)", async () => {
    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      category: "INCONVENIENCE",
      riskLevel: null,
    });
    expect(result.basePoints).toBe(5);
  });

  it("uses MEDIUM risk bonus (3)", async () => {
    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      riskLevel: "MEDIUM",
    });
    expect(result.riskBonus).toBe(3);
    expect(result.totalPoints).toBe(13);
  });

  it("uses LOW risk bonus (0)", async () => {
    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      riskLevel: "LOW",
    });
    expect(result.riskBonus).toBe(0);
    expect(result.totalPoints).toBe(10);
  });

  it("uses previous KST day before 05:00 cutoff", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T19:00:00.000Z"));
    const result = await calculateApprovalPoints(mockDb as never, baseInput);
    expect(result.blocked).toBe(false);
    vi.useRealTimers();
  });

  it("falls back daily stats to zero when aggregate query returns empty", async () => {
    dailyStatsResult = [];

    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      riskLevel: null,
    });

    expect(result.blocked).toBe(false);
    expect(result.totalPoints).toBe(10);
  });

  it("handles null location fields in duplicate check path", async () => {
    duplicateCheckResult = [{ id: "dup-null-loc" }];

    const result = await calculateApprovalPoints(mockDb as never, {
      ...baseInput,
      locationFloor: null,
      locationZone: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe("DUPLICATE_WITHIN_24H");
  });
});

describe("calculateFalseReportPenalty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    falseReportResult = [];
  });

  it("calculates 2x penalty of original points", async () => {
    falseReportResult = [{ amount: 10 }];
    const result = await calculateFalseReportPenalty(
      mockDb as never,
      "user-1",
      "site-1",
      "post-1",
    );
    expect(result.penaltyAmount).toBe(-20);
    expect(result.breakdown).toContain("2");
  });

  it("returns negative-zero penalty when no original entry", async () => {
    falseReportResult = [];
    const result = await calculateFalseReportPenalty(
      mockDb as never,
      "user-1",
      "site-1",
      "post-1",
    );
    expect(result.penaltyAmount).toBe(-0);
  });

  it("returns zero penalty when original amount is zero", async () => {
    falseReportResult = [{ amount: 0 }];
    const result = await calculateFalseReportPenalty(
      mockDb as never,
      "user-1",
      "site-1",
      "post-1",
    );
    expect(result.penaltyAmount).toBe(-0);
  });
});

describe("awardApprovalPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation((selectArg: Record<string, unknown>) => {
      if (selectArg && "postCount" in selectArg) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(dailyStatsResult),
          }),
        } as never;
      }
      if (selectArg && "defaultAmount" in selectArg) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(sitePolicyResult),
            }),
          }),
        } as never;
      }
      if (selectArg && "amount" in selectArg) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(falseReportResult),
            }),
          }),
        } as never;
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(duplicateCheckResult),
          }),
        }),
      } as never;
    });
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "ledger-1" }]),
      }),
    }));
    dailyStatsResult = [{ postCount: 0, totalPoints: 0 }];
    sitePolicyResult = [];
    duplicateCheckResult = [];
    falseReportResult = [];
  });

  it("returns existing ledger without re-award", async () => {
    const selectSpy = vi.spyOn(mockDb, "select");
    selectSpy
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "ledger-existing", amount: 12, reasonText: "already" },
              ]),
          }),
        }),
      } as never)
      .mockImplementation((arg: Record<string, unknown>) => {
        if (arg && "postCount" in arg) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(dailyStatsResult),
            }),
          } as never;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      });

    const result = await awardApprovalPoints(
      mockDb as never,
      baseInput,
      "admin-1",
    );
    expect(result.awarded).toBe(true);
    expect(result.ledgerId).toBe("ledger-existing");
    expect(result.result.totalPoints).toBe(12);
    selectSpy.mockRestore();
  });

  it("uses fallback breakdown when existing ledger reasonText is null", async () => {
    const selectSpy = vi.spyOn(mockDb, "select");
    selectSpy
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "ledger-existing", amount: 12, reasonText: null },
              ]),
          }),
        }),
      } as never)
      .mockImplementation((arg: Record<string, unknown>) => {
        if (arg && "postCount" in arg) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(dailyStatsResult),
            }),
          } as never;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      });

    const result = await awardApprovalPoints(
      mockDb as never,
      baseInput,
      "admin-1",
    );

    expect(result.awarded).toBe(true);
    expect(result.result.breakdown).toBe("기존 승인 포인트");
    selectSpy.mockRestore();
  });

  it("returns not-awarded when calculated points are blocked", async () => {
    duplicateCheckResult = [{ id: "dup" }];
    const result = await awardApprovalPoints(
      mockDb as never,
      baseInput,
      "admin-1",
    );
    expect(result.awarded).toBe(false);
    expect(result.result.blocked).toBe(true);
  });

  it("inserts ledger and returns generated id on success", async () => {
    const result = await awardApprovalPoints(
      mockDb as never,
      baseInput,
      "admin-1",
    );
    expect(result.awarded).toBe(true);
    expect(result.ledgerId).toBe("ledger-1");
  });

  it("returns empty ledger id when insert returning is empty", async () => {
    const insertMock = vi.spyOn(mockDb, "insert").mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as never);

    const result = await awardApprovalPoints(
      mockDb as never,
      baseInput,
      "admin-1",
    );
    expect(result.awarded).toBe(true);
    expect(result.ledgerId).toBe("");
    insertMock.mockRestore();
  });
});

describe("applyFalseReportPenalty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    falseReportResult = [{ amount: 10 }];
  });

  it("returns existing penalty ledger when present", async () => {
    const selectSpy = vi.spyOn(mockDb, "select");
    selectSpy
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: "penalty-1", amount: -20 }]),
          }),
        }),
      } as never)
      .mockImplementation((arg: Record<string, unknown>) => {
        if (arg && "amount" in arg) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ amount: 10 }]),
              }),
            }),
          } as never;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as never;
      });

    const result = await applyFalseReportPenalty(
      mockDb as never,
      "user-1",
      "site-1",
      "post-1",
      "admin-1",
    );
    expect(result.ledgerId).toBe("penalty-1");
    expect(result.penaltyAmount).toBe(-20);
    selectSpy.mockRestore();
  });

  it("creates penalty ledger when missing", async () => {
    const selectSpy = vi.spyOn(mockDb, "select");
    selectSpy
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ amount: 10 }]),
          }),
        }),
      } as never);

    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("new-ledger-id");

    const result = await applyFalseReportPenalty(
      mockDb as never,
      "user-1",
      "site-1",
      "post-1",
      "admin-1",
    );
    expect(result.ledgerId).toBe("new-ledger-id");
    expect(result.penaltyAmount).toBe(-20);
    selectSpy.mockRestore();
    randomUuidSpy.mockRestore();
  });
});
