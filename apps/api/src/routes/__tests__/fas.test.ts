import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

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

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(
    async (
      c: {
        get: (key: string) => unknown;
        json: (body: unknown, status?: number) => Response;
      },
      next: () => Promise<void>,
    ) => {
      if (!c.get("auth")) {
        return c.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Unauthorized" },
          },
          401,
        );
      }
      return next();
    },
  ),
}));

vi.mock("../../lib/auth.ts", () => ({}));

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

// Mock zValidator to pass through without consuming body stream
// (fas.ts re-reads raw body via c.req.raw.clone().json())
vi.mock("@hono/zod-validator", () => ({
  zValidator: () => {
    return async (_c: unknown, next: () => Promise<void>) => {
      await next();
    };
  },
}));

vi.mock("../../lib/crypto", () => ({
  hmac: vi.fn(async () => "hashed-value"),
  encrypt: vi.fn(async () => "encrypted-value"),
}));

vi.mock("../../utils/common", () => ({
  maskName: vi.fn((name: string) => name.slice(0, 1) + "**"),
}));

vi.mock("../../db/helpers", () => ({
  dbBatchChunked: vi.fn(async () => ({
    totalOps: 0,
    completedOps: 0,
    failedChunks: 0,
    errors: [] as Array<{ chunkIndex: number; error: string }>,
  })),
}));

vi.mock("../../validators/schemas", () => ({
  AdminSyncWorkersSchema: {},
}));

// ── Queue-based DB mock ────────────────────────────────────────────────
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

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn().mockResolvedValue({ success: true });

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => makeInsertChain()),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockResolvedValue({ success: true }),
    }),
  })),
  delete: vi.fn(() => ({
    where: mockDeleteWhere,
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../db/schema", () => ({
  users: {
    id: "id",
    externalWorkerId: "externalWorkerId",
    name: "name",
    nameMasked: "nameMasked",
    phone: "phone",
    phoneHash: "phoneHash",
    phoneEncrypted: "phoneEncrypted",
    dob: "dob",
    dobHash: "dobHash",
    dobEncrypted: "dobEncrypted",
    companyName: "companyName",
    tradeType: "tradeType",
    role: "role",
    externalSystem: "externalSystem",
  },
}));

// ── App Setup ──────────────────────────────────────────────────────────
async function createApp(auth?: AuthContext) {
  const { default: fasRoute } = await import("../fas");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) {
      c.set("auth", auth);
    }
    await next();
  });
  app.route("/fas", fasRoute);
  const env = {
    DB: {},
    HMAC_SECRET: "test-hmac-secret",
    ENCRYPTION_KEY: "test-encryption-key",
  };
  return { app, env };
}

function makeAuth(role = "SUPER_ADMIN", id = "admin-1"): AuthContext {
  return {
    user: {
      id,
      phone: "01012345678",
      role,
      name: "Admin",
      nameMasked: "Ad***",
    },
    loginDate: "2026-01-01",
  };
}

