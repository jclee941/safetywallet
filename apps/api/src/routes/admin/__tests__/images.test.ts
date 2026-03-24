import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../../lib/observability", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockAll = vi.fn();
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => mockAll()),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

interface AuthContext {
  user: {
    id: string;
    phone: string;
    role: string;
    name: string;
    nameMasked: string;
  };
  loginDate: string;
}

function makeAuth(role = "SUPER_ADMIN"): AuthContext {
  return {
    user: {
      id: "admin-1",
      name: "Admin",
      nameMasked: "Ad**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

function makeR2Object(body: Uint8Array, contentType = "image/jpeg") {
  return {
    httpMetadata: { contentType },
    arrayBuffer: vi.fn(async () => body.buffer),
  };
}

async function createApp(auth?: AuthContext) {
  const { default: imagesRoute } = await import("../images");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", imagesRoute);
  return app;
}

describe("admin/images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReset();
  });

  describe("GET /download/:key", () => {
    it("returns 400 when key is empty", async () => {
      const { default: imagesRoute } = await import("../images");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", imagesRoute);
      const mockR2 = { get: vi.fn() };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const res = await app.request("/download/photo-1.jpg", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns watermarked image download", async () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const mockR2 = { get: vi.fn(async () => makeR2Object(jpegBytes)) };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth());
      const res = await app.request("/download/photo-1.jpg", {}, env);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Watermark-Id")).toBeTruthy();
      expect(res.headers.get("X-Downloaded-By")).toBe("admin-1");
      expect(res.headers.get("Content-Disposition")).toContain("watermarked-");
    });

    it("returns 404 when image not found in R2", async () => {
      const mockR2 = { get: vi.fn(async () => null) };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth());
      const res = await app.request("/download/missing.jpg", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-admin", async () => {
      const mockR2 = { get: vi.fn() };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request("/download/photo-1.jpg", {}, env);
      expect(res.status).toBe(403);
    });

    it("handles non-JPEG images", async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const mockR2 = {
        get: vi.fn(async () => makeR2Object(pngBytes, "image/png")),
      };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth());
      const res = await app.request("/download/photo-1.png", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /list", () => {
    it("returns image list from R2", async () => {
      const mockR2 = {
        list: vi.fn(async () => ({
          objects: [
            {
              key: "img-1.jpg",
              size: 1024,
              uploaded: new Date("2025-01-01"),
              httpMetadata: { contentType: "image/jpeg" },
            },
          ],
          truncated: false,
          cursor: undefined,
        })),
      };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth());
      const res = await app.request("/list", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { images: { key: string }[]; truncated: boolean };
      };
      expect(body.data.images).toHaveLength(1);
      expect(body.data.truncated).toBe(false);
    });

    it("returns 403 for non-admin", async () => {
      const env = { DB: {}, R2: {} } as Record<string, unknown>;
      const app = await createApp(makeAuth("WORKER"));
      const res = await app.request("/list", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /ai-analysis/:key", () => {
    it("returns 400 when key is empty", async () => {
      const { default: imagesRoute } = await import("../images");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth("SITE_ADMIN"));
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", imagesRoute);
      const mockR2 = { get: vi.fn() };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const res = await app.request("/ai-analysis/file-1.jpg", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns analysis JSON", async () => {
      const mockR2 = {
        get: vi.fn(async () => ({
          json: vi.fn(async () => ({ risk: "HIGH" })),
        })),
      };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/ai-analysis/file-1.jpg", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { analysis: { risk: string } };
      };
      expect(body.data.analysis.risk).toBe("HIGH");
    });

    it("returns 404 when analysis JSON is missing", async () => {
      const mockR2 = { get: vi.fn(async () => null) };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/ai-analysis/file-1.jpg", {}, env);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /ai-analysis-by-post/:postId", () => {
    it("returns 400 when postId is empty", async () => {
      const { default: imagesRoute } = await import("../images");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth("SITE_ADMIN"));
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", imagesRoute);
      const env = {
        DB: {},
        R2: { get: vi.fn() },
      } as Record<string, unknown>;
      const res = await app.request("/ai-analysis-by-post/post-1", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns empty analyses when post has no images", async () => {
      mockAll.mockResolvedValueOnce([]);
      const env = {
        DB: {},
        R2: { get: vi.fn() },
      } as Record<string, unknown>;
      const app = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/ai-analysis-by-post/post-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { analyses: unknown[] } };
      expect(body.data.analyses).toHaveLength(0);
    });

    it("returns only images that have analysis JSON", async () => {
      mockAll.mockResolvedValueOnce([
        { fileUrl: "posts/p1/file1.jpg" },
        { fileUrl: "posts/p1/file2.jpg" },
      ]);
      const mockR2 = {
        get: vi
          .fn()
          .mockResolvedValueOnce({ json: vi.fn(async () => ({ score: 90 })) })
          .mockResolvedValueOnce(null),
      };
      const env = { DB: {}, R2: mockR2 } as Record<string, unknown>;
      const app = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/ai-analysis-by-post/post-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          analyses: Array<{ filename: string; analysis: { score: number } }>;
        };
      };
      expect(body.data.analyses).toHaveLength(1);
      expect(body.data.analyses[0]?.filename).toBe("file1.jpg");
      expect(body.data.analyses[0]?.analysis.score).toBe(90);
    });
  });
});
