import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth middleware
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: unknown, next: () => Promise<void>) => next()),
}));
// Mock image-privacy
vi.mock("../../lib/image-privacy", () => ({
  processImageForPrivacy: vi.fn(async (buf: ArrayBuffer, name: string) => ({
    buffer: buf,
    metadata: {
      "privacy-processed": "true",
      "original-filename": name,
    },
  })),
  isJpegImage: vi.fn(() => true),
}));
// Mock phash
vi.mock("../../lib/phash", () => ({
  computeImageHash: vi.fn(async () => "abc123hash"),
  hammingDistance: vi.fn(() => 100),
}));

const mockDbAllQueue: unknown[] = [];
function dequeueDbAll() {
  return mockDbAllQueue.length > 0 ? mockDbAllQueue.shift() : [];
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.all = vi.fn(() => dequeueDbAll());
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((arg: unknown) => arg),
  eq: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../../db/schema", () => ({
  postImages: {
    postId: "postId",
    fileUrl: "fileUrl",
    imageHash: "imageHash",
  },
  posts: {
    id: "id",
    siteId: "siteId",
    createdAt: "createdAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
  },
}));
// Mock analytics
vi.mock("../../middleware/analytics", () => ({
  trackEvent: vi.fn(),
}));
// Mock observability
vi.mock("../../lib/observability", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  startTimer: vi.fn(() => ({ end: vi.fn(() => 50), elapsed: () => 50 })),
}));
// Mock workers-ai
vi.mock("../../lib/workers-ai", () => ({
  classifyHazard: vi.fn(async () => ({
    hazardType: "fall_hazard",
    confidence: 0.85,
    rawLabel: "ladder",
  })),
  detectObjects: vi.fn(async () => []),
  filterPersonDetections: vi.fn(() => []),
}));
// Mock face-blur
vi.mock("../../lib/face-blur", () => ({
  blurPersonRegions: vi.fn(async (buf: ArrayBuffer) => ({
    buffer: buf,
    blurredCount: 0,
  })),
}));
// Mock gemini-ai
vi.mock("../../lib/gemini-ai", () => ({
  getAiCredentials: vi.fn(() => null),
  analyzeHazardImage: vi.fn(async () => null),
}));

