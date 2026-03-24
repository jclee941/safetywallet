import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(null),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            id: "a1",
            role: "SUPER_ADMIN",
            nameMasked: "관*자",
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("../../../db/schema", () => ({
  users: { id: "id", role: "role", phoneHash: "phoneHash" },
}));

vi.mock("../../../lib/crypto", () => ({
  hmac: vi.fn().mockResolvedValue("hash"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../lib/jwt", () => ({
  signJwt: vi.fn().mockResolvedValue("jwt-token"),
}));

vi.mock("../../../lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

type AppEnv = { Bindings: Record<string, unknown> };

function makeEnv() {
  return {
    DB: {},
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD_HASH: "hash",
    HMAC_SECRET: "secret",
    JWT_SECRET: "jwt",
    RATE_LIMITER: {},
  };
}

describe("handleAdminLogin", () => {
  it("returns 400 when body is null", async () => {
    const { handleAdminLogin } = await import("../login-admin");
    const app = new Hono<AppEnv>();
    app.post("/test", async (c) => {
      return handleAdminLogin(
        c as unknown as Parameters<typeof handleAdminLogin>[0],
        null,
      );
    });

    const res = await app.request("/test", { method: "POST" }, makeEnv());

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 when username or password missing", async () => {
    const { handleAdminLogin } = await import("../login-admin");
    const app = new Hono<AppEnv>();
    app.post("/test", async (c) => {
      return handleAdminLogin(
        c as unknown as Parameters<typeof handleAdminLogin>[0],
        {
          username: "admin",
        },
      );
    });

    const res = await app.request("/test", { method: "POST" }, makeEnv());

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("MISSING_FIELDS");
  });
});
