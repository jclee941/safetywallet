import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { AdminChangeRoleSchema } from "../../../validators/schemas";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (
    _target: string,
    schema: {
      safeParse: (data: unknown) => { success: boolean; data?: unknown };
    },
  ) => {
    return async (
      c: {
        req: {
          json: () => Promise<unknown>;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const body = await c.req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: "Validation failed" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      c.req.addValidatedData("json", result.data);
      await next();
    };
  },
}));

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockDeleteWhere = vi.fn();
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
  chain.values = mockInsertValues.mockReturnValue(chain);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return chain;
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = mockDeleteWhere.mockReturnValue(chain);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
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
  sql: vi.fn(),
  gte: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  users: {
    id: "id",
    name: "name",
    nameMasked: "nameMasked",
    role: "role",
    phoneHash: "phoneHash",
    phoneEncrypted: "phoneEncrypted",
    dobEncrypted: "dobEncrypted",
    falseReportCount: "falseReportCount",
    restrictedUntil: "restrictedUntil",
    piiViewFull: "piiViewFull",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    deletedAt: "deletedAt",
  },
  auditLogs: {
    id: "id",
    action: "action",
    actorId: "actorId",
    targetType: "targetType",
    targetId: "targetId",
    reason: "reason",
  },
  userRoleEnum: ["WORKER", "SITE_ADMIN", "SUPER_ADMIN", "SYSTEM"],
  posts: { id: "id", userId: "userId" },
  postImages: { postId: "postId", fileUrl: "fileUrl" },
  reviews: { postId: "postId" },
  pointsLedger: { postId: "postId" },
  siteMemberships: { id: "id", userId: "userId" },
}));

vi.mock("../../../lib/crypto", () => ({
  decrypt: vi.fn(async () => "decrypted"),
  hmac: vi.fn(async () => "hashed-phone"),
}));

vi.mock("../../../lib/response", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/response")>(
    "../../../lib/response",
  );
  return actual;
});

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

vi.mock("../../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
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

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../users");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = {
    DB: {},
    KV: { delete: vi.fn() },
    R2: { delete: vi.fn() },
    HMAC_SECRET: "secret",
    ENCRYPTION_KEY: "enc-key",
    RATE_LIMITER: null,
  } as Record<string, unknown>;
  return { app, env };
}

