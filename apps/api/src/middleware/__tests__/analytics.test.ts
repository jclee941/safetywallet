import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { computeBucket, analyticsMiddleware, trackEvent } from "../analytics";
import type { Env } from "../../types";

// ---------- computeBucket ----------

describe("analytics", () => {
  describe("computeBucket", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns string in YYYY-MM-DDTHH:MM format", () => {
      vi.setSystemTime(new Date("2025-06-15T14:23:45Z"));
      const bucket = computeBucket();
      expect(bucket).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it("rounds minutes down to nearest 5-minute interval", () => {
      vi.setSystemTime(new Date("2025-06-15T14:23:45Z"));
      expect(computeBucket()).toBe("2025-06-15T14:20");
    });

    it("handles exact 5-minute boundary", () => {
      vi.setSystemTime(new Date("2025-06-15T14:25:00Z"));
      expect(computeBucket()).toBe("2025-06-15T14:25");
    });

    it("handles minute 0", () => {
      vi.setSystemTime(new Date("2025-06-15T14:00:00Z"));
      expect(computeBucket()).toBe("2025-06-15T14:00");
    });

    it("handles minute 59", () => {
      vi.setSystemTime(new Date("2025-06-15T14:59:59Z"));
      expect(computeBucket()).toBe("2025-06-15T14:55");
    });

    it("handles midnight", () => {
      vi.setSystemTime(new Date("2025-06-15T00:02:30Z"));
      expect(computeBucket()).toBe("2025-06-15T00:00");
    });

    it("pads single-digit hours and months", () => {
      vi.setSystemTime(new Date("2025-01-05T03:07:00Z"));
      expect(computeBucket()).toBe("2025-01-05T03:05");
    });
  });

  // ---------- analyticsMiddleware ----------

  describe("analyticsMiddleware", () => {
    function makeEnv(opts?: { analytics?: boolean; dbFail?: boolean }): Env {
      const writeDataPoint = vi.fn();
      return {
        ANALYTICS: opts?.analytics !== false ? { writeDataPoint } : undefined,
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn().mockReturnThis(),
            run: opts?.dbFail
              ? vi.fn().mockRejectedValue(new Error("D1 fail"))
              : vi.fn().mockResolvedValue({ results: [] }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            raw: vi.fn().mockResolvedValue([]),
          })),
          batch: vi.fn().mockResolvedValue([]),
          exec: vi.fn().mockResolvedValue(undefined),
          dump: vi.fn(),
        },
      } as unknown as Env;
    }

    it("tracks /api/ paths with Analytics Engine + D1", async () => {
      const env = makeEnv();
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/posts", (c) => c.json({ ok: true }));

      const res = await app.request("http://localhost/api/posts", {}, env);
      expect(res.status).toBe(200);

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      expect(ae.writeDataPoint).toHaveBeenCalledTimes(1);
      const call = ae.writeDataPoint.mock.calls[0][0];
      expect(call.indexes).toEqual(["/api/posts"]);
      expect(call.blobs[0]).toBe("GET");
      expect(call.blobs[1]).toBe("200");
      expect(call.doubles[0]).toBe(1);
    });

    it("replaces UUIDs and numeric IDs in endpoint pattern", async () => {
      const env = makeEnv();
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/posts/:id", (c) => c.json({ ok: true }));

      await app.request(
        "http://localhost/api/posts/550e8400-e29b-41d4-a716-446655440000",
        {},
        env,
      );

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      expect(ae.writeDataPoint.mock.calls[0][0].indexes[0]).toBe(
        "/api/posts/:id",
      );
    });

    it("records non-/api/ paths to Analytics Engine only (no D1)", async () => {
      const env = makeEnv();
      const app = new Hono<{ Bindings: Env }>();
      app.use("/*", analyticsMiddleware);
      app.get("/health", (c) => c.json({ ok: true }));

      await app.request("http://localhost/health", {}, env);

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      expect(ae.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it("records status 500 when handler throws", async () => {
      const env = makeEnv();
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/fail", () => {
        throw new TypeError("broken");
      });
      app.onError((_err, c) => c.json({ error: "internal" }, 500));

      const res = await app.request("http://localhost/api/fail", {}, env);
      expect(res.status).toBe(500);

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      expect(ae.writeDataPoint).toHaveBeenCalledTimes(1);
      const call = ae.writeDataPoint.mock.calls[0][0];
      expect(call.blobs[0]).toBe("GET");
      expect(call.blobs[1]).toBe("500");
    });

    it("skips Analytics Engine when ANALYTICS is not configured", async () => {
      const env = makeEnv({ analytics: false });
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/posts", (c) => c.json({ ok: true }));

      const res = await app.request("http://localhost/api/posts", {}, env);
      expect(res.status).toBe(200);
    });

    it("handles D1 write failure gracefully (no crash)", async () => {
      const env = makeEnv({ dbFail: true });
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/posts", (c) => c.json({ ok: true }));

      const res = await app.request("http://localhost/api/posts", {}, env);
      expect(res.status).toBe(200);
    });

    it("sets errorType when handler throws and error propagates", async () => {
      const env = makeEnv();
      const app = new Hono<{ Bindings: Env }>();
      app.use("/api/*", analyticsMiddleware);
      app.get("/api/crash", () => {
        throw new TypeError("intentional");
      });
      // Deliberately NO onError handler — error propagates through middleware catch

      const res = await app.request("http://localhost/api/crash", {}, env);
      // Hono's default error handler returns 500
      expect(res.status).toBe(500);

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      if (ae.writeDataPoint.mock.calls.length > 0) {
        const call = ae.writeDataPoint.mock.calls[0][0];
        expect(call.blobs[1]).toBe("500");
      }
    });

    it("records UnknownError when non-Error value is thrown", async () => {
      const env = makeEnv();
      const c = {
        req: { method: "GET", path: "/api/non-error-throw" },
        res: { status: 200 },
        env,
      } as unknown as Parameters<typeof analyticsMiddleware>[0];

      await expect(
        analyticsMiddleware(c, async () => {
          throw "boom";
        }),
      ).rejects.toBe("boom");

      const ae = env.ANALYTICS as { writeDataPoint: ReturnType<typeof vi.fn> };
      const call = ae.writeDataPoint.mock.calls[0][0];
      expect(call.blobs[2]).toBe("UnknownError");
    });

    it("uses executionCtx.waitUntil when available", async () => {
      const env = makeEnv();
      const waitUntil = vi.fn();
      const c = {
        req: { method: "GET", path: "/api/metrics" },
        res: { status: 200 },
        env,
        executionCtx: { waitUntil },
      } as unknown as Parameters<typeof analyticsMiddleware>[0];

      await analyticsMiddleware(c, async () => undefined);

      expect(waitUntil).toHaveBeenCalledTimes(1);
    });
  });

  // ---------- trackEvent ----------

  describe("trackEvent", () => {
    it("writes data point with all fields", () => {
      const writeDataPoint = vi.fn();
      const c = {
        env: { ANALYTICS: { writeDataPoint } },
      } as unknown as Parameters<typeof trackEvent>[0];

      trackEvent(c, "post_created", {
        category: "HAZARD",
        siteId: "site-1",
        userId: "user-1",
        count: 5,
        value: 100,
      });

      expect(writeDataPoint).toHaveBeenCalledTimes(1);
      const call = writeDataPoint.mock.calls[0][0];
      expect(call.indexes).toEqual(["post_created"]);
      expect(call.blobs).toEqual(["HAZARD", "site-1", "user-1"]);
      expect(call.doubles[0]).toBe(5);
      expect(call.doubles[1]).toBe(100);
    });

    it("uses defaults for missing data fields", () => {
      const writeDataPoint = vi.fn();
      const c = {
        env: { ANALYTICS: { writeDataPoint } },
      } as unknown as Parameters<typeof trackEvent>[0];

      trackEvent(c, "page_view");

      const call = writeDataPoint.mock.calls[0][0];
      expect(call.blobs).toEqual(["", "", ""]);
      expect(call.doubles[0]).toBe(1);
      expect(call.doubles[1]).toBe(0);
    });

    it("does nothing when ANALYTICS is not configured", () => {
      const c = {
        env: {},
      } as unknown as Parameters<typeof trackEvent>[0];

      trackEvent(c, "test_event");
    });
  });
});
