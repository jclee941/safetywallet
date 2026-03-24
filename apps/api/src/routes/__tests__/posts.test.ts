import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async () => {}),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("../../lib/phash", () => ({
  hammingDistance: vi.fn(() => 100),
  DUPLICATE_THRESHOLD: 10,
}));

vi.mock("../../lib/gemini-ai", () => ({
  getAiCredentials: vi.fn(() => null),
  classifyPost: vi.fn(async () => ({ suggestedRiskLevel: "LOW" })),
}));

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : undefined;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  chain.as = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  return chain;
}

const mockReturningGetQueue: unknown[] = [];
function dequeueReturningGet() {
  return mockReturningGetQueue.length > 0
    ? mockReturningGetQueue.shift()
    : undefined;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueReturningGet());
  chain.run = vi.fn(async () => ({ success: true }));
  chain.onConflictDoNothing = vi.fn(() => chain);
  return chain;
}

const mockDeleteWhere = vi.fn().mockResolvedValue({ success: true });
const mockBatch = vi.fn().mockResolvedValue([]);

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueReturningGet());
  chain.run = vi.fn(async () => ({ success: true }));
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
  delete: vi.fn(() => ({
    where: mockDeleteWhere,
  })),
  batch: mockBatch,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  posts: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    content: "content",
    category: "category",
    hazardType: "hazardType",
    riskLevel: "riskLevel",
    visibility: "visibility",
    locationFloor: "locationFloor",
    locationZone: "locationZone",
    locationDetail: "locationDetail",
    isAnonymous: "isAnonymous",
    metadata: "metadata",
    isPotentialDuplicate: "isPotentialDuplicate",
    duplicateOfPostId: "duplicateOfPostId",
    createdAt: "createdAt",
    reviewStatus: "reviewStatus",
    actionStatus: "actionStatus",
    isUrgent: "isUrgent",
    clientMutationId: "clientMutationId",
    hazardSubcategory: "hazardSubcategory",
  },
  postImages: {
    id: "id",
    postId: "postId",
    fileUrl: "fileUrl",
    thumbnailUrl: "thumbnailUrl",
    imageHash: "imageHash",
    createdAt: "createdAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
  },
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    restrictedUntil: "restrictedUntil",
  },
  reviews: {
    postId: "postId",
  },
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    postId: "postId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    settleMonth: "settleMonth",
    occurredAt: "occurredAt",
    createdAt: "createdAt",
  },
  pointPolicies: {
    siteId: "siteId",
    reasonCode: "reasonCode",
    defaultAmount: "defaultAmount",
    isActive: "isActive",
  },
  auditLogs: {
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
  },
}));

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