describe("routes/fas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockReturningGetQueue.length = 0;
  });

  // ── POST /fas/workers/sync ───────────────────────────────────────────
  describe("POST /fas/workers/sync", () => {
    it("creates new workers successfully", async () => {
      // Batch lookup via inArray → no existing users
      mockAllQueue.push([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "900101",
                companyName: "TestCo",
                tradeType: "Electrician",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { created: number; updated: number; failed: number };
      };
      expect(body.data.created).toBe(1);
      expect(body.data.updated).toBe(0);
      expect(body.data.failed).toBe(0);
    });

    it("updates existing workers", async () => {
      // Batch lookup → existing user found
      mockAllQueue.push([{ id: "user-1", externalWorkerId: "EXT-001" }]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim Updated",
                phone: "010-9999-8888",
                dob: "900101",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { created: number; updated: number; failed: number };
      };
      expect(body.data.created).toBe(0);
      expect(body.data.updated).toBe(1);
    });

    it("handles workers with missing required fields", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                // missing name, phone, dob
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          created: number;
          updated: number;
          failed: number;
          errors: Array<{ externalWorkerId: string; error: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0].error).toContain("Missing required fields");
    });

    it("handles multiple workers with mixed results", async () => {
      // Batch lookup → only EXT-002 exists
      mockAllQueue.push([{ id: "user-2", externalWorkerId: "EXT-002" }]);
      // Third worker: missing fields → fail (no DB query)

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1111-2222",
                dob: "900101",
              },
              {
                externalWorkerId: "EXT-002",
                name: "Lee",
                phone: "010-3333-4444",
                dob: "880202",
              },
              {
                externalWorkerId: "EXT-003",
                // Missing name, phone, dob
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { created: number; updated: number; failed: number };
      };
      expect(body.data.created).toBe(1);
      expect(body.data.updated).toBe(1);
      expect(body.data.failed).toBe(1);
    });

    it("handles batch DB error during worker processing", async () => {
      // Batch lookup: no existing users
      mockAllQueue.push([]);
      // Mock dbBatchChunked to report a failed chunk
      const helpers = await import("../../db/helpers");
      vi.mocked(helpers.dbBatchChunked).mockResolvedValueOnce({
        totalOps: 1,
        completedOps: 0,
        failedChunks: 1,
        errors: [{ chunkIndex: 0, error: "DB insert failed" }],
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "900101",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          created: number;
          failed: number;
          errors: Array<{ externalWorkerId: string; error: string }>;
        };
      };
      // created is incremented during build phase before batch execution
      expect(body.data.created).toBe(1);
      expect(body.data.failed).toBe(1);
      expect(body.data.errors[0].error).toBe(
        "Chunk 0 failed: DB insert failed",
      );
    });

    it("handles worker with 'unknown' externalWorkerId when missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                // no externalWorkerId
                name: "Test",
                phone: "010",
                dob: "900101",
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          failed: number;
          errors: Array<{ externalWorkerId: string }>;
        };
      };
      expect(body.data.failed).toBe(1);
      expect(body.data.errors[0].externalWorkerId).toBe("unknown");
    });

    it("sets optional companyName/tradeType to null when not provided", async () => {
      mockAllQueue.push([]); // no existing user (batch lookup)
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            workers: [
              {
                externalWorkerId: "EXT-001",
                name: "Kim",
                phone: "010-1234-5678",
                dob: "900101",
                // no companyName, no tradeType
              },
            ],
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { created: number };
      };
      expect(body.data.created).toBe(1);
    });

    it("returns 401 when auth is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", workers: [] }),
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 for worker role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", workers: [] }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid JSON payload", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when workers array is missing", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /fas/workers/:externalWorkerId ─────────────────────────────
  describe("DELETE /fas/workers/:externalWorkerId", () => {
    it("deletes an existing worker", async () => {
      mockGetQueue.push({ id: "user-1", externalWorkerId: "EXT-001" });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/EXT-001",
        { method: "DELETE" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { deleted: boolean } };
      expect(body.data.deleted).toBe(true);
    });

    it("returns deleted=false when worker not found", async () => {
      mockGetQueue.push(undefined); // user not found

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/fas/workers/NONEXISTENT",
        { method: "DELETE" },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { deleted: boolean; reason: string };
      };
      expect(body.data.deleted).toBe(false);
      expect(body.data.reason).toBe("User not found");
    });

    it("returns 403 for non-admin delete", async () => {
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request(
        "/fas/workers/EXT-001",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /fas/employees", () => {
    it("returns 200 for admin role", async () => {
      mockAllQueue.push([
        {
          id: "u1",
          name: "Kim",
          nameMasked: "K**",
          externalWorkerId: "EXT-1",
        },
      ]);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/fas/employees", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 403 for worker role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER", "worker-1"));
      const res = await app.request("/fas/employees", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 500 when employee query throws", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("db failure");
      });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/fas/employees", {}, env);
      expect(res.status).toBe(500);
    });
  });
});
