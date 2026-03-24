import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  analyzeActionImage,
  compareBeforeAfterImages,
  getAiCredentials,
} from "../../lib/gemini-ai";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          raw: Request;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const cloned = c.req.raw.clone();
      try {
        const body = await cloned.json();
        c.req.addValidatedData("json", body);
      } catch {
        c.req.addValidatedData("json", {});
      }
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.offset = vi.fn(self);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.values = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(self);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = vi.fn(self);
  chain.run = mockRun;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => makeUpdateChain()),
  delete: vi.fn(() => makeDeleteChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  actions: {
    id: "id",
    postId: "postId",
    assigneeId: "assigneeId",
    actionStatus: "actionStatus",
    createdAt: "createdAt",
    completedAt: "completedAt",
    completionNote: "completionNote",
  },
  actionImages: {
    id: "id",
    actionId: "actionId",
    fileUrl: "fileUrl",
    imageType: "imageType",
    createdAt: "createdAt",
  },
  posts: {
    id: "id",
    siteId: "siteId",
    content: "content",
    category: "category",
  },
  pointsLedger: { id: "id" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  users: { id: "id", nameMasked: "nameMasked", companyName: "companyName" },
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/gemini-ai", () => ({
  analyzeActionImage: vi.fn(async () => null),
  compareBeforeAfterImages: vi.fn(async () => null),
  getAiCredentials: vi.fn(() => null),
}));

