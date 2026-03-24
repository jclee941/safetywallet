import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { authRateLimitMiddleware, rateLimitMiddleware } from "../rate-limit";

type MockStub = {
  fetch: ReturnType<typeof vi.fn>;
};

type MockNamespace = {
  idFromName: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function createRateLimiter(fetchImpl: MockStub["fetch"]): MockNamespace {
  const stub: MockStub = { fetch: fetchImpl };
  return {
    idFromName: vi.fn((name: string) => `id:${name}`),
    get: vi.fn(() => stub),
  };
}

function createApp(
  middleware: typeof rateLimitMiddleware extends (...args: never[]) => infer R
    ? R
    : never,
) {
  const app = new Hono<{
    Bindings: { RATE_LIMITER?: MockNamespace };
    Variables: { auth?: { user?: { id?: string } } };
  }>();

  app.use("*", middleware);
  app.get("/resource", (c) => c.json({ ok: true }));
  return app;
}

describe("rateLimitMiddleware", () => {
  it("skips limiting when RATE_LIMITER binding is missing", async () => {
    const app = createApp(rateLimitMiddleware());

    const res = await app.request("http://localhost/resource", undefined, {});
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("sets rate limit headers and allows request", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: 42,
            resetAt: 1_700_000_000_000,
          }),
          { status: 200 },
        ),
      ),
    );
    const app = createApp(rateLimitMiddleware({ maxRequests: 50 }));

    const res = await app.request(
      "http://localhost/resource",
      { headers: { "CF-Connecting-IP": "1.2.3.4" } },
      { RATE_LIMITER: rateLimiter },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("50");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("42");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(1_700_000_000_000 / 1000)),
    );
  });

  it("defaults remaining/reset headers when limiter payload is non-finite", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: Number.NaN,
            resetAt: Number.NaN,
          }),
          { status: 200 },
        ),
      ),
    );
    const app = createApp(rateLimitMiddleware({ windowMs: 120_000 }));

    const res = await app.request("http://localhost/resource", undefined, {
      RATE_LIMITER: rateLimiter,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const resetHeader = Number(res.headers.get("X-RateLimit-Reset"));
    expect(Number.isFinite(resetHeader)).toBe(true);
  });

  it("returns 429 when request is rate-limited", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
          }),
          { status: 200 },
        ),
      ),
    );
    const app = createApp(rateLimitMiddleware());

    const res = await app.request("http://localhost/resource", undefined, {
      RATE_LIMITER: rateLimiter,
    });
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("returns 503 when limiter service responds with non-ok status", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(new Response("down", { status: 503 })),
    );
    const app = createApp(rateLimitMiddleware());

    const res = await app.request("http://localhost/resource", undefined, {
      RATE_LIMITER: rateLimiter,
    });
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns 503 when limiter fetch throws", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockRejectedValue(new Error("network failure")),
    );
    const app = createApp(rateLimitMiddleware());

    const res = await app.request("http://localhost/resource", undefined, {
      RATE_LIMITER: rateLimiter,
    });
    const body = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMIT_ERROR");
  });

  it("uses user ID for key when auth has user.id", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: 99,
            resetAt: Date.now() + 60_000,
          }),
          { status: 200 },
        ),
      ),
    );

    const app = new Hono<{
      Bindings: { RATE_LIMITER?: MockNamespace };
      Variables: { auth?: { user?: { id?: string } } };
    }>();
    app.use("*", async (c, next) => {
      c.set("auth", { user: { id: "user-42" } });
      await next();
    });
    app.use("*", rateLimitMiddleware());
    app.get("/resource", (c) => c.json({ ok: true }));

    const res = await app.request("http://localhost/resource", undefined, {
      RATE_LIMITER: rateLimiter,
    });

    expect(res.status).toBe(200);
    expect(rateLimiter.idFromName).toHaveBeenCalledWith("user:user-42");
  });

  it("authRateLimitMiddleware keys by auth IP prefix", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            allowed: true,
            remaining: 4,
            resetAt: Date.now() + 60_000,
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    const app = createApp(authRateLimitMiddleware());

    const res = await app.request(
      "http://localhost/resource",
      { headers: { "CF-Connecting-IP": "8.8.8.8" } },
      { RATE_LIMITER: rateLimiter },
    );

    expect(res.status).toBe(200);
    expect(rateLimiter.idFromName).toHaveBeenCalledWith("auth:8.8.8.8");
  });

  it("falls back to X-Forwarded-For and anonymous auth key generation", async () => {
    const rateLimiter = createRateLimiter(
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              allowed: true,
              remaining: 1,
              resetAt: Date.now() + 60_000,
            }),
            { status: 200 },
          ),
      ),
    );
    const app = createApp(authRateLimitMiddleware());

    const forwardedRes = await app.request(
      "http://localhost/resource",
      { headers: { "X-Forwarded-For": "9.9.9.9" } },
      { RATE_LIMITER: rateLimiter },
    );
    expect(forwardedRes.status).toBe(200);
    expect(rateLimiter.idFromName).toHaveBeenCalledWith("auth:9.9.9.9");

    const anonRes = await app.request(
      "http://localhost/resource",
      {},
      {
        RATE_LIMITER: rateLimiter,
      },
    );
    expect(anonRes.status).toBe(200);
    expect(rateLimiter.idFromName).toHaveBeenCalledWith("auth:anonymous");
  });
});
