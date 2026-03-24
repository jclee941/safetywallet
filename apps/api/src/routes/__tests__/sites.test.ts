import { Hono } from "hono";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock auth middleware
vi.mock("../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

// Mock audit
vi.mock("../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

import sitesRoute from "../sites";
import type { Env, AuthContext } from "../../types";

const mockGetQueue: unknown[] = [];
const mockAllQueue: unknown[] = [];
const mockInsertGetQueue: unknown[] = [];

function dequeueGet() {
  return mockGetQueue.length > 0 ? mockGetQueue.shift() : null;
}

function dequeueAll() {
  return mockAllQueue.length > 0 ? mockAllQueue.shift() : [];
}

function dequeueInsertGet() {
  return mockInsertGetQueue.length > 0 ? mockInsertGetQueue.shift() : null;
}

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  return chain;
}

const mockInsertValues = vi.fn(() => ({
  returning: vi.fn(() => ({
    get: vi.fn(() => dequeueInsertGet()),
  })),
}));
const mockUpdateRun = vi.fn().mockResolvedValue({ success: true });

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        run: mockUpdateRun,
        returning: vi.fn(() => ({
          get: vi.fn(() => dequeueGet()),
        })),
      })),
    })),
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

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

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function createApp(auth: AuthContext | null) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/sites", sitesRoute);

  const env = {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        raw: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ results: [] }),
      })),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn(),
      dump: vi.fn(),
    },
  } as unknown as Env;

  return { app, env };
}

describe("sites route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockInsertGetQueue.length = 0;
  });

  // ---------- GET / ----------

  describe("GET /", () => {
    it("returns 200 for ADMIN with empty site list", async () => {
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("http://localhost/sites", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 200 for WORKER with empty membership list", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request("http://localhost/sites", {}, env);
      expect(res.status).toBe(200);
    });
  });

  // ---------- GET /:id ----------

  describe("GET /:id", () => {
    it("returns 404 when site not found", async () => {
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("http://localhost/sites/site-1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 when worker is not a site member", async () => {
      mockGetQueue.push({ id: "site-1", name: "A" });
      mockGetQueue.push(null);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request("http://localhost/sites/site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns site details with memberCount for member", async () => {
      mockGetQueue.push({ id: "site-1", name: "A", active: true });
      mockGetQueue.push({ id: "m-1", role: "WORKER", status: "ACTIVE" });
      mockGetQueue.push({ count: 7 });
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request("http://localhost/sites/site-1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { site: { memberCount: number } };
      };
      expect(body.data.site.memberCount).toBe(7);
    });
  });

  describe("GET /:id/members", () => {
    it("returns 403 when requester is not member and not admin", async () => {
      mockGetQueue.push(null);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members",
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when worker membership tries to view members", async () => {
      mockGetQueue.push({ role: "WORKER", status: "ACTIVE" });
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members",
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns members list for site admin membership", async () => {
      mockGetQueue.push({ role: "SITE_ADMIN", status: "ACTIVE" });
      mockAllQueue.push([
        {
          id: "mem-1",
          role: "WORKER",
          status: "ACTIVE",
          user: { id: "u1", name: "K**" },
        },
      ]);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members?limit=10&offset=1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { data: unknown[] } };
      expect(body.data.data).toHaveLength(1);
    });
  });

  describe("GET /:id/members/:memberId", () => {
    it("returns 404 when member does not exist", async () => {
      mockGetQueue.push({ role: "SITE_ADMIN", status: "ACTIVE" });
      mockGetQueue.push(null);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members/member-1",
        {},
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns member detail when found", async () => {
      mockGetQueue.push({ role: "SITE_ADMIN", status: "ACTIVE" });
      mockGetQueue.push({
        id: "member-1",
        role: "WORKER",
        status: "ACTIVE",
        user: { id: "u1", name: "K**" },
      });
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members/member-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  // ---------- POST / ----------

  describe("POST /", () => {
    it("returns 403 for non-ADMIN creating a site", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Site" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("creates site for SITE_ADMIN", async () => {
      mockInsertGetQueue.push({
        id: "site-1",
        name: "Test Site",
        active: true,
      });
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "http://localhost/sites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test Site" }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  // ---------- PATCH /:id ----------

  describe("PATCH /:id", () => {
    it("returns 403 for WORKER updating site", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("updates site when user is SITE_ADMIN membership", async () => {
      mockGetQueue.push({
        id: "membership-1",
        role: "SITE_ADMIN",
        status: "ACTIVE",
      });
      mockGetQueue.push({ id: "site-1", name: "Updated", active: true });
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Updated",
            active: true,
            leaderboardEnabled: false,
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 when update target does not exist", async () => {
      mockGetQueue.push({
        id: "membership-1",
        role: "SITE_ADMIN",
        status: "ACTIVE",
      });
      mockGetQueue.push(null);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-404",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });
  });

  // ---------- GET /:id/members/:memberId ----------

  describe("GET /:id/members/:memberId", () => {
    it("returns 403 when WORKER has no membership on the site", async () => {
      // No membership found → first get returns null
      mockGetQueue.push(null);
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members/member-1",
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when WORKER membership exists but role is WORKER", async () => {
      // Membership found with WORKER role
      mockGetQueue.push({
        id: "membership-1",
        userId: "user-1",
        siteId: "site-1",
        role: "WORKER",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/members/member-1",
        {},
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain("Not authorized to view members");
    });
  });

  // ---------- POST /:id/leave ----------

  describe("POST /:id/leave", () => {
    it("returns 404 when membership not found", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when SITE_ADMIN tries to leave", async () => {
      mockGetQueue.push({
        id: "membership-1",
        role: "SITE_ADMIN",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("SITE_ADMIN"));

      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "handover" }),
        },
        env,
      );

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("ADMIN_CANNOT_LEAVE");
    });

    it("allows WORKER to leave active membership", async () => {
      mockGetQueue.push({
        id: "membership-2",
        role: "WORKER",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("WORKER"));

      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "transferred" }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { message: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.message).toContain("탈퇴");
      expect(mockUpdateRun).toHaveBeenCalled();
    });

    it("allows leave without reason and writes default audit reason", async () => {
      mockGetQueue.push({
        id: "membership-3",
        role: "WORKER",
        status: "ACTIVE",
      });
      const { app, env } = createApp(makeAuth("WORKER"));

      const res = await app.request(
        "http://localhost/sites/site-1/leave",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );

      expect(res.status).toBe(200);
    });
  });
});
