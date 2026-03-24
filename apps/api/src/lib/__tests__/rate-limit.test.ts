import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  checkOtpRateLimit,
  recordLoginFailure,
  resetLoginFailures,
  resetOtpLimit,
} from "../rate-limit";
import type { Env } from "../../types";

function makeEnv(
  fetchImpl?: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Env {
  const defaultFetch = async (
    _url: string | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      action: string;
    };
    if (body.action === "checkLimit") {
      return Response.json({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      });
    }
    if (body.action === "checkOtpLimit") {
      return Response.json({
        allowed: true,
        hourlyRemaining: 4,
        dailyRemaining: 9,
        resetAt: Date.now() + 3600000,
      });
    }
    if (body.action === "recordFailure") {
      return Response.json({ failures: 1, lockedUntil: null });
    }
    if (body.action === "resetFailures" || body.action === "resetOtpLimit") {
      return Response.json({ ok: true });
    }
    return new Response("unknown", { status: 400 });
  };

  const stub = {
    fetch: vi.fn(fetchImpl ?? defaultFetch),
  };
  return {
    RATE_LIMITER: {
      idFromName: vi.fn(() => "id-1"),
      get: vi.fn(() => stub),
    },
  } as unknown as Env;
}

function makeEnvNoRL(): Env {
  return { RATE_LIMITER: undefined } as unknown as Env;
}

describe("rate-limit lib", () => {
  describe("checkRateLimit", () => {
    it("returns DO result when available", async () => {
      const env = makeEnv();
      const result = await checkRateLimit(env, "test-key", 10, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it("falls back to in-memory when no RATE_LIMITER binding", async () => {
      const env = makeEnvNoRL();
      const result = await checkRateLimit(env, "fallback-key", 5, 60000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("falls back to in-memory when DO fetch throws", async () => {
      const env = makeEnv(async () => {
        throw new Error("DO unavailable");
      });
      const result = await checkRateLimit(env, "err-key", 5, 60000);
      expect(result.allowed).toBe(true);
    });

    it("falls back to in-memory when DO returns non-ok", async () => {
      const env = makeEnv(async () => new Response("error", { status: 500 }));
      const result = await checkRateLimit(env, "nok-key", 5, 60000);
      expect(result.allowed).toBe(true);
    });

    it("in-memory denies when at limit", async () => {
      const env = makeEnvNoRL();
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(env, "limit-key", 3, 60000);
      }
      const result = await checkRateLimit(env, "limit-key", 3, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("in-memory resets after window expires", async () => {
      const env = makeEnvNoRL();
      // Fill limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(env, "expire-key", 3, 100);
      }
      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 150));
      const result = await checkRateLimit(env, "expire-key", 3, 100);
      expect(result.allowed).toBe(true);
    });
  });

  describe("checkOtpRateLimit", () => {
    it("returns DO result when available", async () => {
      const env = makeEnv();
      const result = await checkOtpRateLimit(env, "010-1234-5678");
      expect(result.allowed).toBe(true);
      expect(result.hourlyRemaining).toBe(4);
    });

    it("falls back to in-memory when no DO", async () => {
      const env = makeEnvNoRL();
      const result = await checkOtpRateLimit(env, "010-9999-8888");
      expect(result.allowed).toBe(true);
      expect(result.dailyRemaining).toBe(10);
    });
  });

  describe("recordLoginFailure", () => {
    it("returns result from DO", async () => {
      const env = makeEnv();
      const result = await recordLoginFailure(env, "login-key");
      expect(result).toEqual({ failures: 1, lockedUntil: null });
    });

    it("returns null when no DO", async () => {
      const env = makeEnvNoRL();
      const result = await recordLoginFailure(env, "login-key");
      expect(result).toBeNull();
    });
  });

  describe("resetLoginFailures", () => {
    it("calls DO", async () => {
      const env = makeEnv();
      await resetLoginFailures(env, "reset-key");
      const limiter = env.RATE_LIMITER as unknown as {
        get: (...args: unknown[]) => { fetch: ReturnType<typeof vi.fn> };
      };
      const stub = limiter.get();
      expect(stub.fetch).toHaveBeenCalled();
    });

    it("does nothing when no DO", async () => {
      const env = makeEnvNoRL();
      await resetLoginFailures(env, "reset-key");
      // no throw
    });
  });

  describe("resetOtpLimit", () => {
    it("calls DO", async () => {
      const env = makeEnv();
      await resetOtpLimit(env, "010-1234-5678");
      // no throw
    });
  });

  describe("cleanupExpiredEntries (via checkInMemoryLimit)", () => {
    it("cleans up expired entries after 5 min interval", async () => {
      const envNoRL = makeEnvNoRL();
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      try {
        await checkRateLimit(envNoRL, "clean-a", 5, 100);
        await checkRateLimit(envNoRL, "clean-b", 5, 100);

        vi.setSystemTime(new Date("2026-01-01T00:06:00.000Z"));

        const fresh = await checkRateLimit(envNoRL, "clean-a", 5, 100);
        expect(fresh.allowed).toBe(true);
        expect(fresh.remaining).toBe(4);

        const newKey = await checkRateLimit(envNoRL, "clean-c", 5, 60000);
        expect(newKey.allowed).toBe(true);
        expect(newKey.remaining).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });

    it("deletes expired fallback entries after cleanup interval elapses", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      try {
        vi.resetModules();
        const mod = await import("../rate-limit");
        const envNoRL = makeEnvNoRL();

        await mod.checkRateLimit(envNoRL, "expired-1", 5, 1000);
        await mod.checkRateLimit(envNoRL, "expired-2", 5, 1000);

        vi.setSystemTime(new Date("2026-01-01T00:06:00.000Z"));
        await mod.checkRateLimit(envNoRL, "cleanup-trigger", 5, 60000);

        const afterCleanup = await mod.checkRateLimit(
          envNoRL,
          "expired-1",
          5,
          1000,
        );
        expect(afterCleanup.allowed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
