import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mockHandleWorkerLogin = vi.fn(async () => new Response("worker"));
const mockHandleAdminLogin = vi.fn(async () => new Response("admin"));

vi.mock("../login-worker", () => ({
  handleWorkerLogin: mockHandleWorkerLogin,
}));

vi.mock("../login-admin", () => ({
  handleAdminLogin: mockHandleAdminLogin,
}));

vi.mock("../../../middleware/rate-limit", () => ({
  authRateLimitMiddleware: () =>
    vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: () =>
    vi.fn(
      async (
        c: { req: { valid: () => unknown } },
        next: () => Promise<void>,
      ) => {
        c.req.valid = () => {
          throw new Error("invalid-json");
        };
        await next();
      },
    ),
}));

describe("auth/login route body fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes null to worker login handler when validated json is unavailable", async () => {
    const { default: route } = await import("../login");
    const app = new Hono();
    app.route("/", route);

    const res = await app.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
      {
        DB: {},
        KV: {},
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc",
        JWT_SECRET: "jwt",
      },
    );

    expect(res.status).toBe(200);
    expect(mockHandleWorkerLogin).toHaveBeenCalledTimes(1);
    expect(mockHandleWorkerLogin).toHaveBeenCalledWith(expect.anything(), null);
  });

  it("passes null to admin login handler when validated json is unavailable", async () => {
    const { default: route } = await import("../login");
    const app = new Hono();
    app.route("/", route);

    const res = await app.request(
      "/admin/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
      {
        DB: {},
        KV: {},
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc",
        JWT_SECRET: "jwt",
      },
    );

    expect(res.status).toBe(200);
    expect(mockHandleAdminLogin).toHaveBeenCalledTimes(1);
    expect(mockHandleAdminLogin).toHaveBeenCalledWith(expect.anything(), null);
  });
});
