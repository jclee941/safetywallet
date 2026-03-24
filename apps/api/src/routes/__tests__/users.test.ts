import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../lib/crypto", () => ({
  decrypt: vi.fn(async () => "010-1234-5678"),
}));

vi.mock("../../lib/session-cache", () => ({
  invalidateCachedUser: vi.fn(async () => {}),
}));

vi.mock("../../lib/response", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/response")>(
      "../../lib/response",
    );
  return actual;
});

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockUpdateGet = vi.fn();

function makeChain() {
  const chain: Record<string, unknown> = {};
  const proxy = (): Record<string, unknown> => chain;
  chain.from = vi.fn(proxy);
  chain.leftJoin = vi.fn(proxy);
  chain.where = vi.fn(proxy);
  chain.orderBy = vi.fn(proxy);
  chain.limit = vi.fn(proxy);
  chain.offset = vi.fn(proxy);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => {
      const whereChain: Record<string, unknown> = {};
      whereChain.returning = vi.fn(() => ({
        get: mockUpdateGet,
      }));
      whereChain.where = vi.fn(() => whereChain);
      return whereChain;
    }),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    phoneEncrypted: "phoneEncrypted",
    piiViewFull: "piiViewFull",
    role: "role",
    createdAt: "createdAt",
    deletionRequestedAt: "deletionRequestedAt",
    deletedAt: "deletedAt",
    updatedAt: "updatedAt",
  },
  siteMemberships: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
    joinedAt: "joinedAt",
  },
  sites: { id: "id", name: "name", active: "active" },
  pointsLedger: {
    id: "id",
    userId: "userId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    createdAt: "createdAt",
  },
  posts: {
    id: "id",
    userId: "userId",
    category: "category",
    content: "content",
    reviewStatus: "reviewStatus",
    createdAt: "createdAt",
  },
  reviews: {},
  actions: {},
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
  const { default: usersRoute } = await import("../users");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/users", usersRoute);
  const env = { DB: {}, ENCRYPTION_KEY: "test-key" } as Record<string, unknown>;
  return { app, env };
}

describe("routes/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /users/me", () => {
    it("returns user profile with memberships and points", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "user-1",
          name: "Test",
          nameMasked: "Te**",
          phoneEncrypted: "encrypted",
          piiViewFull: true,
          role: "WORKER",
          createdAt: "2025-01-01",
        })
        .mockResolvedValueOnce({ total: 150 });
      mockAll.mockResolvedValueOnce([
        {
          id: "m1",
          role: "WORKER",
          status: "ACTIVE",
          site: { id: "s1", name: "Site" },
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { user: { totalPoints: number } };
      };
      expect(body.data.user.totalPoints).toBe(150);
    });

    it("returns 404 when user not found", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me", {}, env);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /users/me", () => {
    it("returns 400 for malformed JSON body", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{invalid",
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("updates user name", async () => {
      mockUpdateGet.mockResolvedValue({
        id: "user-1",
        name: "NewName",
        nameMasked: "N******",
        phoneEncrypted: null,
        piiViewFull: false,
        role: "WORKER",
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "NewName" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 when no name provided", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("invalidates KV cache when KV binding is present", async () => {
      mockUpdateGet.mockResolvedValue({
        id: "user-1",
        name: "NewName",
        nameMasked: "N******",
        phoneEncrypted: null,
        piiViewFull: false,
        role: "WORKER",
      });
      const { app, env } = await createApp(makeAuth());
      const mockKV = { delete: vi.fn().mockResolvedValue(undefined) };
      env.KV = mockKV;
      const res = await app.request(
        "/users/me",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "NewName" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const { invalidateCachedUser } = await import("../../lib/session-cache");
      expect(invalidateCachedUser).toHaveBeenCalledWith(mockKV, "user-1");
    });
  });

  describe("GET /users/me/points", () => {
    it("returns points ledger with total", async () => {
      mockAll.mockResolvedValueOnce([
        {
          id: "p1",
          amount: 100,
          reasonCode: "SAFETY",
          createdAt: "2025-01-01",
        },
      ]);
      mockGet.mockResolvedValueOnce({ total: 100 });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me/points", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { total: number; points: unknown[] };
      };
      expect(body.data.total).toBe(100);
      expect(body.data.points).toHaveLength(1);
    });

    it("returns 0 total when no points", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me/points", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { total: number } };
      expect(body.data.total).toBe(0);
    });
  });

  describe("GET /users/me/memberships", () => {
    it("returns memberships list", async () => {
      mockAll.mockResolvedValue([
        {
          id: "m1",
          role: "WORKER",
          status: "ACTIVE",
          joinedAt: "2025-01-01",
          site: { id: "s1", name: "Site", active: true },
        },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me/memberships", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { memberships: unknown[] } };
      expect(body.data.memberships).toHaveLength(1);
    });
  });

  describe("POST /users/me/deletion-request", () => {
    it("creates deletion request", async () => {
      mockGet.mockResolvedValue({ deletionRequestedAt: null });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me/deletion-request",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { deletionRequestedAt: string };
      };
      expect(body.data.deletionRequestedAt).toBeTruthy();
    });

    it("returns 409 when already requested", async () => {
      mockGet.mockResolvedValue({ deletionRequestedAt: "2025-01-01" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me/deletion-request",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /users/me/deletion-request", () => {
    it("cancels deletion request", async () => {
      mockGet.mockResolvedValue({
        deletionRequestedAt: "2025-01-01",
        deletedAt: null,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me/deletion-request",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when no deletion request exists", async () => {
      mockGet.mockResolvedValue({ deletionRequestedAt: null });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me/deletion-request",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 410 when already deleted", async () => {
      mockGet.mockResolvedValue({
        deletionRequestedAt: "2025-01-01",
        deletedAt: "2025-02-01",
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/me/deletion-request",
        {
          method: "DELETE",
        },
        env,
      );
      expect(res.status).toBe(410);
    });
  });

  describe("GET /users/me/data-export", () => {
    it("returns exported data", async () => {
      mockGet.mockResolvedValue({
        id: "user-1",
        name: "Test",
        role: "WORKER",
        createdAt: "2025-01-01",
      });
      mockAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/me/data-export", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { exportedAt: string; profile: unknown };
      };
      expect(body.data.exportedAt).toBeTruthy();
      expect(body.data.profile).toBeTruthy();
    });
  });
});
