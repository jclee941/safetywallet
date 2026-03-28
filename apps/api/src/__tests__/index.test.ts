import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../index";
import worker from "../index";
import { createErrorIssue } from "../lib/auto-issue";
import { fasGetAllEmployeesPaginated } from "../lib/fas";
import {
  syncFasEmployeesToD1,
  deactivateRetiredEmployees,
} from "../lib/fas-sync";

class MockHtmlElement {
  attributes = new Map<string, string>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

type HtmlHandler = {
  element(element: MockHtmlElement): void;
};

class MockHTMLRewriter {
  private readonly handlers: HtmlHandler[] = [];

  on(_selector: string, handler: HtmlHandler): this {
    this.handlers.push(handler);
    return this;
  }

  transform(response: Response): Response {
    for (const handler of this.handlers) {
      handler.element(new MockHtmlElement());
    }

    return response;
  }
}

// Mock the logger to prevent console noise
vi.mock("../lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(
    async (
      c: {
        set: (key: string, value: unknown) => void;
      },
      next: () => Promise<void>,
    ) => {
      c.set("auth", {
        user: {
          id: "admin-1",
          role: "SUPER_ADMIN",
          phone: "010-0000-0000",
          name: "Admin",
          nameMasked: "A**",
        },
        loginDate: "2025-01-01",
      });
      await next();
    },
  ),
}));

vi.mock("../lib/auto-issue", () => ({
  createErrorIssue: vi.fn(async () => undefined),
}));

vi.mock("../lib/fas", () => ({
  fasGetAllEmployeesPaginated: vi.fn(),
  initFasConfig: vi.fn(),
}));

vi.mock("../lib/fas-sync", () => ({
  syncFasEmployeesToD1: vi.fn(),
  deactivateRetiredEmployees: vi.fn(),
}));

