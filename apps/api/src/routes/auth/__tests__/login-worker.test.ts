import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const {
  mockCheckRateLimit,
  mockHmac,
  mockSignJwt,
  mockLogAuditWithContext,
  mockGetLockoutStatus,
  mockRecordFailedAttempt,
  mockClearLockout,
  mockAccountLockedResponse,
  mockLogLoginLockoutEvent,
  mockGetLoginLockoutKey,
  mockResolveLockoutActorId,
  mockNormalizeDeviceId,
  mockFasSearchEmployeeByPhone,
  mockFasCheckWorkerAttendance,
  mockSyncSingleFasEmployee,
  mockSocialNoToDob,
  mockEncrypt,
  mockDecrypt,
  mockLimit,
  mockUpdateWhere,
} = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockHmac: vi.fn(),
  mockSignJwt: vi.fn(),
  mockLogAuditWithContext: vi.fn(),
  mockGetLockoutStatus: vi.fn(),
  mockRecordFailedAttempt: vi.fn(),
  mockClearLockout: vi.fn(),
  mockAccountLockedResponse: vi.fn(),
  mockLogLoginLockoutEvent: vi.fn(),
  mockGetLoginLockoutKey: vi.fn(),
  mockResolveLockoutActorId: vi.fn(),
  mockNormalizeDeviceId: vi.fn(),
  mockFasSearchEmployeeByPhone: vi.fn(),
  mockFasCheckWorkerAttendance: vi.fn(),
  mockSyncSingleFasEmployee: vi.fn(),
  mockSocialNoToDob: vi.fn(),
  mockEncrypt: vi.fn(),
  mockDecrypt: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdateWhere: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockLimit,
          get: vi.fn().mockResolvedValue(null),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdateWhere,
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  })),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("../../../db/schema", () => ({
  users: { phoneHash: "phoneHash", dobHash: "dobHash", id: "id" },
  attendance: { userId: "userId", result: "result", checkinAt: "checkinAt" },
  deviceRegistrations: {
    userId: "userId",
    deviceId: "deviceId",
    id: "id",
  },
}));

vi.mock("../../../lib/crypto", () => ({
  hmac: mockHmac,
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

vi.mock("../../../lib/jwt", () => ({ signJwt: mockSignJwt }));

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: mockLogAuditWithContext,
}));

vi.mock("../../../lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("../../../lib/fas", () => ({
  fasSearchEmployeeByPhone: mockFasSearchEmployeeByPhone,
  fasCheckWorkerAttendance: mockFasCheckWorkerAttendance,
}));

vi.mock("../../../lib/fas-sync", () => ({
  socialNoToDob: mockSocialNoToDob,
  syncSingleFasEmployee: mockSyncSingleFasEmployee,
}));

vi.mock("../../../lib/device-registrations", () => ({
  normalizeDeviceId: mockNormalizeDeviceId,
}));

vi.mock("../../../utils/common", () => ({
  getTodayRange: vi
    .fn()
    .mockReturnValue({ start: "2025-01-01", end: "2025-01-02" }),
}));

vi.mock("../lockout", () => ({
  getLoginLockoutKey: mockGetLoginLockoutKey,
  getLockoutStatus: mockGetLockoutStatus,
  recordFailedAttempt: mockRecordFailedAttempt,
  clearLockout: mockClearLockout,
  accountLockedResponse: mockAccountLockedResponse,
  logLoginLockoutEvent: mockLogLoginLockoutEvent,
  resolveLockoutActorId: mockResolveLockoutActorId,
}));

import { handleWorkerLogin } from "../login-worker";
import type { WorkerLoginBody } from "../login-worker";

const VALID_BODY: WorkerLoginBody = {
  name: "TestUser",
  phone: "01012345678",
  dob: "900101",
};

const MOCK_USER = {
  id: "user-1",
  name: "TestUser",
  role: "WORKER",
  phoneHash: "hashed",
  dobHash: "hashed",
  phoneEncrypted: "enc-phone",
  dobEncrypted: "enc-dob",
  nameMasked: "T**",
  piiViewFull: false,
  loginExempt: false,
  externalWorkerId: null as string | null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
};

function createApp(
  body: WorkerLoginBody | null,
  envOverrides: Record<string, unknown> = {},
) {
  const app = new Hono();
  app.post("/test", (c) =>
    handleWorkerLogin(
      c as unknown as Parameters<typeof handleWorkerLogin>[0],
      body,
    ),
  );

  const env = {
    DB: {},
    KV: {},
    HMAC_SECRET: "secret",
    ENCRYPTION_KEY: "enc",
    JWT_SECRET: "jwt",
    ...envOverrides,
  };

  return { app, env };
}

function postLogin(app: Hono, env: Record<string, unknown>) {
  return app.request(
    "/test",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
    env,
  );
}

