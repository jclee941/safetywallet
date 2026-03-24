import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------- mocks ----------

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

let shouldTransitionBeValid = true;

vi.mock("drizzle-orm/d1", () => ({
  drizzle: () => ({
    select: () => ({
      from: () => ({
        where: () => {
          const chain = {
            get: mockGet,
            orderBy: () => ({ all: mockAll }),
            orderByWithPagination: () => ({
              limit: () => ({
                offset: () => Promise.resolve(mockAll()),
              }),
            }),
          };
          return chain;
        },
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(mockAll()),
              }),
            }),
          }),
        }),
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({ all: mockAll }),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => ({ get: mockGet }),
        run: mockRun,
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => ({ get: mockGet }),
          run: mockRun,
        }),
      }),
    }),
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../../db/schema", () => ({
  posts: {
    id: "id",
    status: "status",
    reviewStatus: "reviewStatus",
    userId: "userId",
    siteId: "siteId",
  },
  reviews: {
    id: "id",
    postId: "postId",
    reviewerId: "reviewerId",
    adminId: "adminId",
  },
  users: { id: "id", name: "name", nameMasked: "nameMasked" },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  pointsLedger: { id: "id" },
}));

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

vi.mock("../../lib/response", async () => {
  return await vi.importActual<typeof import("../../lib/response")>(
    "../../lib/response",
  );
});

vi.mock("../../lib/state-machine", () => ({
  isValidTransition: vi.fn((..._args: unknown[]) => shouldTransitionBeValid),
  determineNewStatuses: vi.fn(() => ({
    postStatus: "APPROVED",
    reviewStatus: "APPROVED",
  })),
}));

vi.mock("../../lib/audit", () => ({ logAuditWithContext: vi.fn() }));

// zValidator mock: parses JSON body and sets it via Hono's addValidatedData
vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
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
      c.req.addValidatedData("json", body);
      await next();
    };
  },
}));

import reviewsRoute from "../reviews";

// ---------- helpers ----------

interface AuthContext {
  user: {
    id: string;
    name: string;
    nameMasked: string;
    phone: string;
    role: string;
  };
  loginDate: string;
}

