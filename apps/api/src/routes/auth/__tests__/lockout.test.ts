import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  LOGIN_LOCKOUT_MS,
  accountLockedResponse,
  clearLockout,
  getLoginLockoutKey,
  getLockoutStatus,
  getRetryAfterSeconds,
  isExpiredLock,
  logLoginLockoutEvent,
  parseLoginLockoutRecord,
  recordFailedAttempt,
  resolveLockoutActorId,
} from "../lockout";

vi.mock("../../../lib/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

describe("auth/lockout", () => {
  it("parses valid lockout record and rejects malformed values", () => {
    expect(parseLoginLockoutRecord('{"attempts":2,"lockedUntil":123}')).toEqual(
      {
        attempts: 2,
        lockedUntil: 123,
      },
    );
    expect(parseLoginLockoutRecord('{"attempts":"2"}')).toBeNull();
    expect(parseLoginLockoutRecord("not-json")).toBeNull();
    expect(parseLoginLockoutRecord(null)).toBeNull();
  });

  it("returns 429 lock response with Retry-After header", async () => {
    const app = new Hono();
    app.get("/", (c) => accountLockedResponse(c, 10_500, 10_000));

    const res = await app.request("/");
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("1");
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "ACCOUNT_LOCKED",
        lockedUntil: 10_500,
        retryAfter: 1,
      },
    });
  });

  it("builds lockout keys and retry-after values correctly", () => {
    expect(getLoginLockoutKey("hashed-phone")).toBe(
      "login:lockout:hashed-phone",
    );
    expect(getRetryAfterSeconds(10_500, 10_000)).toBe(1);
    expect(getRetryAfterSeconds(14_000, 10_000)).toBe(4);
    expect(isExpiredLock({ attempts: 5, lockedUntil: 1_000 }, 2_000)).toBe(
      true,
    );
    expect(isExpiredLock({ attempts: 1, lockedUntil: 3_000 }, 2_000)).toBe(
      false,
    );
  });

  it("stores lockout ttl when attempts reach max", async () => {
    const kv = {
      put: vi.fn(async () => undefined),
    };

    const updated = await recordFailedAttempt(
      kv as unknown as Parameters<typeof recordFailedAttempt>[0],
      "k",
      { attempts: 4 },
      50_000,
    );

    expect(updated.attempts).toBe(5);
    expect(updated.lockedUntil).toBe(50_000 + LOGIN_LOCKOUT_MS);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it("stores attempt ttl while below lockout threshold", async () => {
    const kv = {
      put: vi.fn(async () => undefined),
    };

    const updated = await recordFailedAttempt(
      kv as unknown as Parameters<typeof recordFailedAttempt>[0],
      "k",
      { attempts: 1 },
      10_000,
    );

    expect(updated).toEqual({ attempts: 2 });
    expect(kv.put).toHaveBeenCalledWith(
      "k",
      JSON.stringify({ attempts: 2 }),
      expect.objectContaining({ expirationTtl: 900 }),
    );
  });

  it("gracefully handles KV write failure at lockout threshold", async () => {
    const kv = {
      put: vi.fn(async () => {
        throw new Error("kv-put-failed");
      }),
    };

    const updated = await recordFailedAttempt(
      kv as unknown as Parameters<typeof recordFailedAttempt>[0],
      "k",
      { attempts: 4 },
      50_000,
    );

    expect(updated.attempts).toBe(5);
    expect(updated.lockedUntil).toBe(50_000 + LOGIN_LOCKOUT_MS);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it("gracefully handles KV write failure below lockout threshold", async () => {
    const kv = {
      put: vi.fn(async () => {
        throw new Error("kv-put-failed");
      }),
    };

    const updated = await recordFailedAttempt(
      kv as unknown as Parameters<typeof recordFailedAttempt>[0],
      "k",
      { attempts: 1 },
      10_000,
    );

    expect(updated).toEqual({ attempts: 2 });
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it("returns null and cleans expired lock even when KV delete fails", async () => {
    const kv = {
      get: vi.fn(async () =>
        JSON.stringify({ attempts: 5, lockedUntil: 1_000 }),
      ),
      delete: vi.fn(async () => {
        throw new Error("delete-failed");
      }),
    };

    const result = await getLockoutStatus(
      kv as unknown as Parameters<typeof getLockoutStatus>[0],
      "login:lockout:hash",
      2_000,
    );

    expect(result).toBeNull();
    expect(kv.delete).toHaveBeenCalledWith("login:lockout:hash");
  });

  it("returns null when KV read fails (fail-open)", async () => {
    const kv = {
      get: vi.fn(async () => {
        throw new Error("kv-read-error");
      }),
    };

    const result = await getLockoutStatus(
      kv as unknown as Parameters<typeof getLockoutStatus>[0],
      "login:lockout:hash",
      Date.now(),
    );

    expect(result).toBeNull();
  });

  it("returns active lockout record when lock is still valid", async () => {
    const kv = {
      get: vi.fn(async () =>
        JSON.stringify({ attempts: 3, lockedUntil: Date.now() + 60_000 }),
      ),
      delete: vi.fn(async () => undefined),
    };

    const result = await getLockoutStatus(
      kv as unknown as Parameters<typeof getLockoutStatus>[0],
      "login:lockout:hash",
      Date.now(),
    );

    expect(result).toMatchObject({ attempts: 3 });
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("swallows KV delete errors while clearing lockout", async () => {
    const kv = {
      delete: vi.fn(async () => {
        throw new Error("clear-failed");
      }),
    };

    await expect(
      clearLockout(
        kv as unknown as Parameters<typeof clearLockout>[0],
        "login:lockout:hash",
      ),
    ).resolves.toBeUndefined();
    expect(kv.delete).toHaveBeenCalledWith("login:lockout:hash");
  });

  it("resolves lockout actor id from users table", async () => {
    const db = {
      select: vi.fn(() => {
        const chain = {
          from: vi.fn(() => chain),
          where: vi.fn(() => chain),
          get: vi.fn(async () => ({ id: "user-1" })),
        };
        return chain;
      }),
    };

    const actorId = await resolveLockoutActorId(
      db as unknown as Parameters<typeof resolveLockoutActorId>[0],
      "phone-hash",
    );

    expect(actorId).toBe("user-1");
  });

  it("writes a login lockout audit event with request metadata", async () => {
    const insertValues = vi.fn(async () => undefined);
    const db = {
      insert: vi.fn(() => ({
        values: insertValues,
      })),
    };

    const app = new Hono();
    app.get("/", async (c) => {
      await logLoginLockoutEvent(
        db as unknown as Parameters<typeof logLoginLockoutEvent>[0],
        c,
        "actor-1",
        "phone-hash",
        5,
        99_000,
      );
      return c.json({ ok: true });
    });

    const res = await app.request("/", {
      headers: {
        "CF-Connecting-IP": "1.2.3.4",
        "User-Agent": "vitest-agent",
      },
    });

    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LOGIN_LOCKOUT",
        actorId: "actor-1",
        targetId: "phone-hash",
        ip: "1.2.3.4",
        userAgent: "vitest-agent",
      }),
    );
  });
});