vi.mock("../../lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
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

function makeAuth(role = "WORKER"): AuthContext {
  return {
    user: {
      id: "user-1",
      name: "Kim",
      nameMasked: "K**",
      phone: "010-1234",
      role,
    },
    loginDate: "2025-01-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../actions");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = {
    DB: {},
    R2: { put: vi.fn(), delete: vi.fn() },
  } as Record<string, unknown>;
  return { app, env };
}

describe("actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("POST /", () => {
    it("returns 400 when postId is missing", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assigneeType: "INDIVIDUAL" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when post not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
            assigneeType: "INDIVIDUAL",
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user is a WORKER", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "post-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
            assigneeType: "INDIVIDUAL",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("creates an action successfully", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "post-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "action-1", actionStatus: "NONE" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
            assigneeType: "INDIVIDUAL",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as { data: { action: { id: string } } };
      expect(json.data.action.id).toBe("action-1");
    });

    it("uses UNASSIGNED fallback when assigneeType is omitted", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "post-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "action-1", actionStatus: "NONE" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("creates action with dueDate", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "post-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "action-2", actionStatus: "NONE" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
            assigneeType: "INDIVIDUAL",
            dueDate: "2026-12-31",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 500 when DB throws during action creation", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("DB failure");
      });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: "00000000-0000-0000-0000-000000000001",
            assigneeType: "INDIVIDUAL",
          }),
        },
        env,
      );

      expect(res.status).toBe(500);
    });
  });

  describe("GET /", () => {
    it("returns a list of actions", async () => {
      mockAll.mockResolvedValueOnce([
        {
          action: { id: "a1", actionStatus: "NONE" },
          post: { id: "p1", title: "test", category: "UNSAFE_ACT" },
          assignee: null,
        },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { data: unknown[] } };
      expect(json.data.data).toHaveLength(1);
    });

    it("filters by postId query parameter", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/?postId=p1", {}, env);
      expect(res.status).toBe(200);
    });

    it("filters by valid status query parameter", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/?status=NONE", {}, env);
      expect(res.status).toBe(200);
    });

    it("ignores invalid status query parameter", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/?status=INVALID_STATUS", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /my", () => {
    it("returns my assigned actions", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/my", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { data: { data: unknown[] } };
      expect(json.data.data).toHaveLength(0);
    });

    it("filters by valid status query parameter", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/my?status=ASSIGNED", {}, env);
      expect(res.status).toBe(200);
    });

    it("ignores invalid status query parameter", async () => {
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/my?status=INVALID_STATUS", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /:id", () => {
    it("returns 404 when action not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/action-1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns action with images", async () => {
      mockGet.mockResolvedValueOnce({
        action: { id: "a1", actionStatus: "NONE" },
        post: { id: "p1", title: "test", category: "UNSAFE_ACT" },
        assignee: null,
      });
      mockAll.mockResolvedValueOnce([
        { id: "img1", fileUrl: "actions/a1/test.jpg" },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/action-1", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { data: { images: unknown[] } };
      };
      expect(json.data.data.images).toHaveLength(1);
    });
  });

  describe("PATCH /:id", () => {
    it("returns 404 when action not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/action-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "ASSIGNED" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid status transition", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "NONE",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "COMPLETED" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("updates action status successfully", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "NONE",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "a1", actionStatus: "ASSIGNED" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "ASSIGNED" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("awards points on VERIFIED transition", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "COMPLETED",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "a1", actionStatus: "VERIFIED" });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "VERIFIED" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("returns 404 when associated post is not found", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "ASSIGNED",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "IN_PROGRESS" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user is neither assignee nor manager", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "NONE",
          postId: "p1",
          assigneeId: "other-user",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "ASSIGNED" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("sets completedAt when transitioning to COMPLETED", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "IN_PROGRESS",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "a1", actionStatus: "COMPLETED" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "COMPLETED" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("updates completionNote field", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "ASSIGNED",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "a1", actionStatus: "ASSIGNED" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completionNote: "Task done" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 409 on concurrent status conflict", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          actionStatus: "NONE",
          postId: "p1",
          assigneeId: "user-1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: "ASSIGNED" }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });
  });

  describe("POST /:id/images", () => {
    it("returns 404 when action not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.jpg", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/action-1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("uploads image successfully as assignee", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", assigneeId: "user-1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "img-1", fileUrl: "actions/a1/uuid.jpg" });
      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "BEFORE");
      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 when non-assignee worker has no admin membership", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "other-user",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth("WORKER"));
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.jpg", { type: "image/jpeg" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when imageType is invalid", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", assigneeId: "user-1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "MIDDLE");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when file is missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", assigneeId: "user-1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append("imageType", "BEFORE");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when file type is not an allowed image type", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", assigneeId: "user-1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["text"], "notes.txt", { type: "text/plain" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("runs async AI analysis and before/after auto-compare for AFTER images", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockResolvedValueOnce({
        score: 88,
      } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce({
        summary: "good",
      } as never);

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix hazard",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "r2/actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("before").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("after").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );

      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(executionCtx.waitUntil).toHaveBeenCalledTimes(2);
      expect(analyzeActionImage).toHaveBeenCalled();
      expect(compareBeforeAfterImages).toHaveBeenCalled();
      expect(r2Get).toHaveBeenCalledTimes(2);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("auto-compare returns early when R2 key is empty", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({ id: "img-before", fileUrl: "" });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi.fn();
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(r2Get).not.toHaveBeenCalled();
    });

    it("auto-compare returns early when R2 object is null", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          arrayBuffer: async () => new ArrayBuffer(0),
          httpMetadata: {},
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(r2Get).toHaveBeenCalledTimes(2);
      expect(compareBeforeAfterImages).not.toHaveBeenCalled();
    });

    it("auto-compare skips update when comparison returns null", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce(null);

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("b").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("a").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(compareBeforeAfterImages).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("auto-compare catches errors in comparison flow", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockRejectedValueOnce(
        new Error("AI comparison failed"),
      );

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("b").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("a").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(compareBeforeAfterImages).toHaveBeenCalled();
    });

    it("auto-compare uses fallback mimeType and handles null description", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce(null);

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("b").buffer,
          httpMetadata: {},
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("a").buffer,
          httpMetadata: {},
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(vi.mocked(compareBeforeAfterImages)).toHaveBeenCalledWith(
        { apiKey: "x" },
        expect.any(String),
        expect.any(String),
        "image/jpeg",
        undefined,
      );
    });

    it("auto-compare catch handles non-Error throwable", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockRejectedValueOnce("string error");

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
          description: "fix",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-after",
          fileUrl: "actions/a1/after.jpg",
        })
        .mockResolvedValueOnce({
          id: "img-before",
          fileUrl: "actions/a1/before.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const r2Get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("b").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("a").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = r2Get;

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "after.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "AFTER");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
    });

    it("returns 404 when associated post not found", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
        })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["data"], "test.jpg", { type: "image/jpeg" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("AI analysis catches errors when analyzeActionImage throws", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockRejectedValueOnce(
        new Error("AI failed"),
      );

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-1",
          fileUrl: "actions/a1/test.jpg",
        });

      const { app, env } = await createApp(makeAuth());

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "test.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "BEFORE");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(analyzeActionImage).toHaveBeenCalled();
    });

    it("falls back to jpg extension when file has empty name and uses null imageType when not provided", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-1",
          fileUrl: "actions/a1/uuid.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], ".", { type: "image/jpeg" }),
      );
      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 when non-assignee has no membership for image upload", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "other-user",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "test.jpg", { type: "image/jpeg" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when non-assignee has WORKER membership for image upload", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "other-user",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "test.jpg", { type: "image/jpeg" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("allows non-assignee with SITE_ADMIN membership to upload image", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "other-user",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          fileUrl: "actions/a1/test.jpg",
        });

      const { app, env } = await createApp(makeAuth());
      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "test.jpg", { type: "image/jpeg" }),
      );

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("AI analysis logs non-Error throwable as undefined", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockRejectedValueOnce("string error");

      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          assigneeId: "user-1",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({
          id: "img-1",
          fileUrl: "actions/a1/test.jpg",
        });

      const { app, env } = await createApp(makeAuth());

      const pending: Promise<unknown>[] = [];
      const executionCtx = {
        waitUntil: vi.fn((p: Promise<unknown>) => {
          pending.push(p);
        }),
        passThroughOnException: vi.fn(),
        props: {},
      };

      const formData = new FormData();
      formData.append(
        "file",
        new File(["binary"], "test.jpg", { type: "image/jpeg" }),
      );
      formData.append("imageType", "BEFORE");

      const res = await app.request(
        "/a1/images",
        { method: "POST", body: formData },
        env,
        executionCtx,
      );
      await Promise.all(pending);

      expect(res.status).toBe(201);
      expect(analyzeActionImage).toHaveBeenCalled();
    });
  });

  describe("DELETE /:id/images/:imageId", () => {
    it("returns 404 when action not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/action-1/images/img-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("deletes image successfully", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1", assigneeId: "user-1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          fileUrl: "actions/a1/test.jpg",
          actionId: "a1",
        });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST /:id/compare-images", () => {
    it("returns 403 for non-admin", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 503 when AI is not configured", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 404 when action is missing", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 when BEFORE/AFTER images are missing", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", description: "desc" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("compares and stores AI result", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce({
        summary: "improved",
      } as never);

      mockGet
        .mockResolvedValueOnce({ id: "a1", description: "desc" })
        .mockResolvedValueOnce({ id: "before", fileUrl: "r2/actions/a1/b.jpg" })
        .mockResolvedValueOnce({ id: "after", fileUrl: "r2/actions/a1/a.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("before").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("after").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });

      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns 400 when extracted image keys are invalid", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", description: "desc" })
        .mockResolvedValueOnce({ id: "before", fileUrl: "" })
        .mockResolvedValueOnce({ id: "after", fileUrl: "r2/actions/a1/a.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 when BEFORE/AFTER files are missing in R2", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", description: "desc" })
        .mockResolvedValueOnce({ id: "before", fileUrl: "r2/actions/a1/b.jpg" })
        .mockResolvedValueOnce({ id: "after", fileUrl: "r2/actions/a1/a.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("after").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });

      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 500 when AI comparison returns null", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce(null);
      mockGet
        .mockResolvedValueOnce({ id: "a1", description: "desc" })
        .mockResolvedValueOnce({ id: "before", fileUrl: "r2/actions/a1/b.jpg" })
        .mockResolvedValueOnce({ id: "after", fileUrl: "r2/actions/a1/a.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("before").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("after").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });

      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(500);
    });

    it("falls back to image/jpeg when R2 objects have no contentType and handles null description", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(compareBeforeAfterImages).mockResolvedValueOnce({
        summary: "changed",
      } as never);

      mockGet
        .mockResolvedValueOnce({ id: "a1", description: null })
        .mockResolvedValueOnce({ id: "before", fileUrl: "r2/actions/a1/b.jpg" })
        .mockResolvedValueOnce({ id: "after", fileUrl: "r2/actions/a1/a.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("before").buffer,
          httpMetadata: {},
        })
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("after").buffer,
          httpMetadata: {},
        });

      const res = await app.request(
        "/a1/compare-images",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(compareBeforeAfterImages)).toHaveBeenCalledWith(
        { apiKey: "x" },
        expect.any(String),
        expect.any(String),
        "image/jpeg",
        undefined,
      );
    });
  });

  describe("POST /:id/images/:imageId/analyze", () => {
    it("returns 503 when AI is not configured", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 404 when image record is not found", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when action is not found", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 404 when associated post is not found", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 403 when user is not authorized to analyze", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("analyzes an image successfully", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockResolvedValueOnce({
        score: 90,
      } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "img-1", fileUrl: "actions/a1/x.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("image").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });

      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns 404 when image file is missing in R2", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "img-1", fileUrl: "actions/a1/x.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce(null);

      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 500 when AI analysis fails", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockResolvedValueOnce(null);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "img-1", fileUrl: "actions/a1/x.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("image").buffer,
          httpMetadata: { contentType: "image/jpeg" },
        });

      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
    });

    it("falls back to image/jpeg mimeType when R2 object has no contentType", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ apiKey: "x" } as never);
      vi.mocked(analyzeActionImage).mockResolvedValueOnce({
        score: 80,
      } as never);
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "img-1", fileUrl: "actions/a1/x.jpg" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      (env.R2 as { get: ReturnType<typeof vi.fn> }).get = vi
        .fn()
        .mockResolvedValueOnce({
          arrayBuffer: async () => new TextEncoder().encode("img").buffer,
          httpMetadata: {},
        });

      const res = await app.request(
        "/a1/images/img-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(analyzeActionImage)).toHaveBeenCalledWith(
        { apiKey: "x" },
        expect.any(String),
        "image/jpeg",
      );
    });
  });

  describe("GET /:id/comparison", () => {
    it("returns 404 when action is not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 404 when associated post is not found", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: null,
        })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 when non-admin non-assignee has no valid membership", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "assignee-1",
          aiComparison: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns null comparison when aiComparison is empty", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: null,
          aiComparedAt: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: unknown; comparedAt: unknown };
      };
      expect(json.data.comparison).toBeNull();
      expect(json.data.comparedAt).toBeNull();
    });

    it("returns parsed comparison when aiComparison is valid JSON", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: '{"summary":"ok"}',
          aiComparedAt: "2026-01-01T00:00:00.000Z",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: { summary: string }; comparedAt: string | null };
      };
      expect(json.data.comparison.summary).toBe("ok");
      expect(json.data.comparedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("falls back to null comparison on malformed aiComparison JSON", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: "{bad-json",
          aiComparedAt: "2026-01-01T00:00:00.000Z",
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: unknown; comparedAt: string | null };
      };
      expect(json.data.comparison).toBeNull();
      expect(json.data.comparedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns null comparedAt when malformed JSON and aiComparedAt is null", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: "{bad-json",
          aiComparedAt: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: unknown; comparedAt: string | null };
      };
      expect(json.data.comparison).toBeNull();
      expect(json.data.comparedAt).toBeNull();
    });

    it("returns 403 when non-assignee has no site membership", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "other-user",
          aiComparison: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 when non-assignee membership role is WORKER", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "other-user",
          aiComparison: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(403);
    });

    it("allows non-assignee with SITE_ADMIN membership to view comparison", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "other-user",
          aiComparison: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: unknown; comparedAt: string | null };
      };
      expect(json.data.comparison).toBeNull();
      expect(json.data.comparedAt).toBeNull();
    });

    it("returns null comparedAt with valid JSON and null aiComparedAt", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "a1",
          postId: "p1",
          assigneeId: "user-1",
          aiComparison: '{"summary":"ok"}',
          aiComparedAt: null,
        })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/a1/comparison", {}, env);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        data: { comparison: { summary: string }; comparedAt: string | null };
      };
      expect(json.data.comparison.summary).toBe("ok");
      expect(json.data.comparedAt).toBeNull();
    });
  });

  describe("GET /:id/images/:imageId/ai-analysis", () => {
    it("returns 404 when action is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 404 when associated post is missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 when user is not authorized", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 404 when image record is missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns null aiAnalysis when no analysis exists", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "img-1", aiAnalysis: null });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { aiAnalysis: unknown; aiAnalyzedAt: unknown };
      };
      expect(body.data.aiAnalysis).toBeNull();
      expect(body.data.aiAnalyzedAt).toBeNull();
    });

    it("returns parsed aiAnalysis for valid JSON", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          aiAnalysis: '{"score":95}',
          aiAnalyzedAt: "2026-01-01T00:00:00.000Z",
        });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { aiAnalysis: { score: number }; aiAnalyzedAt: string | null };
      };
      expect(body.data.aiAnalysis.score).toBe(95);
      expect(body.data.aiAnalyzedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns null aiAnalyzedAt when valid JSON but aiAnalyzedAt is null", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          aiAnalysis: '{"score":50}',
          aiAnalyzedAt: null,
        });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { aiAnalysis: { score: number }; aiAnalyzedAt: string | null };
      };
      expect(body.data.aiAnalysis.score).toBe(50);
      expect(body.data.aiAnalyzedAt).toBeNull();
    });

    it("falls back to null aiAnalysis on malformed JSON", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          aiAnalysis: "{bad-json",
          aiAnalyzedAt: "2026-01-01T00:00:00.000Z",
        });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { aiAnalysis: unknown; aiAnalyzedAt: string | null };
      };
      expect(body.data.aiAnalysis).toBeNull();
      expect(body.data.aiAnalyzedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns null aiAnalyzedAt when malformed JSON and aiAnalyzedAt is null", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "img-1",
          aiAnalysis: "{bad",
          aiAnalyzedAt: null,
        });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/a1/images/img-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { aiAnalysis: unknown; aiAnalyzedAt: string | null };
      };
      expect(body.data.aiAnalysis).toBeNull();
      expect(body.data.aiAnalyzedAt).toBeNull();
    });
  });

  describe("DELETE /:id/images/:imageId", () => {
    it("returns 404 when associated post is missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1", assigneeId: "user-1" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when requester is worker", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1", assigneeId: "user-1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/a1/images/img-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 when image row is missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "a1", postId: "p1", assigneeId: "user-1" })
        .mockResolvedValueOnce({ id: "p1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "SITE_ADMIN" })
        .mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/a1/images/img-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });
  });
});