describe("admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("GET /unlock-user/:phoneHash", () => {
    it("unlocks user by phoneHash", async () => {
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { unlocked: boolean } };
      expect(body.data.unlocked).toBe(true);
    });

    it("returns 403 for WORKER", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 400 when phoneHash param is empty", async () => {
      const { default: route } = await import("../users");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = {
        DB: {},
        KV: { delete: vi.fn() },
        R2: { delete: vi.fn() },
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc-key",
        RATE_LIMITER: null,
      } as Record<string, unknown>;
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("PHONE_HASH_REQUIRED");
    });

    it("continues when unlock-user audit log insert fails", async () => {
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/unlock-user/abc123", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { unlocked: boolean } };
      expect(body.data.unlocked).toBe(true);
    });
  });

  describe("POST /unlock-user-by-phone", () => {
    it("unlocks user by phone number", async () => {
      mockRun.mockResolvedValue(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "010-1234-5678" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      // Reset persistent mockDb.select implementation to avoid leaking into subsequent tests
      mockDb.select.mockImplementation(() => makeSelectChain());
    });

    it("returns 400 when changing own role", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/admin-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "WORKER" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("resets durable object limiter when RATE_LIMITER is configured", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 200 }));
      const mockLimiter = {
        idFromName: vi.fn().mockReturnValue("limiter-id"),
        get: vi.fn().mockReturnValue({ fetch: mockFetch }),
      };

      const { app, env } = await createApp(makeAuth());
      (env as Record<string, unknown>).RATE_LIMITER = mockLimiter;

      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "010-9999-0000" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockLimiter.idFromName).toHaveBeenCalled();
      expect(mockLimiter.get).toHaveBeenCalledWith("limiter-id");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("returns 400 for invalid phone payload", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "123" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for too-short (2-char) phone payload", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "12" }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("continues when unlock-user-by-phone audit log insert fails", async () => {
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/unlock-user-by-phone",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "010-1234-5678" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { unlocked: boolean } };
      expect(body.data.unlocked).toBe(true);
    });
  });

  describe("GET /users", () => {
    it("returns redacted pii when admin cannot view full pii", async () => {
      mockGet
        .mockResolvedValueOnce({ piiViewFull: false })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([
        {
          id: "u-1",
          name: "Kim",
          nameMasked: "K**",
          phoneEncrypted: "enc-phone",
          dobEncrypted: "enc-dob",
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users?limit=10&offset=0", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: Array<{ phone: string | null; dob: string | null }> };
      };
      expect(body.data.users[0].phone).toBeNull();
      expect(body.data.users[0].dob).toBeNull();
    });

    it("defaults piiViewFull to false when currentUserRecord is null", async () => {
      mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([
        {
          id: "u-1",
          name: "Kim",
          nameMasked: "K**",
          phoneEncrypted: "enc-phone",
          dobEncrypted: "enc-dob",
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: Array<{ phone: string | null; dob: string | null }> };
      };
      expect(body.data.users[0].phone).toBeNull();
      expect(body.data.users[0].dob).toBeNull();
    });

    it("returns null for phone/dob when encrypted values are null with piiViewFull", async () => {
      const { decrypt } = await import("../../../lib/crypto");
      mockGet
        .mockResolvedValueOnce({ piiViewFull: true })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([
        {
          id: "u-2",
          name: "Lee",
          nameMasked: "L**",
          phoneEncrypted: null,
          dobEncrypted: null,
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: Array<{ phone: string | null; dob: string | null }> };
      };
      expect(body.data.users[0].phone).toBeNull();
      expect(body.data.users[0].dob).toBeNull();
      expect(decrypt).not.toHaveBeenCalled();
    });

    it("sets targetUserId to undefined when viewing multiple users with piiViewFull", async () => {
      const { decrypt } = await import("../../../lib/crypto");
      const { logAuditWithContext } = await import("../../../lib/audit");

      vi.mocked(decrypt).mockResolvedValue("decrypted");
      mockGet
        .mockResolvedValueOnce({ piiViewFull: true })
        .mockResolvedValueOnce({ count: 2 });
      mockAll.mockResolvedValueOnce([
        {
          id: "u-1",
          name: "Kim",
          nameMasked: "K**",
          phoneEncrypted: "enc",
          dobEncrypted: "enc",
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
        {
          id: "u-2",
          name: "Park",
          nameMasked: "P**",
          phoneEncrypted: "enc2",
          dobEncrypted: "enc2",
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);

      expect(res.status).toBe(200);
      expect(logAuditWithContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        "PII_VIEW",
        "admin-1",
        "USER",
        "BULK",
        expect.objectContaining({
          targetUserId: undefined,
          rowCount: 2,
        }),
      );
    });

    it("returns total 0 when totalResult is null", async () => {
      mockGet
        .mockResolvedValueOnce({ piiViewFull: false })
        .mockResolvedValueOnce(null);
      mockAll.mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { total: number };
      };
      expect(body.data.total).toBe(0);
    });

    it("returns decrypted pii and logs audit when piiViewFull enabled", async () => {
      const { decrypt } = await import("../../../lib/crypto");
      const { logAuditWithContext } = await import("../../../lib/audit");

      vi.mocked(decrypt)
        .mockResolvedValueOnce("01012345678")
        .mockResolvedValueOnce("19900101");
      mockGet
        .mockResolvedValueOnce({ piiViewFull: true })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([
        {
          id: "u-1",
          name: "Kim",
          nameMasked: "K**",
          phoneEncrypted: "enc-phone",
          dobEncrypted: "enc-dob",
          role: "WORKER",
          falseReportCount: 0,
          restrictedUntil: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
        },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users", {}, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: Array<{ phone: string | null; dob: string | null }> };
      };
      expect(body.data.users[0].phone).toBe("01012345678");
      expect(body.data.users[0].dob).toBe("19900101");
      expect(logAuditWithContext).toHaveBeenCalled();
    });
  });

  describe("GET /users/restrictions", () => {
    it("returns restriction list", async () => {
      mockAll.mockResolvedValueOnce([
        { id: "u-1", restrictedUntil: new Date() },
      ]);
      mockGet.mockResolvedValueOnce({ count: 1 });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/restrictions?activeOnly=true",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: unknown[]; total: number };
      };
      expect(body.data.users).toHaveLength(1);
      expect(body.data.total).toBe(1);
    });

    it("returns restrictions without activeOnly filter", async () => {
      mockAll.mockResolvedValueOnce([
        { id: "u-1", restrictedUntil: new Date() },
      ]);
      mockGet.mockResolvedValueOnce({ count: 2 });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/restrictions", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { users: unknown[]; total: number };
      };
      expect(body.data.total).toBe(2);
    });

    it("returns total 0 when totalResult is null in restrictions", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/restrictions", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { total: number };
      };
      expect(body.data.total).toBe(0);
    });
  });

  describe("POST /users/:id/restriction/clear", () => {
    it("clears restriction and false-report count", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1", restrictedUntil: null });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/restriction/clear",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { user: { id: string } } };
      expect(body.data.user.id).toBe("u-1");
    });

    it("returns 404 when user does not exist", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/missing/restriction/clear",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 400 when userId param is empty", async () => {
      const { default: route } = await import("../users");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = {
        DB: {},
        KV: { delete: vi.fn() },
        R2: { delete: vi.fn() },
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc-key",
        RATE_LIMITER: null,
      } as Record<string, unknown>;
      const res = await app.request(
        "/users/u-1/restriction/clear",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("BAD_REQUEST");
    });

    it("continues when restriction-clear audit log insert fails", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1", restrictedUntil: null });
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit insert failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/restriction/clear",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { user: { id: string } } };
      expect(body.data.user.id).toBe("u-1");
    });
  });

  describe("PATCH /users/:id/role", () => {
    it("returns 400 for invalid role", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "NOPE" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 from route guard when role enum is invalid", async () => {
      const safeParseSpy = vi.spyOn(AdminChangeRoleSchema, "safeParse");
      const mockedParseResult = {
        success: true,
        data: { role: "INVALID_ROLE" },
      } as unknown as ReturnType<typeof AdminChangeRoleSchema.safeParse>;
      safeParseSpy.mockReturnValue(mockedParseResult);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "INVALID_ROLE" }),
        },
        env,
      );

      expect(res.status).toBe(400);
      safeParseSpy.mockRestore();
    });

    it("returns 404 when target user is not found before update", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-missing/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "WORKER" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when update returns null", async () => {
      mockGet
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "SITE_ADMIN" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("updates role successfully", async () => {
      const { logAuditWithContext } = await import("../../../lib/audit");
      mockGet
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "u-1", role: "SITE_ADMIN" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "SITE_ADMIN" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      expect(logAuditWithContext).toHaveBeenCalled();
    });
  });

  describe("POST /users/:id/lock", () => {
    it("returns 400 when userId is empty", async () => {
      const { default: route } = await import("../users");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = {
        DB: {},
        KV: { delete: vi.fn() },
        R2: { delete: vi.fn() },
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc-key",
        RATE_LIMITER: null,
      } as Record<string, unknown>;
      const res = await app.request("/users/u-1/lock", { method: "POST" }, env);
      expect(res.status).toBe(400);
    });

    it("locks user", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/u-1/lock", { method: "POST" }, env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { locked: boolean } };
      expect(body.data.locked).toBe(true);
    });

    it("returns 404 when lock target is missing", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/missing/lock",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("continues when lock audit log fails", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1" });
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit write failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/users/u-1/lock", { method: "POST" }, env);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /users/:id/unlock", () => {
    it("returns 400 when userId is empty", async () => {
      const { default: route } = await import("../users");
      const app = new Hono<AppEnv>();
      app.use("*", async (c, next) => {
        c.set("auth", makeAuth());
        c.req.param = ((key?: string) =>
          key ? "" : {}) as unknown as typeof c.req.param;
        await next();
      });
      app.route("/", route);
      const env = {
        DB: {},
        KV: { delete: vi.fn() },
        R2: { delete: vi.fn() },
        HMAC_SECRET: "secret",
        ENCRYPTION_KEY: "enc-key",
        RATE_LIMITER: null,
      } as Record<string, unknown>;
      const res = await app.request(
        "/users/u-1/unlock",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("unlocks user", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/unlock",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { locked: boolean } };
      expect(body.data.locked).toBe(false);
    });

    it("returns 404 when unlock target is missing", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/missing/unlock",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("continues when unlock audit log fails", async () => {
      mockGet.mockResolvedValueOnce({ id: "u-1" });
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit write failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/unlock",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /users/:id/emergency-purge", () => {
    it("purges user with posts, images, and memberships", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-target",
        name: "Kim",
        deletedAt: null,
      });
      mockAll.mockResolvedValueOnce([{ id: "p1" }]);
      mockAll.mockResolvedValueOnce([
        { fileUrl: "img1.jpg" },
        { fileUrl: "img2.jpg" },
      ]);

      const membershipResult = [{ id: "m1" }, { id: "m2" }];
      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue(membershipResult);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Legal compliance",
            confirmUserId: "u-target",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          purged: boolean;
          purgedPosts: number;
          purgedImages: number;
          purgedMemberships: number;
        };
      };
      expect(body.data.purged).toBe(true);
      expect(body.data.purgedPosts).toBe(1);
      expect(body.data.purgedImages).toBe(2);
      expect(body.data.purgedMemberships).toBe(2);
    });

    it("purges user with no posts", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-empty",
        name: "Lee",
        deletedAt: null,
      });
      mockAll.mockResolvedValueOnce([]);

      const membershipResult: unknown[] = [];
      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue(membershipResult);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-empty/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "User requested deletion",
            confirmUserId: "u-empty",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { purged: boolean; purgedPosts: number };
      };
      expect(body.data.purged).toBe(true);
      expect(body.data.purgedPosts).toBe(0);
    });

    it("returns 403 for non-SUPER_ADMIN", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for non-admin",
            confirmUserId: "u-target",
          }),
        },
        env,
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when confirmUserId does not match", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-target/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for wrong ID",
            confirmUserId: "WRONG_ID",
          }),
        },
        env,
      );

      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/nonexistent/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for missing user",
            confirmUserId: "nonexistent",
          }),
        },
        env,
      );

      expect(res.status).toBe(404);
    });

    it("returns 410 when user already purged", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-purged",
        name: "[긴급삭제]",
        deletedAt: new Date("2025-01-01"),
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/users/u-purged/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Test purge reason for already purged",
            confirmUserId: "u-purged",
          }),
        },
        env,
      );

      expect(res.status).toBe(410);
    });

    it("continues purge when R2 image delete throws", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-err",
        name: "Park",
        deletedAt: null,
      });
      mockAll
        .mockResolvedValueOnce([{ id: "p1" }])
        .mockResolvedValueOnce([{ fileUrl: "broken.jpg" }]);

      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue([{ id: "m1" }]);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      (
        env.R2 as { delete: ReturnType<typeof vi.fn> }
      ).delete.mockRejectedValueOnce(new Error("r2 failure"));

      const res = await app.request(
        "/users/u-err/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Emergency legal compliance cleanup",
            confirmUserId: "u-err",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("continues purge when R2 image delete throws non-Error value", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-str",
        name: "Yoon",
        deletedAt: null,
      });
      mockAll
        .mockResolvedValueOnce([{ id: "p1" }])
        .mockResolvedValueOnce([{ fileUrl: "non-error.jpg" }]);

      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue([{ id: "m1" }]);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      (
        env.R2 as { delete: ReturnType<typeof vi.fn> }
      ).delete.mockRejectedValueOnce("string error without Error class");

      const res = await app.request(
        "/users/u-str/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Compliance purge with non-Error R2 failure",
            confirmUserId: "u-str",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });

    it("continues purge when KV cleanup fails", async () => {
      mockGet.mockResolvedValueOnce({
        id: "u-kv",
        name: "Choi",
        deletedAt: null,
      });
      mockAll
        .mockResolvedValueOnce([{ id: "p1" }])
        .mockResolvedValueOnce([{ fileUrl: "img1.jpg" }]);

      mockDb.delete.mockImplementation(() => {
        const chain = makeDeleteChain();
        chain.returning = vi.fn().mockReturnValue([{ id: "m1" }]);
        return chain;
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      (env.KV as { delete: ReturnType<typeof vi.fn> }).delete
        .mockRejectedValueOnce(new Error("kv user delete failed"))
        .mockRejectedValueOnce(new Error("kv session delete failed"));

      const res = await app.request(
        "/users/u-kv/emergency-purge",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Compliance purge with kv cleanup failure",
            confirmUserId: "u-kv",
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /users/:id/login-exempt", () => {
    it("updates login exempt flag", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/login-exempt",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginExempt: true }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { updated: boolean; loginExempt: boolean };
      };
      expect(body.data.updated).toBe(true);
      expect(body.data.loginExempt).toBe(true);
    });

    it("disables login exempt flag", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/login-exempt",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginExempt: false }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { updated: boolean; loginExempt: boolean };
      };
      expect(body.data.updated).toBe(true);
      expect(body.data.loginExempt).toBe(false);
    });

    it("continues when login-exempt audit log fails", async () => {
      mockDb.insert.mockImplementationOnce(() => {
        throw new Error("audit write failed");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/users/u-1/login-exempt",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginExempt: false }),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });
});