describe("handleWorkerLogin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHmac.mockResolvedValue("hashed");
    mockSignJwt.mockResolvedValue("jwt-token");
    mockLogAuditWithContext.mockResolvedValue(undefined);
    mockGetLockoutStatus.mockResolvedValue(null);
    mockClearLockout.mockResolvedValue(undefined);
    mockGetLoginLockoutKey.mockReturnValue("login:lockout:hashed");
    mockResolveLockoutActorId.mockResolvedValue(null);
    mockLogLoginLockoutEvent.mockResolvedValue(undefined);
    mockFasSearchEmployeeByPhone.mockResolvedValue(null);
    mockFasCheckWorkerAttendance.mockResolvedValue({ hasAttendance: false });
    mockSyncSingleFasEmployee.mockResolvedValue(null);
    mockSocialNoToDob.mockReturnValue(null);
    mockNormalizeDeviceId.mockReturnValue(null);
    mockEncrypt.mockResolvedValue("encrypted");
    mockDecrypt.mockResolvedValue("decrypted");
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockAccountLockedResponse.mockReturnValue(
      new Response(
        JSON.stringify({ success: false, error: { code: "ACCOUNT_LOCKED" } }),
        { status: 423 },
      ),
    );
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false });
    const { app, env } = createApp(VALID_BODY);

    const res = await postLogin(app, env);

    expect(res.status).toBe(429);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("returns lockout response on name mismatch when max attempts reached", async () => {
    const user = { ...MOCK_USER, name: "DifferentName" };
    mockLimit.mockResolvedValueOnce([user]);
    mockRecordFailedAttempt.mockResolvedValue({
      attempts: 5,
      lockedUntil: Date.now() + 1_800_000,
    });

    const { app, env } = createApp(VALID_BODY);
    const res = await postLogin(app, env);

    expect(res.status).toBe(423);
    expect(mockLogLoginLockoutEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      user.id,
      "hashed",
      5,
      expect.any(Number),
    );
  });

  it("succeeds when FAS attendance is confirmed", async () => {
    const user = { ...MOCK_USER, externalWorkerId: "FAS-001" };
    mockLimit.mockResolvedValueOnce([user]);
    mockFasCheckWorkerAttendance.mockResolvedValue({ hasAttendance: true });

    const { app, env } = createApp(VALID_BODY, {
      FAS_HYPERDRIVE: { connectionString: "test" },
      REQUIRE_ATTENDANCE_FOR_LOGIN: "true",
    });
    const res = await postLogin(app, env);

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      success: boolean;
      data: { accessToken: string };
    };
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBe("jwt-token");
    expect(mockFasCheckWorkerAttendance).toHaveBeenCalled();
  });

  it("returns 400 for null body", async () => {
    const { app, env } = createApp(null);
    const res = await postLogin(app, env);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe("INVALID_JSON");
  });

  it("handles FAS search failure gracefully and falls back to local DB", async () => {
    mockFasSearchEmployeeByPhone.mockRejectedValueOnce(
      new Error("DB connection failed"),
    );
    mockLimit.mockResolvedValueOnce([MOCK_USER]);

    const { app, env } = createApp(VALID_BODY, {
      FAS_HYPERDRIVE: { connectionString: "test" },
      REQUIRE_ATTENDANCE_FOR_LOGIN: "false",
    });
    const res = await postLogin(app, env);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  it("logs lockout event with actorId on USER_NOT_FOUND lockout", async () => {
    mockLimit.mockResolvedValueOnce([]);
    mockRecordFailedAttempt.mockResolvedValue({
      attempts: 5,
      lockedUntil: Date.now() + 1_800_000,
    });
    mockResolveLockoutActorId.mockResolvedValue("actor-1");

    const { app, env } = createApp(VALID_BODY);
    const res = await postLogin(app, env);

    expect(res.status).toBe(423);
    expect(mockLogLoginLockoutEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "actor-1",
      "hashed",
      5,
      expect.any(Number),
    );
  });

  it("adjusts attendance date when KST time is before 5 AM", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 2025-01-15T19:30:00Z = 2025-01-16 04:30 KST (before 5 AM → use previous day)
    vi.setSystemTime(new Date("2025-01-15T19:30:00Z"));

    try {
      const user = { ...MOCK_USER, externalWorkerId: "FAS-001" };
      mockLimit.mockResolvedValueOnce([user]);
      mockFasCheckWorkerAttendance.mockResolvedValue({ hasAttendance: true });

      const { app, env } = createApp(VALID_BODY, {
        FAS_HYPERDRIVE: { connectionString: "test" },
        REQUIRE_ATTENDANCE_FOR_LOGIN: "true",
      });
      const res = await postLogin(app, env);

      expect(res.status).toBe(200);
      expect(mockFasCheckWorkerAttendance).toHaveBeenCalledWith(
        expect.anything(),
        "FAS-001",
        "20250115",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