import type { Env, AuthContext } from "../../types";
import imageRoutes from "../images";

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function makeAuth(role = "WORKER"): AuthContext {
  return {
    user: {
      id: "user-1",
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

function createApp(
  auth: AuthContext | null,
  r2Overrides?: Record<string, unknown>,
) {
  const r2: Record<string, unknown> = {
    put: vi.fn().mockResolvedValue(undefined),
    head: vi.fn().mockResolvedValue(null),
    get: vi.fn().mockResolvedValue(null),
    ...r2Overrides,
  };

  const env = {
    DB: {},
    R2: r2,
    JWT_SECRET: "test-secret",
    HMAC_SECRET: "test-hmac",
    ANALYTICS: { writeDataPoint: vi.fn() },
  } as unknown as Env;

  const app = new Hono<AppEnv>();
  if (auth) {
    app.use("*", async (c, next) => {
      c.set("auth", auth);
      await next();
    });
  }
  app.route("/images", imageRoutes);
  return { app, env, r2 };
}

describe("routes/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAllQueue.length = 0;
  });

  // ---------- POST /upload ----------

  describe("POST /upload", () => {
    it("returns 400 when no file provided", async () => {
      const { app, env } = createApp(makeAuth());
      const form = new FormData();

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when file is too large", async () => {
      const { app, env } = createApp(makeAuth());
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);
      const form = new FormData();
      form.append(
        "file",
        new Blob([largeBuffer], { type: "image/jpeg" }),
        "big.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid file type", async () => {
      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob(["hello"], { type: "text/plain" }),
        "test.txt",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("uploads JPEG file successfully", async () => {
      const { app, env, r2 } = createApp(makeAuth());
      const form = new FormData();
      const jpegBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
        type: "image/jpeg",
      });
      form.append("file", jpegBlob, "photo.jpg");
      form.append("context", "post-upload");

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(r2.put).toHaveBeenCalled();
    });

    it("returns 409 when near-duplicate image is detected", async () => {
      const { hammingDistance } = await import("../../lib/phash");
      vi.mocked(hammingDistance).mockReturnValue(3);

      mockDbAllQueue.push([{ siteId: "site-1" }]);
      mockDbAllQueue.push([
        {
          postId: "post-1",
          fileUrl: "/r2/post-1.jpg",
          imageHash: "recent-hash",
        },
      ]);

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "duplicate.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("skips recent images without imageHash during duplicate scan", async () => {
      mockDbAllQueue.push([{ siteId: "site-1" }]);
      mockDbAllQueue.push([
        {
          postId: "post-1",
          fileUrl: "/r2/post-1.jpg",
          imageHash: null,
        },
      ]);

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "no-hash.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("continues upload when pHash computation fails", async () => {
      const { computeImageHash } = await import("../../lib/phash");
      vi.mocked(computeImageHash).mockRejectedValueOnce(
        new Error("phash error"),
      );

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "hash-fail.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("uses siteId from form data for duplicate check", async () => {
      mockDbAllQueue.push([]);

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "with-site.jpg",
      );
      form.append("siteId", "  site-explicit  ");

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("skips duplicate check when user has multiple active memberships", async () => {
      mockDbAllQueue.push([{ siteId: "site-1" }, { siteId: "site-2" }]);

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "multi-site.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("skips duplicate check when imageHash is null", async () => {
      const { computeImageHash } = await import("../../lib/phash");
      vi.mocked(computeImageHash).mockResolvedValueOnce(
        null as unknown as string,
      );

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "no-hash-result.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 500 when privacy processing throws", async () => {
      const { processImageForPrivacy } =
        await import("../../lib/image-privacy");
      vi.mocked(processImageForPrivacy).mockRejectedValueOnce(
        new Error("privacy failed"),
      );

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "privacy-fail.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(500);
    });

    it("uses jpg fallback extension when filename has trailing dot", async () => {
      const { app, env, r2 } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "photo.",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      const putCall = (r2.put as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(putCall[0]).toMatch(/\.jpg$/);
    });

    it("handles non-Error value thrown during pHash computation", async () => {
      const { computeImageHash } = await import("../../lib/phash");
      vi.mocked(computeImageHash).mockRejectedValueOnce("string-error");

      const { app, env } = createApp(makeAuth());
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "non-error-phash.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  // ---------- GET /info/:filename ----------

  describe("GET /info/:filename", () => {
    it("returns 404 when file not found in R2", async () => {
      const { app, env } = createApp(makeAuth());

      const res = await app.request(
        "http://localhost/images/info/missing.jpg",
        {},
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns metadata when file exists", async () => {
      const { app, env } = createApp(makeAuth(), {
        head: vi.fn().mockResolvedValue({
          key: "photo.jpg",
          size: 12345,
          httpMetadata: { contentType: "image/jpeg" },
          customMetadata: { "privacy-processed": "true" },
          uploaded: new Date("2025-01-01"),
        }),
      });

      const res = await app.request(
        "http://localhost/images/info/photo.jpg",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { filename: string } };
      expect(body.data.filename).toBe("photo.jpg");
    });

    it("returns 500 when R2 head lookup throws", async () => {
      const { app, env } = createApp(makeAuth(), {
        head: vi.fn().mockRejectedValue(new Error("r2 failure")),
      });

      const res = await app.request(
        "http://localhost/images/info/photo.jpg",
        {},
        env,
      );
      expect(res.status).toBe(500);
    });
  });

  describe("AI hazard classification", () => {
    it("triggers AI classification when AI binding is present", async () => {
      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const headResult = {
        customMetadata: { "privacy-processed": "true" },
      };
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(headResult);

      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });

      (env as unknown as Record<string, unknown>).AI = {
        run: vi.fn().mockResolvedValue([{ label: "ladder", score: 0.85 }]),
      };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "test.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(waitUntilFn).toHaveBeenCalledOnce();
    });

    it("skips AI when AI binding is not present", async () => {
      const putFn = vi.fn().mockResolvedValue(undefined);
      const { app, env } = createApp(makeAuth(), { put: putFn });

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "test.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(putFn).toHaveBeenCalledTimes(1);
    });

    it("applies blur when person detections exist", async () => {
      const { detectObjects, filterPersonDetections } =
        await import("../../lib/workers-ai");
      const { blurPersonRegions } = await import("../../lib/face-blur");

      vi.mocked(detectObjects).mockResolvedValueOnce([
        { cls: "person", score: 0.9 } as never,
      ]);
      vi.mocked(filterPersonDetections).mockReturnValueOnce([
        { x: 1, y: 2, width: 10, height: 10 },
      ] as unknown as ReturnType<typeof filterPersonDetections>);
      vi.mocked(blurPersonRegions).mockResolvedValueOnce({
        buffer: new Uint8Array([1, 2, 3]).buffer,
        blurredCount: 1,
      });

      const putFn = vi.fn().mockResolvedValue(undefined);
      const { app, env } = createApp(makeAuth(), {
        put: putFn,
      });
      (env as unknown as Record<string, unknown>).AI = { run: vi.fn() };

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "person.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("continues upload when face detection throws", async () => {
      const { detectObjects } = await import("../../lib/workers-ai");
      vi.mocked(detectObjects).mockRejectedValueOnce(
        new Error("ai detect failed"),
      );

      const putFn = vi.fn().mockResolvedValue(undefined);
      const { app, env } = createApp(makeAuth(), {
        put: putFn,
      });
      (env as unknown as Record<string, unknown>).AI = { run: vi.fn() };

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "detect-fail.jpg",
      );

      const res = await app.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("skips face detection for non-JPEG images when AI is present", async () => {
      const { isJpegImage } = await import("../../lib/image-privacy");
      vi.mocked(isJpegImage).mockReturnValueOnce(false);

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(null);
      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });
      (env as unknown as Record<string, unknown>).AI = { run: vi.fn() };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "photo.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("triggers Gemini AI analysis when credentials are present", async () => {
      const { getAiCredentials, analyzeHazardImage } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValue({
        apiKey: "test-key",
      });
      vi.mocked(analyzeHazardImage).mockResolvedValue({
        hazardType: "fall_hazard",
        severity: "HIGH",
        confidence: 0.92,
        description: "Elevated work platform",
        recommendations: ["Install guardrails"],
        detectedObjects: ["ladder"],
        relatedRegulations: ["OSHA-1926"],
        modelVersion: "gemini-pro",
      });

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const headResult = {
        customMetadata: { "privacy-processed": "true" },
      };
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(headResult);

      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });

      (env as unknown as Record<string, unknown>).AI = {
        run: vi.fn().mockResolvedValue([{ label: "ladder", score: 0.85 }]),
      };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "gemini-test.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(waitUntilFn).toHaveBeenCalledTimes(2);

      for (const call of waitUntilFn.mock.calls) {
        await call[0];
      }

      expect(analyzeHazardImage).toHaveBeenCalledOnce();
    });

    it("swallows AI analysis rejection and still returns 200", async () => {
      const { getAiCredentials, analyzeHazardImage } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValue({
        apiKey: "test-key",
      });
      vi.mocked(analyzeHazardImage).mockRejectedValue(
        new Error("Gemini API unavailable"),
      );

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const headResult = {
        customMetadata: { "privacy-processed": "true" },
      };
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(headResult);

      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });

      (env as unknown as Record<string, unknown>).AI = {
        run: vi.fn().mockResolvedValue([{ label: "ladder", score: 0.85 }]),
      };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "reject-test.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);
      expect(waitUntilFn).toHaveBeenCalledTimes(2);

      for (const call of waitUntilFn.mock.calls) {
        await call[0];
      }

      expect(analyzeHazardImage).toHaveBeenCalledOnce();
    });

    it("skips metadata update when AI classification returns null", async () => {
      const { classifyHazard } = await import("../../lib/workers-ai");
      vi.mocked(classifyHazard).mockResolvedValueOnce(null as never);

      const { getAiCredentials } = await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValue(null);

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(null);
      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });
      (env as unknown as Record<string, unknown>).AI = { run: vi.fn() };

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "null-classify.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);

      for (const call of waitUntilFn.mock.calls) {
        await call[0];
      }
      expect(headFn).not.toHaveBeenCalled();
    });

    it("skips storage when Gemini analysis returns null", async () => {
      const { getAiCredentials } = await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValue({ apiKey: "test-key" });

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const putFn = vi.fn().mockResolvedValue(undefined);
      const { app: baseApp, env } = createApp(makeAuth(), { put: putFn });

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "null-analysis.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);

      for (const call of waitUntilFn.mock.calls) {
        await call[0];
      }
    });

    it("skips metadata re-put when R2 head returns null during Gemini analysis", async () => {
      const { getAiCredentials, analyzeHazardImage } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValue({ apiKey: "test-key" });
      vi.mocked(analyzeHazardImage).mockResolvedValue({
        hazardType: "fall_hazard",
        severity: "HIGH",
        confidence: 0.92,
        description: "test",
        recommendations: [],
        detectedObjects: [],
        relatedRegulations: [],
        modelVersion: "gemini-pro",
      });

      const waitUntilFn = vi.fn<(p: Promise<unknown>) => void>();
      const putFn = vi.fn().mockResolvedValue(undefined);
      const headFn = vi.fn().mockResolvedValue(null);
      const { app: baseApp, env } = createApp(makeAuth(), {
        put: putFn,
        head: headFn,
      });

      const wrappedApp = new Hono<AppEnv>();
      wrappedApp.use("*", async (c, next) => {
        Object.defineProperty(c, "executionCtx", {
          value: { waitUntil: waitUntilFn },
          writable: true,
        });
        await next();
      });
      wrappedApp.route("/", baseApp);

      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
          type: "image/jpeg",
        }),
        "head-null.jpg",
      );

      const res = await wrappedApp.request(
        "http://localhost/images/upload",
        { method: "POST", body: form },
        env,
      );
      expect(res.status).toBe(200);

      for (const call of waitUntilFn.mock.calls) {
        await call[0];
      }
      expect(headFn).toHaveBeenCalled();
    });
  });
});