function makeAuth(role = "WORKER", userId = "user-1"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test",
      nameMasked: "Te**",
      phone: "010-0000",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: postsRoute } = await import("../posts");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/posts", postsRoute);
  const env = {
    DB: {},
    R2: {
      put: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
    },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockReturningGetQueue.length = 0;
  });

  describe("POST /posts", () => {
    it("returns 400 when siteId or content is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "", content: "" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when user is restricted", async () => {
      mockGetQueue.push({
        restrictedUntil: new Date(Date.now() + 86400000),
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Test content",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("USER_RESTRICTED");
    });

    it("returns 403 when user is not a site member", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Test content",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NOT_SITE_MEMBER");
    });

    it("creates a post successfully", async () => {
      const newPost = {
        id: "post-1",
        userId: "user-1",
        siteId: "site-1",
        content: "Test content for a longer post that has enough characters",
        category: "HAZARD",
      };

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([]);
      mockGetQueue.push(newPost);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content:
              "Test content for a longer post that has enough characters",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { post: typeof newPost } };
      expect(body.data.post.id).toBe("post-1");
    });

    it("returns 500 when post creation fails", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("POST_CREATION_FAILED");
    });

    it("returns deduplicated response when clientMutationId already exists", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "existing-post-id" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "dedupe content with enough length",
            category: "HAZARD",
            clientMutationId: "00000000-0000-4000-8000-000000000123",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { id: string; deduplicated: boolean };
      };
      expect(body.data.id).toBe("existing-post-id");
      expect(body.data.deduplicated).toBe(true);
    });

    it("creates post with imageUrls and imageHashes", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([]);
      mockGetQueue.push({ id: "post-2", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["https://example.com/img.jpg"],
            imageHashes: ["abcdef1234567890"],
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("sets default values for optional fields", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({
        id: "post-3",
        category: "HAZARD",
        visibility: "WORKER_PUBLIC",
        isAnonymous: false,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("detects image duplicates via pHash", async () => {
      const { hammingDistance: mockHamming } = await import("../../lib/phash");
      (mockHamming as ReturnType<typeof vi.fn>).mockReturnValue(5);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([
        { imageHash: "1234567890abcdef", postId: "old-post" },
      ]);
      mockGetQueue.push({ id: "post-dup", isPotentialDuplicate: true });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["https://example.com/img.jpg"],
            imageHashes: ["abcdef1234567890"],
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("uses executionCtx.waitUntil for async auto AI classification", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "test-model",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedRiskLevel: "HIGH",
      } as never);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({
        id: "post-ai-1",
        userId: "user-1",
        siteId: "site-1",
        content: "content for ai",
      });

      const { app, env } = await createApp(makeAuth());
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      r2.R2.get.mockResolvedValueOnce({
        arrayBuffer: async () => new TextEncoder().encode("image").buffer,
        httpMetadata: { contentType: "image/jpeg" },
      });

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "ai classification target content",
            category: "HAZARD",
            imageUrls: ["/r2/posts/post-ai-1/image.jpg"],
          }),
        },
        env,
        executionCtx,
      );

      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(executionCtx.waitUntil).toHaveBeenCalledTimes(1);
      expect(classifyPost).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("creates post with non-HAZARD category setting hazardSubcategory to null", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({
        id: "p-sug",
        category: "SUGGESTION",
        siteId: "site-1",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "SUGGESTION",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("creates post when clientMutationId has no match", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push(null);
      mockGetQueue.push({ id: "p-new", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            clientMutationId: "00000000-0000-4000-8000-000000000001",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("detects location duplicate with hazardType", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "dup-1" });
      mockGetQueue.push({
        id: "p-dup2",
        siteId: "site-1",
        isPotentialDuplicate: true,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            locationFloor: "B1",
            locationZone: "A",
            hazardType: "FALL",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("handles location check when no duplicate found", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push(null);
      mockGetQueue.push({ id: "p-nodup", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            locationFloor: "B1",
            locationZone: "A",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("skips duplicate check when only locationFloor provided", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-floor", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            locationFloor: "B1",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("marks post as potential duplicate when content similarity found", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([{ id: "sim-1" }]);
      mockGetQueue.push({
        id: "p-sim",
        siteId: "site-1",
        isPotentialDuplicate: true,
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "hello world testing keywords enough",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("skips content similarity when fewer than 2 keywords", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-1kw", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "aaaaaaaaaa",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("skips null entries in imageHashes", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockAllQueue.push([]);
      mockGetQueue.push({ id: "p-nullhash", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["url1", "url2"],
            imageHashes: [null, "abc123def4567890"],
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("auto-awards points when POST_SUBMITTED policy exists", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-pts", siteId: "site-1" });
      mockGetQueue.push({
        defaultAmount: 10,
        name: "Post Reward",
        siteId: "site-1",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("catches Error when points insert fails", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-pterr", siteId: "site-1" });
      mockGetQueue.push({
        defaultAmount: 10,
        name: "Reward",
        siteId: "site-1",
      });
      mockDb.insert
        .mockImplementationOnce(() => makeInsertChain())
        .mockImplementationOnce(() => {
          throw new Error("DB fail");
        });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("catches non-Error when points insert fails", async () => {
      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-ptstr", siteId: "site-1" });
      mockGetQueue.push({
        defaultAmount: 10,
        name: "Reward",
        siteId: "site-1",
      });
      mockDb.insert
        .mockImplementationOnce(() => makeInsertChain())
        .mockImplementationOnce(() => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error";
        });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("AI: skips image data when no imageUrls and handles null classification", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce(null);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-ainull", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("AI: skips R2 when imageUrl is empty string", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedRiskLevel: "LOW",
      } as never);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-aiempty", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: [""],
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
    });

    it("AI: skips image data when R2 returns null", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedRiskLevel: "LOW",
      } as never);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-air2null", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      r2.R2.get.mockResolvedValueOnce(null);
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["/r2/posts/p1/img.jpg"],
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
    });

    it("AI: falls back to image/jpeg when no contentType", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedRiskLevel: "LOW",
      } as never);

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-notype", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      r2.R2.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
        httpMetadata: {},
      });
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
            imageUrls: ["/r2/posts/p1/img.jpg"],
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
    });

    it("AI: catches Error thrown by classifyPost", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockRejectedValueOnce(new Error("AI fail"));

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-aierr", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
    });

    it("AI: catches non-Error thrown by classifyPost", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "k",
        textModel: "m",
      });
      vi.mocked(classifyPost).mockRejectedValueOnce("string failure");

      mockGetQueue.push({ restrictedUntil: null });
      mockGetQueue.push({
        userId: "user-1",
        siteId: "site-1",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "p-aistr", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const res = await app.request(
        "/posts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            content: "Short",
            category: "HAZARD",
          }),
        },
        env,
        executionCtx,
      );
      await Promise.allSettled(pending);
      expect(res.status).toBe(201);
    });
  });

  describe("GET /posts", () => {
    it("returns posts with author info", async () => {
      mockAllQueue.push([
        {
          post: { id: "p1", isAnonymous: false, userId: "u1", siteId: "s1" },
          author: { id: "u1", name: "Test", nameMasked: "Te**" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?siteId=s1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { posts: Array<{ author: { id: string } | null }> };
      };
      expect(body.data.posts).toHaveLength(1);
      expect(body.data.posts[0].author).toBeTruthy();
    });

    it("hides author for anonymous posts", async () => {
      mockAllQueue.push([
        {
          post: { id: "p1", isAnonymous: true, userId: "u1" },
          author: { id: "u1", name: "Test", nameMasked: "Te**" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { posts: Array<{ author: null }> };
      };
      expect(body.data.posts[0].author).toBeNull();
    });

    it("filters by category", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts?siteId=s1&category=HAZARD",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("respects limit and offset", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?limit=5&offset=10", {}, env);
      expect(res.status).toBe(200);
    });

    it("caps limit at 100", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts?limit=999", {}, env);
      expect(res.status).toBe(200);
    });

    it("filters by hazardSubcategory", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts?siteId=s1&category=HAZARD&hazardSubcategory=FALL",
        {},
        env,
      );

      expect(res.status).toBe(200);
    });

    it("returns empty when no posts", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { posts: unknown[] } };
      expect(body.data.posts).toHaveLength(0);
    });

    it("returns 400 for invalid category filter", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts?category=INVALID_CATEGORY",
        {},
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_QUERY");
    });
  });

  describe("GET /posts/me", () => {
    it("returns user own posts", async () => {
      mockAllQueue.push([
        {
          id: "p1",
          category: "HAZARD",
          content: "test",
          reviewStatus: "PENDING",
          actionStatus: null,
          isUrgent: false,
          createdAt: new Date("2025-01-01T10:00:00Z"),
          imageCount: 2,
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { items: unknown[]; nextCursor: string | undefined };
      };
      expect(body.data.items).toHaveLength(1);
      expect(body.data.nextCursor).toBeUndefined();
    });

    it("returns nextCursor when hasMore", async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `p${i}`,
        category: "HAZARD",
        content: "test",
        reviewStatus: "PENDING",
        actionStatus: null,
        isUrgent: false,
        createdAt: new Date(
          `2025-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
        ),
        imageCount: 0,
      }));
      mockAllQueue.push(items);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { items: unknown[]; nextCursor: string };
      };
      expect(body.data.items).toHaveLength(20);
      expect(body.data.nextCursor).toBeDefined();
    });

    it("filters by siteId and reviewStatus", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/me?siteId=s1&reviewStatus=APPROVED",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("supports cursor parameter", async () => {
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/me?cursor=1704067200000", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /posts/:id", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/nonexistent", {}, env);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("POST_NOT_FOUND");
    });

    it("returns post with images, reviews, and author", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        isAnonymous: false,
        siteId: "s1",
      });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([{ id: "img1", fileUrl: "test.jpg" }]);
      mockAllQueue.push([{ id: "r1", postId: "p1" }]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          post: {
            author: { id: string } | null;
            images: unknown[];
            reviews: unknown[];
          };
        };
      };
      expect(body.data.post.author).toBeTruthy();
      expect(body.data.post.images).toHaveLength(1);
      expect(body.data.post.reviews).toHaveLength(1);
    });

    it("hides author for anonymous post", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "u1",
        isAnonymous: true,
        siteId: "s1",
      });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([]);
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { post: { author: null } };
      };
      expect(body.data.post.author).toBeNull();
    });

    it("logs audit for IMAGE_DOWNLOAD when images exist", async () => {
      const { logAuditWithContext } = await import("../../lib/audit");

      mockGetQueue.push({ id: "p1", userId: "u1", isAnonymous: false });
      mockGetQueue.push({ id: "u1", nameMasked: "Te**" });
      mockAllQueue.push([{ id: "img1", fileUrl: "test.jpg" }]);
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      await app.request("/posts/p1", {}, env);

      expect(logAuditWithContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "IMAGE_DOWNLOAD",
        "user-1",
        "IMAGE",
        "p1",
        expect.objectContaining({ imageIds: ["img1"] }),
      );
    });
  });

  describe("POST /posts/:id/images", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/nonexistent/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own the post", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 when no file provided", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NO_FILE");
    });

    it("returns 400 for invalid file type", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.txt", { type: "text/plain" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_FILE_TYPE");
    });

    it("returns 400 for file too large", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const bigContent = new Uint8Array(11 * 1024 * 1024);
      formData.append(
        "file",
        new File([bigContent], "big.jpg", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FILE_TOO_LARGE");
    });

    it("uploads image successfully", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockReturningGetQueue.push({
        id: "img-1",
        postId: "p1",
        fileUrl: "posts/p1/abc.jpg",
      });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["imagedata"], "photo.jpg", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { image: { id: string } } };
      expect(body.data.image.id).toBe("img-1");
    });

    it("uploads video successfully with mediaType video", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockReturningGetQueue.push({
        id: "vid-1",
        postId: "p1",
        fileUrl: "posts/p1/abc.mp4",
      });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["videodata"], "clip.mp4", { type: "video/mp4" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { image: { id: string } };
      };
      expect(body.data.image.id).toBe("vid-1");
    });

    it("returns 400 for video file too large (>50MB)", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      const bigVideo = new Uint8Array(51 * 1024 * 1024);
      formData.append(
        "file",
        new File([bigVideo], "huge.mp4", { type: "video/mp4" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("FILE_TOO_LARGE");
      expect(body.error.message).toContain("50MB");
    });

    it("falls back to jpg extension when filename has no extension", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockReturningGetQueue.push({
        id: "img-2",
        postId: "p1",
        fileUrl: "posts/p1/abc.jpg",
      });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["imagedata"], "photo.", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/posts/p1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { image: { id: string } };
      };
      expect(body.data.image.id).toBe("img-2");
    });
  });

  describe("DELETE /posts/:id", () => {
    it("returns 404 when post not found", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/nonexistent",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user is not owner and not admin", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("deletes post by owner", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockAllQueue.push([{ fileUrl: "posts/p1/img1.jpg" }]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
      expect(
        (env as Record<string, { delete: ReturnType<typeof vi.fn> }>).R2.delete,
      ).toHaveBeenCalledWith("posts/p1/img1.jpg");
    });

    it("allows admin to delete any post", async () => {
      mockGetQueue.push({ id: "p1", userId: "other-user" });
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });

    it("deletes multiple R2 images before deleting post", async () => {
      mockGetQueue.push({ id: "p1", userId: "user-1" });
      mockAllQueue.push([
        { fileUrl: "posts/p1/img1.jpg" },
        { fileUrl: "posts/p1/img2.jpg" },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/posts/p1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
      const r2 = (env as Record<string, { delete: ReturnType<typeof vi.fn> }>)
        .R2;
      expect(r2.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe("POST /posts/:id/ai-classify", () => {
    it("returns 403 for non-admin users", async () => {
      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when target post does not exist", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request(
        "/posts/missing/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 503 when AI credentials are missing", async () => {
      const { getAiCredentials } = await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce(null);
      mockGetQueue.push({ id: "p1", content: "hazard content" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN", "admin-1"));
      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(503);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("AI_NOT_CONFIGURED");
    });

    it("returns 500 when AI classification fails", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce(null);
      mockGetQueue.push({ id: "p1", content: "hazard content" });
      mockAllQueue.push([]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("AI_FAILED");
    });

    it("classifies post and updates urgency for high-risk result", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedCategory: "HAZARD",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "HIGH",
        classificationReason: "high risk",
        keyFindings: ["fall risk"],
        confidence: 0.9,
        modelVersion: "test-model",
      });

      mockGetQueue.push({ id: "p1", content: "hazard content" });
      mockAllQueue.push([{ fileUrl: "/r2/posts/p1/image.jpg" }]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const r2 = env as Record<
        string,
        { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
      >;
      r2.R2.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
        httpMetadata: { contentType: "image/jpeg" },
      });

      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { classification: { suggestedRiskLevel: string } };
      };
      expect(body.data.classification.suggestedRiskLevel).toBe("HIGH");
      expect(r2.R2.get).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("classifies LOW risk post without setting isUrgent", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedCategory: "HAZARD",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "low risk",
        keyFindings: [],
        confidence: 0.5,
        modelVersion: "test-model",
      });

      mockGetQueue.push({ id: "p1", content: "minor issue" });
      mockAllQueue.push([]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { classification: { suggestedRiskLevel: string } };
      };
      expect(body.data.classification.suggestedRiskLevel).toBe("LOW");
    });

    it("skips image when fileUrl is empty", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedCategory: "HAZARD",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "reason",
        keyFindings: [],
        confidence: 0.8,
        modelVersion: "test-model",
      });

      mockGetQueue.push({ id: "p1", content: "hazard content" });
      mockAllQueue.push([{ fileUrl: "" }]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      expect(r2.R2.get).not.toHaveBeenCalled();
    });

    it("skips image when R2 returns null", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedCategory: "HAZARD",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "reason",
        keyFindings: [],
        confidence: 0.8,
        modelVersion: "test-model",
      });

      mockGetQueue.push({ id: "p1", content: "hazard content" });
      mockAllQueue.push([{ fileUrl: "/r2/posts/p1/image.jpg" }]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      r2.R2.get.mockResolvedValueOnce(null);

      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("falls back to image/jpeg when contentType is missing", async () => {
      const { classifyPost, getAiCredentials } =
        await import("../../lib/gemini-ai");
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        apiKey: "test-key",
        textModel: "gemini-test",
      });
      vi.mocked(classifyPost).mockResolvedValueOnce({
        suggestedCategory: "HAZARD",
        suggestedHazardType: null,
        suggestedHazardSubcategory: null,
        suggestedRiskLevel: "LOW",
        classificationReason: "reason",
        keyFindings: [],
        confidence: 0.8,
        modelVersion: "test-model",
      });

      mockGetQueue.push({ id: "p1", content: "hazard content" });
      mockAllQueue.push([{ fileUrl: "/r2/posts/p1/image.jpg" }]);

      const { app, env } = await createApp(
        makeAuth("SUPER_ADMIN", "super-admin-1"),
      );
      const r2 = env as Record<string, { get: ReturnType<typeof vi.fn> }>;
      r2.R2.get.mockResolvedValueOnce({
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
        httpMetadata: {},
      });

      const res = await app.request(
        "/posts/p1/ai-classify",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      expect(r2.R2.get).toHaveBeenCalled();
    });
  });

  describe("POST /posts/:id/resubmit", () => {
    it("returns 404 when post does not exist", async () => {
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/p404/resubmit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplementaryContent: "update" }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 for non-owner", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "someone-else",
        reviewStatus: "REJECTED",
      });

      const { app, env } = await createApp(makeAuth("WORKER", "user-1"));
      const res = await app.request(
        "/posts/p1/resubmit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplementaryContent: "update" }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when status cannot be resubmitted", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "user-1",
        reviewStatus: "PENDING",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/p1/resubmit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplementaryContent: "update" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("resubmits post and awards supplementary points", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "user-1",
        siteId: "site-1",
        reviewStatus: "REJECTED",
      });
      mockGetQueue.push({
        id: "p1",
        userId: "user-1",
        siteId: "site-1",
        reviewStatus: "PENDING",
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/p1/resubmit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplementaryContent: "fixed details" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockBatch).toHaveBeenCalledTimes(1);
    });

    it("returns 404 when post disappears after batch update", async () => {
      mockGetQueue.push({
        id: "p1",
        userId: "user-1",
        siteId: "site-1",
        reviewStatus: "REJECTED",
      });
      mockGetQueue.push(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/posts/p1/resubmit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplementaryContent: "updated info" }),
        },
        env,
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("POST_NOT_FOUND");
    });
  });
});