describe("API Index", () => {
  let mockEnv: any;

  beforeEach(() => {
    Object.defineProperty(globalThis, "HTMLRewriter", {
      configurable: true,
      writable: true,
      value: MockHTMLRewriter,
    });

    mockEnv = {
      ALLOWED_ORIGINS: "http://localhost:3000,https://safetywallet.jclee.me",
      ENVIRONMENT: "test",
      KV: {
        get: vi.fn().mockResolvedValue(null),
      },
      ASSETS: {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response("Not Found", { status: 404 })),
      },
    };
  });

  describe("CORS Middleware", () => {
    it("should allow matching origins", async () => {
      const res = await app.request(
        "http://localhost/api/health",
        {
          headers: {
            Origin: "https://safetywallet.jclee.me",
          },
        },
        mockEnv,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://safetywallet.jclee.me",
      );
    });

    it("should allow localhost origins dynamically", async () => {
      const res = await app.request(
        "http://localhost/api/health",
        {
          headers: {
            Origin: "http://localhost:3001",
          },
        },
        mockEnv,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3001",
      );
    });

    it("should reject non-matching origins", async () => {
      const res = await app.request(
        "http://localhost/api/health",
        {
          headers: {
            Origin: "https://evil.com",
          },
        },
        mockEnv,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("Health Endpoint", () => {
    it("should return healthy status", async () => {
      const res = await app.request("http://localhost/api/health", {}, mockEnv);
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("healthy");
      expect(json.timestamp).toBeDefined();
    });
  });

  describe("System Status Endpoint", () => {
    it("should return empty notices when KV returns null", async () => {
      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.notices).toEqual([]);
      expect(json.data.hasIssues).toBe(false);
    });

    it("should return fas_down notice when KV fas-status is down", async () => {
      mockEnv.KV.get.mockImplementation(async (key: string) => {
        if (key === "fas-status") return "down";
        return null;
      });

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.data.hasIssues).toBe(true);
      expect(json.data.notices[0].type).toBe("fas_down");
    });

    it("should return parsed maintenance notice", async () => {
      mockEnv.KV.get.mockImplementation(async (key: string) => {
        if (key === "maintenance-message")
          return JSON.stringify({
            message: "Scheduled maintenance",
            severity: "critical",
          });
        return null;
      });

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.data.notices[0]).toEqual({
        type: "maintenance",
        message: "Scheduled maintenance",
        severity: "critical",
      });
    });

    it("should return raw maintenance notice if parsing fails", async () => {
      mockEnv.KV.get.mockImplementation(async (key: string) => {
        if (key === "maintenance-message") return "Just a plain string message";
        return null;
      });

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.data.notices[0]).toEqual({
        type: "maintenance",
        message: "Just a plain string message",
        severity: "info",
      });
    });

    it("should handle KV errors gracefully", async () => {
      mockEnv.KV.get.mockRejectedValue(new Error("KV error"));

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(json.data.notices).toEqual([]);
    });
  });

  describe("API 404 Handler", () => {
    it("should return formatted 404 JSON for unknown API routes", async () => {
      const res = await app.request(
        "http://localhost/api/unknown-route",
        {},
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Static HTML serving", () => {
    it("adds nonce CSP headers for direct HTML assets", async () => {
      mockEnv.ASSETS.fetch = vi.fn().mockResolvedValue(
        new Response(
          "<html><head><style>body{}</style></head><body><script>1</script></body></html>",
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          },
        ),
      );

      const res = await app.request("http://localhost/", {}, mockEnv);
      const csp = res.headers.get("Content-Security-Policy");

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
      expect(csp).toContain("script-src 'self' 'nonce-");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).not.toContain("style-src 'self' 'unsafe-inline' 'nonce-");
    });

    it("applies the same nonce CSP behavior to SPA fallback HTML", async () => {
      mockEnv.ASSETS.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("missing", { status: 404 }))
        .mockResolvedValueOnce(
          new Response("<html><body><script>1</script></body></html>", {
            status: 200,
          }),
        );

      const res = await app.request("http://localhost/dashboard", {}, mockEnv);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
      expect(res.headers.get("Content-Security-Policy")).toContain(
        "script-src 'self' 'nonce-",
      );
    });

    it("redirects /admin path on non-admin hostname", async () => {
      const res = await app.request(
        "http://safetywallet.jclee.me/admin",
        {},
        mockEnv,
      );
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toContain(
        "admin.safetywallet.jclee.me/",
      );
    });

    it("adds immutable cache header for static js assets", async () => {
      mockEnv.ASSETS.fetch = vi
        .fn()
        .mockResolvedValue(new Response("console.log(1)", { status: 200 }));

      const res = await app.request("http://localhost/main.js", {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("returns 500 when static asset fetch throws", async () => {
      mockEnv.ASSETS.fetch = vi
        .fn()
        .mockRejectedValue(new Error("assets down"));
      const res = await app.request("http://localhost/some/path", {}, mockEnv);
      expect(res.status).toBe(500);
    });

    it("requests /admin/index.html on admin hostname root", async () => {
      mockEnv.ASSETS.fetch = vi.fn().mockResolvedValue(
        new Response("<html><body>admin</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const res = await app.request(
        "https://admin.safetywallet.jclee.me/",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);

      const firstCall = mockEnv.ASSETS.fetch.mock.calls[0] as [URL];
      expect(firstCall[0].pathname).toBe("/admin/index.html");
    });

    it("uses /admin/index.html fallback for missing admin route assets", async () => {
      mockEnv.ASSETS.fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("missing", { status: 404 }))
        .mockResolvedValueOnce(
          new Response("<html><body>admin fallback</body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
        );

      const res = await app.request(
        "https://admin.safetywallet.jclee.me/settings",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);

      const secondCall = mockEnv.ASSETS.fetch.mock.calls[1] as [URL];
      expect(secondCall[0].pathname).toBe("/admin/index.html");
    });

    it("passes through non-html 200 asset responses unchanged", async () => {
      mockEnv.ASSETS.fetch = vi.fn().mockResolvedValue(
        new Response("plain text", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      const res = await app.request("http://localhost/readme.txt", {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/plain");
      expect(await res.text()).toBe("plain text");
    });

    it("rejects localhost origin in production when not explicitly allowed", async () => {
      mockEnv.ENVIRONMENT = "production";
      mockEnv.ALLOWED_ORIGINS = "https://safetywallet.jclee.me";

      const res = await app.request(
        "http://localhost/api/health",
        {
          headers: {
            Origin: "http://localhost:3001",
          },
        },
        mockEnv,
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("uses empty string fallback when ALLOWED_ORIGINS is undefined", async () => {
      delete mockEnv.ALLOWED_ORIGINS;
      const res = await app.request(
        "http://localhost/api/health",
        {
          headers: {
            Origin: "http://localhost:3000",
          },
        },
        mockEnv,
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });
  });

  describe("Scheduler admin proxy", () => {
    it("returns 503 when JOB_SCHEDULER binding is missing", async () => {
      const res = await app.request(
        "http://localhost/api/admin/scheduler",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        },
        mockEnv,
      );
      expect(res.status).toBe(503);
    });

    it("forwards scheduler status request with default body when empty", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      mockEnv.JOB_SCHEDULER = {
        idFromName: vi.fn(() => "global-id"),
        get: vi.fn(() => ({ fetch: fetchMock })),
      };

      const res = await app.request(
        "http://localhost/api/admin/scheduler",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "",
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const fetchArgs = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(fetchArgs[0]).toBe("https://job-scheduler/admin");
      expect(fetchArgs[1].body).toBe(JSON.stringify({ action: "status" }));
    });
  });

  describe("FAS sync endpoint guards", () => {
    it("returns 403 for /api/fas-sync with invalid secret", async () => {
      mockEnv.FAS_SYNC_SECRET = "top-secret";
      const res = await app.request(
        "http://localhost/api/fas-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "wrong" }),
        },
        mockEnv,
      );
      expect(res.status).toBe(403);
    });

    it("returns 503 for /api/fas-sync when FAS_HYPERDRIVE is not configured", async () => {
      mockEnv.FAS_SYNC_SECRET = "top-secret";
      const res = await app.request(
        "http://localhost/api/fas-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "top-secret" }),
        },
        mockEnv,
      );
      expect(res.status).toBe(503);
    });

    it("returns 500 for /api/fas-sync when paginated fetch fails", async () => {
      mockEnv.FAS_SYNC_SECRET = "top-secret";
      mockEnv.FAS_HYPERDRIVE = {};
      const res = await app.request(
        "http://localhost/api/fas-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "top-secret", limit: 10, offset: 0 }),
        },
        mockEnv,
      );
      expect(res.status).toBe(500);
    });

    it("uses default limit=100 and offset=0 when not provided", async () => {
      mockEnv.FAS_SYNC_SECRET = "top-secret";
      mockEnv.FAS_HYPERDRIVE = {};
      mockEnv.DB = {};
      mockEnv.HMAC_SECRET = "hmac";
      mockEnv.ENCRYPTION_KEY = "enc";

      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees: [
          {
            emplCd: "E1",
            name: "T",
            partCd: "P",
            companyName: "C",
            phone: "0",
            socialNo: "9001011",
            gojoCd: "G",
            jijoCd: "J",
            careCd: "C",
            roleCd: "R",
            stateFlag: "W",
            entrDay: "20200101",
            retrDay: "",
            rfid: "",
            violCnt: 0,
            updatedAt: new Date(),
            isActive: true,
          },
        ],
        total: 1,
      });
      vi.mocked(syncFasEmployeesToD1).mockResolvedValueOnce({
        created: 1,
        updated: 0,
        skipped: 0,
        errors: [],
      });

      const res = await app.request(
        "http://localhost/api/fas-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "top-secret" }),
        },
        mockEnv,
      );
      const json = (await res.json()) as {
        batch: { offset: number; limit: number };
        hasMore: boolean;
        nextOffset: number | null;
      };
      expect(res.status).toBe(200);
      expect(json.batch.limit).toBe(100);
      expect(json.batch.offset).toBe(0);
      expect(json.hasMore).toBe(false);
      expect(json.nextOffset).toBeNull();
    });

    it("deactivates retired employees and reports hasMore when batch full", async () => {
      mockEnv.FAS_SYNC_SECRET = "top-secret";
      mockEnv.FAS_HYPERDRIVE = {};
      mockEnv.DB = {};
      mockEnv.HMAC_SECRET = "hmac";
      mockEnv.ENCRYPTION_KEY = "enc";

      const employees = [
        {
          emplCd: "E1",
          name: "A",
          partCd: "P",
          companyName: "C",
          phone: "0",
          socialNo: "9001011",
          gojoCd: "G",
          jijoCd: "J",
          careCd: "C",
          roleCd: "R",
          stateFlag: "W",
          entrDay: "20200101",
          retrDay: "",
          rfid: "",
          violCnt: 0,
          updatedAt: new Date(),
          isActive: true,
        },
        {
          emplCd: "E2",
          name: "B",
          partCd: "P",
          companyName: "C",
          phone: "0",
          socialNo: "9001012",
          gojoCd: "G",
          jijoCd: "J",
          careCd: "C",
          roleCd: "R",
          stateFlag: "R",
          entrDay: "20200101",
          retrDay: "20240101",
          rfid: "",
          violCnt: 0,
          updatedAt: new Date(),
          isActive: false,
        },
        {
          emplCd: "E3",
          name: "C",
          partCd: "P",
          companyName: "C",
          phone: "0",
          socialNo: "9001013",
          gojoCd: "G",
          jijoCd: "J",
          careCd: "C",
          roleCd: "R",
          stateFlag: "W",
          entrDay: "20200101",
          retrDay: "",
          rfid: "",
          violCnt: 0,
          updatedAt: new Date(),
          isActive: true,
        },
      ];

      vi.mocked(fasGetAllEmployeesPaginated).mockResolvedValueOnce({
        employees,
        total: 10,
      });
      vi.mocked(syncFasEmployeesToD1).mockResolvedValueOnce({
        created: 2,
        updated: 0,
        skipped: 0,
        errors: [],
      });
      vi.mocked(deactivateRetiredEmployees).mockResolvedValueOnce(1);

      const res = await app.request(
        "http://localhost/api/fas-sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret: "top-secret", limit: 3, offset: 0 }),
        },
        mockEnv,
      );
      const json = (await res.json()) as {
        retired: number;
        deactivated: number;
        hasMore: boolean;
        nextOffset: number | null;
      };
      expect(res.status).toBe(200);
      expect(json.retired).toBe(1);
      expect(json.deactivated).toBe(1);
      expect(json.hasMore).toBe(true);
      expect(json.nextOffset).toBe(3);
    });
  });

  describe("R2 serving", () => {
    it("returns 404 when key is missing", async () => {
      mockEnv.R2 = { get: vi.fn() };
      const res = await app.request("http://localhost/r2/", {}, mockEnv);
      expect(res.status).toBe(404);
    });

    it("returns 304 when etag matches", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockResolvedValue({
          httpMetadata: { contentType: "image/png" },
          httpEtag: '"etag-1"',
          body: "png-body",
        }),
      };

      const res = await app.request(
        "http://localhost/r2/images/a.png",
        { headers: { "If-None-Match": '"etag-1"' } },
        mockEnv,
      );
      expect(res.status).toBe(304);
    });

    it("serves file when etag does not match", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockResolvedValue({
          httpMetadata: { contentType: "image/png" },
          httpEtag: '"etag-2"',
          body: "png-body",
        }),
      };

      const res = await app.request(
        "http://localhost/r2/images/a.png",
        { headers: { "If-None-Match": '"etag-1"' } },
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("returns 404 when R2 object is missing", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockResolvedValue(null),
      };

      const res = await app.request(
        "http://localhost/r2/images/missing.png",
        {},
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it("falls back to octet-stream mime for unknown extension", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockResolvedValue({
          httpMetadata: null,
          httpEtag: '"etag-unknown"',
          body: "blob",
        }),
      };

      const res = await app.request(
        "http://localhost/r2/files/data.unknownext",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    });
  });

  describe("Queue consumer", () => {
    it("handles empty notification queue batches", async () => {
      const queueWorker = worker as unknown as {
        queue: (batch: unknown, env: unknown) => Promise<void>;
      };
      await expect(
        queueWorker.queue(
          {
            messages: [],
            ackAll: vi.fn(),
            retryAll: vi.fn(),
          },
          {
            VAPID_PUBLIC_KEY: "k",
            VAPID_PRIVATE_KEY: "k",
            VAPID_SUBJECT: "mailto:test@example.com",
          },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("Error Handler", () => {
    it("should handle HTTP exceptions properly", async () => {
      const res = await app.request(
        "http://localhost/api/health",
        {
          method: "POST", // Method not allowed should trigger error handler
        },
        mockEnv,
      );
      const json = (await res.json()) as any;

      expect(res.status).toBe(404); // Hono returns 404 for method not found by default
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 for api method mismatch via catch-all handler", async () => {
      const res = await app.request(
        "http://localhost/api/health",
        { method: "POST" },
        mockEnv,
      );
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });

    it("returns internal error payload for non-http errors in development", async () => {
      mockEnv.ENVIRONMENT = "development";
      mockEnv.R2 = {
        get: vi.fn().mockRejectedValue(new Error("boom-onerror")),
      };
      const res = await app.request(
        "http://localhost/r2/images/a.png",
        {},
        mockEnv,
      );
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("boom-onerror");
    });

    it("creates GitHub issue for non-http errors when token exists", async () => {
      mockEnv.ENVIRONMENT = "production";
      mockEnv.GITLAB_TOKEN = "gh-token";
      mockEnv.R2 = {
        get: vi.fn().mockRejectedValue(new Error("boom-onerror")),
      };

      const executionCtx = {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.fetch(
        new Request("http://localhost/r2/images/a.png"),
        mockEnv,
        executionCtx,
      );
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("An error occurred");
      expect(createErrorIssue).toHaveBeenCalledTimes(1);
      expect(executionCtx.waitUntil).toHaveBeenCalledTimes(1);
    });

    it("maps thrown http-like 403 errors", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockRejectedValue(
          Object.assign(new Error("Forbidden by test"), {
            getResponse: () => new Response("forbidden", { status: 403 }),
            status: 403,
          }),
        ),
      };
      const res = await app.request(
        "http://localhost/r2/images/a.png",
        {},
        mockEnv,
      );
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };

      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
      expect(json.error.message).toBe("Forbidden by test");
    });

    it("maps thrown http-like 401 errors", async () => {
      mockEnv.R2 = {
        get: vi.fn().mockRejectedValue(
          Object.assign(new Error("Unauthorized by test"), {
            getResponse: () => new Response("unauthorized", { status: 401 }),
            status: 401,
          }),
        ),
      };
      const res = await app.request(
        "http://localhost/r2/images/a.png",
        {},
        mockEnv,
      );
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };

      expect(res.status).toBe(401);
      expect(json.error.code).toBe("UNAUTHORIZED");
      expect(json.error.message).toBe("Unauthorized by test");
    });
  });

  describe("System status endpoint", () => {
    it("defaults severity to info when maintenance message JSON omits it", async () => {
      mockEnv.KV.get = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          JSON.stringify({ message: "Scheduled downtime" }),
        );

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as {
        data: {
          notices: Array<{ type: string; severity: string; message: string }>;
        };
      };
      expect(res.status).toBe(200);
      expect(json.data.notices).toHaveLength(1);
      expect(json.data.notices[0].severity).toBe("info");
      expect(json.data.notices[0].message).toBe("Scheduled downtime");
    });

    it("uses raw string when maintenance message is not valid JSON", async () => {
      mockEnv.KV.get = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("plain text maintenance notice");

      const res = await app.request(
        "http://localhost/api/system/status",
        {},
        mockEnv,
      );
      const json = (await res.json()) as {
        data: {
          notices: Array<{ type: string; severity: string; message: string }>;
        };
      };
      expect(res.status).toBe(200);
      expect(json.data.notices).toHaveLength(1);
      expect(json.data.notices[0].severity).toBe("info");
      expect(json.data.notices[0].message).toBe(
        "plain text maintenance notice",
      );
    });
  });

  describe("Static SPA serving", () => {
    it("skips HTML nonce when response has no content-type header", async () => {
      mockEnv.ASSETS = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
      };
      const res = await app.request(
        "http://localhost/assets/script.js",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("handles non-Error value thrown during static asset fetch", async () => {
      mockEnv.ASSETS = {
        fetch: vi.fn().mockRejectedValue("string-error"),
      };
      const res = await app.request("http://localhost/some/page", {}, mockEnv);
      expect(res.status).toBe(500);
    });
  });
});
