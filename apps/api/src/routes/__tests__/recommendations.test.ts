import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { attendanceMiddleware } from "../../middleware/attendance";

// Mock authMiddleware to bypass JWT verification
vi.mock("../../middleware/auth", () => ({
  authMiddleware: async (
    c: { get: (k: string) => unknown },
    next: () => Promise<void>,
  ) => {
    await next();
  },
}));

// Mock attendanceMiddleware to a no-op
vi.mock("../../middleware/attendance", () => ({
  attendanceMiddleware: vi.fn(async () => {}),
}));

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

function makeAuth(userId = "user-1", role = "WORKER"): AuthContext {
  return {
    user: {
      id: userId,
      name: "Test User",
      nameMasked: "Te**",
      phone: "010-0000-0000",
      role: role as AuthContext["user"]["role"],
    },
    loginDate: "2025-01-01",
  };
}

function createMockD1(
  rawQueue: Array<unknown[][] | null> = [],
  allQueue: Array<{ results: unknown[] }> = [],
) {
  const rawQ = [...rawQueue];
  const allQ = [...allQueue];
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      raw: vi.fn(async () => rawQ.shift() ?? []),
      first: vi.fn(async () => null),
      all: vi.fn(async () => allQ.shift() ?? { results: [] }),
      run: vi.fn().mockResolvedValue({ results: [], success: true }),
    })),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn(),
    dump: vi.fn(),
  };
}

describe("recommendations route", () => {
  let recommendationsRoute: typeof import("../recommendations").default;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../recommendations");
    recommendationsRoute = mod.default;
  });

  function createApp(
    auth: AuthContext | null,
    mockDb: ReturnType<typeof createMockD1>,
  ) {
    const app = new Hono<AppEnv>();

    app.use("*", async (c, next) => {
      if (auth) c.set("auth", auth);
      await next();
    });

    app.route("/recommendations", recommendationsRoute);

    const env = { DB: mockDb } as unknown as Env;
    return { app, env };
  }

  // ---------- GET /today ----------

  describe("GET /", () => {
    it("returns 400 when siteId is missing", async () => {
      const db = createMockD1();
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations",
        {},
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MISSING_PARAMS");
    });

    it("returns recommendation list with capped limit and offset", async () => {
      const db = createMockD1([
        [
          [
            "rec-1",
            "site-1",
            "user-1",
            "Kim",
            "electrician",
            "great worker",
            "2025-01-01",
            null,
            null,
          ],
        ],
      ]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations?siteId=site-1&limit=999&offset=3",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { recommendations: unknown[]; limit: number; offset: number };
      };
      expect(body.data.recommendations).toHaveLength(1);
      expect(body.data.limit).toBe(100);
      expect(body.data.offset).toBe(3);
    });
  });

  describe("GET /today", () => {
    it("returns 400 when siteId is missing", async () => {
      const db = createMockD1();
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations/today",
        {},
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("MISSING_SITE_ID");
    });

    it("returns hasRecommendedToday=false when no existing", async () => {
      const db = createMockD1([[]]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations/today?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasRecommendedToday: boolean; recommendation: unknown };
      };
      expect(body.data.hasRecommendedToday).toBe(false);
      expect(body.data.recommendation).toBeNull();
    });

    it("returns hasRecommendedToday=true when existing", async () => {
      // raw() returns one row — columns match recommendations table select *
      const db = createMockD1([
        [
          [
            "rec-1",
            "site-1",
            "user-1",
            "Kim",
            "electrician",
            "reason",
            "2025-01-01",
            null,
            null,
          ],
        ],
      ]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations/today?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { hasRecommendedToday: boolean };
      };
      expect(body.data.hasRecommendedToday).toBe(true);
    });
  });

  // ---------- GET /my ----------

  describe("GET /my", () => {
    it("returns 400 when siteId is missing", async () => {
      const db = createMockD1();
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations/my",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns recommendation history", async () => {
      const db = createMockD1(
        [],
        [
          {
            results: [
              { id: "rec-1", siteId: "site-1", recommenderId: "user-1" },
              { id: "rec-2", siteId: "site-1", recommenderId: "user-1" },
            ],
          },
        ],
      );
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations/my?siteId=site-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toBeDefined();
    });
  });

  // ---------- POST / ----------

  describe("POST /", () => {
    const validBody = {
      siteId: "site-1",
      recommendedName: "김철수",
      tradeType: "전기",
      reason: "안전 모범",
    };

    it("returns 403 when no site membership", async () => {
      // First raw() = membership check — empty = not found
      const db = createMockD1([[]]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 409 when already recommended today", async () => {
      // First raw() = membership found, second raw() = existing recommendation found
      const db = createMockD1([
        [["mem-1", "user-1", "site-1", "WORKER", "ACTIVE", null, null]],
        [
          [
            "rec-1",
            "site-1",
            "user-1",
            "Kim",
            "elec",
            "reason",
            "2025-01-01",
            null,
            null,
          ],
        ],
      ]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("creates recommendation successfully", async () => {
      // First raw() = membership found, second raw() = no existing, third raw() = insert returning
      const db = createMockD1([
        [["mem-1", "user-1", "site-1", "WORKER", "ACTIVE", null, null]],
        [],
        [
          [
            "rec-new",
            "site-1",
            "user-1",
            "김철수",
            "전기",
            "안전 모범",
            "2025-01-01",
            null,
            null,
          ],
        ],
      ]);
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
        env,
      );
      expect(res.status).toBe(201);
      expect(attendanceMiddleware).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function),
        "site-1",
      );
    });

    it("returns 400 for invalid body (missing fields)", async () => {
      const db = createMockD1();
      const { app, env } = createApp(makeAuth(), db);

      const res = await app.request(
        "http://localhost/recommendations",
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
});
