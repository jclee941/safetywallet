import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../types";
import { turnstileMiddleware } from "../turnstile";

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeEnv(
  overrides: Partial<Pick<Env, "ENVIRONMENT" | "TURNSTILE_SECRET">> = {},
): Env {
  return {
    ENVIRONMENT: "production",
    TURNSTILE_SECRET: "test-secret-key",
    ...overrides,
  } as unknown as Env;
}

function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", turnstileMiddleware());
  app.post("/api/test", (c) => c.json({ ok: true }));
  return { app, env };
}

function jsonRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("turnstileMiddleware", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Skip in development ──

  describe("skip conditions", () => {
    it("skips verification when ENVIRONMENT is not production", async () => {
      const env = makeEnv({ ENVIRONMENT: "development" });
      const { app } = createApp(env);

      const res = await app.request(jsonRequest({}), undefined, env);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });
    });

    it("fails closed when TURNSTILE_SECRET is empty in production", async () => {
      const env = makeEnv({ TURNSTILE_SECRET: "" });
      const { app } = createApp(env);

      const res = await app.request(jsonRequest({}), undefined, env);

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("TURNSTILE_NOT_CONFIGURED");
    });

    it("fails closed when TURNSTILE_SECRET is undefined in production", async () => {
      const env = makeEnv({ TURNSTILE_SECRET: undefined as unknown as string });
      const { app } = createApp(env);

      const res = await app.request(jsonRequest({}), undefined, env);

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("TURNSTILE_NOT_CONFIGURED");
    });

    // ── 2. Missing token ──

    describe("missing token", () => {
      it("returns 400 when turnstileToken is missing from JSON body", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ username: "test" }),
          undefined,
          env,
        );

        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe("TURNSTILE_TOKEN_MISSING");
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("returns 400 when body has no Content-Type match", async () => {
        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          new Request("http://localhost/api/test", {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: "turnstileToken=abc",
          }),
          undefined,
          env,
        );

        expect(res.status).toBe(400);
      });
    });

    // ── 3. Cloudflare rejects ──

    describe("verification rejected", () => {
      it("returns 403 when Cloudflare returns success: false", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(
            JSON.stringify({
              success: false,
              "error-codes": ["invalid-input-response"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ turnstileToken: "bad-token" }),
          undefined,
          env,
        );

        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe("TURNSTILE_REJECTED");
        expect(fetchSpy).toHaveBeenCalledOnce();
      });

      it("returns 403 when siteverify returns non-OK HTTP status", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response("Internal Server Error", { status: 500 }),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ turnstileToken: "some-token" }),
          undefined,
          env,
        );

        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe("TURNSTILE_SERVICE_ERROR");
      });
    });

    // ── 4. Verification success ──

    describe("verification success", () => {
      it("calls next() when Cloudflare returns success: true", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ turnstileToken: "valid-token" }),
          undefined,
          env,
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({ ok: true });
      });

      it("sends correct parameters to siteverify endpoint", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        await app.request(
          jsonRequest(
            { turnstileToken: "my-token" },
            { "CF-Connecting-IP": "1.2.3.4" },
          ),
          undefined,
          env,
        );

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        );
        expect(init?.method).toBe("POST");

        const body = new URLSearchParams(init?.body as string);
        expect(body.get("secret")).toBe("test-secret-key");
        expect(body.get("response")).toBe("my-token");
        expect(body.get("remoteip")).toBe("1.2.3.4");
      });
    });

    // ── 5. Network failure (fail-secure) ──

    describe("network failure", () => {
      it("returns 403 when fetch throws a network error", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
          new Error("Network error"),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ turnstileToken: "valid-token" }),
          undefined,
          env,
        );

        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe("TURNSTILE_VERIFICATION_FAILED");
      });

      it("returns 403 when fetch is aborted (timeout)", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(
          new DOMException("The operation was aborted", "AbortError"),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          jsonRequest({ turnstileToken: "valid-token" }),
          undefined,
          env,
        );

        expect(res.status).toBe(403);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe("TURNSTILE_VERIFICATION_FAILED");
      });
    });

    // ── 6. Form data extraction ──

    describe("form data token extraction", () => {
      it("extracts token from multipart/form-data", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const formData = new FormData();
        formData.set("turnstileToken", "form-token");
        formData.set("otherField", "value");

        const res = await app.request(
          new Request("http://localhost/api/test", {
            method: "POST",
            body: formData,
          }),
          undefined,
          env,
        );

        expect(res.status).toBe(200);
      });

      it("extracts token from url-encoded form data", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

        const env = makeEnv();
        const { app } = createApp(env);

        const res = await app.request(
          new Request("http://localhost/api/test", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              turnstileToken: "urlenc-token",
            }).toString(),
          }),
          undefined,
          env,
        );

        expect(res.status).toBe(200);
      });
    });
  });
});