function makeAuth(role = "SITE_ADMIN", userId = "user-1"): AuthContext {
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

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

function createApp(auth?: AuthContext) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/reviews", reviewsRoute);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

// ---------- tests ----------

describe("reviews routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockAll.mockReset();
    mockRun.mockReset();
    mockGet.mockResolvedValue(null);
    mockAll.mockResolvedValue([]);
    mockRun.mockResolvedValue({ success: true });
    shouldTransitionBeValid = true;
  });

  describe("POST /reviews", () => {
    const postBody = (data: Record<string, unknown>) => ({
      method: "POST" as const,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    it("returns 400 without required fields", async () => {
      const { app, env } = createApp(makeAuth());
      const res = await app.request("/reviews", postBody({}), env);
      expect(res.status).toBe(400);
    });

    it("returns 401 when auth context is missing", async () => {
      const { app, env } = createApp();
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid action", async () => {
      const { app, env } = createApp(makeAuth());
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "INVALID" }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when post not found", async () => {
      const { app, env } = createApp(makeAuth());
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when not site admin", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "RECEIVED",
        })
        .mockResolvedValueOnce(null); // no membership
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid state transition", async () => {
      shouldTransitionBeValid = false;
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "RECEIVED",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 when post status conflict", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        }) // post
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" }) // membership
        .mockResolvedValueOnce({ id: "r1" }) // insert review
        .mockResolvedValueOnce(null); // update post = conflict
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(409);
    });

    it("creates review successfully", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        }) // post
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" }) // membership
        .mockResolvedValueOnce({ id: "r1", action: "APPROVE", postId: "p1" }) // insert review
        .mockResolvedValueOnce({ id: "p1", status: "APPROVED" }); // update post
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { review: { id: string } } };
      expect(body.data.review.id).toBe("r1");
    });

    it("awards points on APPROVE", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        }) // post
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" }) // membership
        .mockResolvedValueOnce({ id: "r1", action: "APPROVE", postId: "p1" }) // insert review
        .mockResolvedValueOnce({ id: "p1", status: "APPROVED" }); // update post
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: { pointsAwarded: number } };
      expect(body.data.pointsAwarded).toBeGreaterThan(0);
    });

    it("SUPER_ADMIN can review without membership", async () => {
      const { app, env } = createApp(makeAuth("SUPER_ADMIN"));
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        }) // post
        .mockResolvedValueOnce(null) // no membership — SUPER_ADMIN bypasses
        .mockResolvedValueOnce({ id: "r1", action: "APPROVE", postId: "p1" }) // insert
        .mockResolvedValueOnce({ id: "p1", status: "APPROVED" }); // update
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 500 when DB insert fails", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockRejectedValueOnce(new Error("insert failed"));

      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "APPROVE" }),
        env,
      );
      expect(res.status).toBe(500);
    });

    it("creates review with REJECT action", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "r1", action: "REJECT", postId: "p1" })
        .mockResolvedValueOnce({ id: "p1", reviewStatus: "REJECTED" });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "REJECT" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { postStatus: string; pointsAwarded: number };
      };
      expect(body.data.postStatus).toBe("REJECTED");
      expect(body.data.pointsAwarded).toBe(0);
    });

    it("creates review with REQUEST_MORE action", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "r1",
          action: "REQUEST_MORE",
          postId: "p1",
        })
        .mockResolvedValueOnce({ id: "p1", reviewStatus: "NEED_INFO" });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "REQUEST_MORE" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { postStatus: string; pointsAwarded: number };
      };
      expect(body.data.postStatus).toBe("NEED_INFO");
      expect(body.data.pointsAwarded).toBe(0);
    });

    it("creates review with MARK_URGENT action and sets isUrgent", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockResolvedValueOnce({
          id: "r1",
          action: "MARK_URGENT",
          postId: "p1",
        })
        .mockResolvedValueOnce({
          id: "p1",
          reviewStatus: "URGENT",
          isUrgent: true,
        });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "MARK_URGENT" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { postStatus: string; pointsAwarded: number };
      };
      expect(body.data.postStatus).toBe("URGENT");
      expect(body.data.pointsAwarded).toBe(0);
    });

    it("creates review with ASSIGN action", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "PENDING",
          actionStatus: "NONE",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "r1", action: "ASSIGN", postId: "p1" })
        .mockResolvedValueOnce({
          id: "p1",
          reviewStatus: "IN_REVIEW",
          actionStatus: "ASSIGNED",
        });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "ASSIGN" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { postStatus: string; pointsAwarded: number };
      };
      expect(body.data.postStatus).toBe("IN_REVIEW");
      expect(body.data.pointsAwarded).toBe(0);
    });

    it("creates review with CLOSE action from IN_REVIEW", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({
          id: "p1",
          siteId: "s1",
          userId: "u2",
          reviewStatus: "IN_REVIEW",
          actionStatus: "ASSIGNED",
        })
        .mockResolvedValueOnce({ userId: "user-1", role: "SITE_ADMIN" })
        .mockResolvedValueOnce({ id: "r1", action: "CLOSE", postId: "p1" })
        .mockResolvedValueOnce({
          id: "p1",
          reviewStatus: "APPROVED",
          actionStatus: "VERIFIED",
        });
      const res = await app.request(
        "/reviews",
        postBody({ postId: "p1", action: "CLOSE" }),
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { postStatus: string; pointsAwarded: number };
      };
      expect(body.data.postStatus).toBe("APPROVED");
      expect(body.data.pointsAwarded).toBe(0);
    });
  });

  describe("GET /reviews/post/:postId", () => {
    it("returns reviews list", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({ id: "p1", siteId: "s1" }) // post lookup
        .mockResolvedValueOnce({ userId: "user-1" }); // membership
      mockAll.mockResolvedValueOnce([
        { reviews: { id: "r1", action: "APPROVE" }, users: { name: "A" } },
      ]);
      const res = await app.request("/reviews/post/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(1);
    });

    it("returns empty array when no reviews", async () => {
      const { app, env } = createApp(makeAuth());
      mockGet
        .mockResolvedValueOnce({ id: "p1", siteId: "s1" }) // post
        .mockResolvedValueOnce({ userId: "user-1" }); // membership
      mockAll.mockResolvedValueOnce([]);
      const res = await app.request("/reviews/post/p1", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(0);
    });

    it("returns 404 when post not found", async () => {
      const { app, env } = createApp(makeAuth());
      const res = await app.request("/reviews/post/p1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 when not a member", async () => {
      const { app, env } = createApp(makeAuth("WORKER"));
      mockGet
        .mockResolvedValueOnce({ id: "p1", siteId: "s1" }) // post found
        .mockResolvedValueOnce(null); // no membership
      const res = await app.request("/reviews/post/p1", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /reviews", () => {
    it("returns 400 for invalid siteId query", async () => {
      const { app, env } = createApp(makeAuth());
      const res = await app.request("/reviews?siteId=invalid-uuid", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns reviews for valid site query", async () => {
      const { app, env } = createApp(makeAuth());
      mockAll.mockResolvedValueOnce([
        {
          id: "r1",
          postId: "p1",
          action: "APPROVE",
          comment: "ok",
          adminId: "admin-1",
          createdAt: new Date(),
        },
      ]);

      const res = await app.request(
        "/reviews?siteId=00000000-0000-0000-0000-000000000001&limit=10&offset=0",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { reviews: unknown[] } };
      expect(body.data.reviews).toHaveLength(1);
    });
  });
});
