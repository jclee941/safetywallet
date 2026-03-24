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

vi.mock("../../../lib/auth.ts", () => ({}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          json: () => Promise<unknown>;
          valid: (t: string) => unknown;
          query: (k: string) => string | undefined;
          addValidatedData: (target: string, data: unknown) => void;
        };
        json: (body: unknown, status?: number) => Response;
      },
      next: () => Promise<void>,
    ) => {
      const parseWithSchema = (
        input: unknown,
      ): { success: boolean; data?: unknown } => {
        const candidate = _schema as {
          safeParse?: (value: unknown) => { success: boolean; data?: unknown };
        };
        if (candidate && typeof candidate.safeParse === "function") {
          return candidate.safeParse(input);
        }
        return { success: true, data: input };
      };

      if (_target === "query") {
        const url = new URL((c as unknown as { req: { url: string } }).req.url);
        const params: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          params[k] = v;
        });
        const parsed = parseWithSchema(params);
        if (!parsed.success) {
          return c.json(
            { success: false, error: { code: "VALIDATION_ERROR" } },
            400,
          );
        }
        c.req.addValidatedData("query", parsed.data ?? params);
      } else {
        const body = await c.req.json();
        const parsed = parseWithSchema(body);
        if (!parsed.success) {
          return c.json(
            { success: false, error: { code: "VALIDATION_ERROR" } },
            400,
          );
        }
        c.req.addValidatedData("json", parsed.data ?? body);
      }
      await next();
    };
  },
}));

let thenableResults: unknown[] = [];
let thenableIndex = 0;

function makeThenableChain(): Record<string, unknown> {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        const result = thenableResults[thenableIndex] ?? [];
        thenableIndex++;
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

const mockDb = {
  select: vi.fn(() => makeThenableChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  recommendations: {
    id: "id",
    siteId: "siteId",
    recommenderId: "recommenderId",
    recommendedName: "recommendedName",
    tradeType: "tradeType",
    reason: "reason",
    recommendationDate: "recommendationDate",
    createdAt: "createdAt",
  },
  users: { id: "id", name: "name", companyName: "companyName" },
  sites: { id: "id", name: "name" },
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

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../recommendations");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thenableIndex = 0;
    thenableResults = [];
    mockDb.select.mockImplementation(() => makeThenableChain());
  });

  describe("GET /recommendations", () => {
    it("returns recommendations with pagination", async () => {
      thenableResults = [
        [{ id: "r-1", recommendedName: "Kim" }],
        [{ count: 1 }],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=1&limit=20",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { items: unknown[] } };
      expect(body.data.items).toHaveLength(1);
    });

    it("returns 403 for WORKER role", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/recommendations?page=1&limit=20",
        {},
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid pagination query", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=0&limit=20",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid sort query", async () => {
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=1&limit=20&sort=INVALID",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 500 when DB list query fails", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("db failure");
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=1&limit=20",
        {},
        env,
      );
      expect(res.status).toBe(500);
    });

    it("returns 200 and empty pagination when count row is missing", async () => {
      thenableResults = [[{ id: "r-1", recommendedName: "Kim" }], []];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=1&limit=20&sort=RECOMMENDED_NAME_ASC",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { pagination: { total: number; totalPages: number } };
      };
      expect(body.data.pagination.total).toBe(0);
      expect(body.data.pagination.totalPages).toBe(0);
    });

    it("applies optional date filters for list endpoint", async () => {
      thenableResults = [[], [{ count: 0 }]];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations?page=1&limit=20&startDate=2025-01-01&endDate=2025-01-31",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { pagination: { total: number } };
      };
      expect(body.data.pagination.total).toBe(0);
    });
  });

  describe("GET /recommendations/stats", () => {
    it("returns stats", async () => {
      thenableResults = [
        [{ count: 5 }],
        [{ recommendedName: "Kim", tradeType: "철근", count: 3 }],
        [{ date: "2025-01-01", count: 2 }],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { totalRecommendations: number };
      };
      expect(body.data.totalRecommendations).toBe(5);
    });

    it("returns 200 with zero total when count row is missing", async () => {
      thenableResults = [[], [], []];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/stats", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { totalRecommendations: number };
      };
      expect(body.data.totalRecommendations).toBe(0);
    });

    it("returns 500 when stats query fails", async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error("stats query failure");
      });

      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/stats", {}, env);
      expect(res.status).toBe(500);
    });

    it("applies optional stats filters and returns success", async () => {
      thenableResults = [[{ count: 2 }], [], []];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations/stats?siteId=s1&startDate=2025-01-01&endDate=2025-01-31",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { totalRecommendations: number };
      };
      expect(body.data.totalRecommendations).toBe(2);
    });
  });

  describe("GET /recommendations/export", () => {
    it("returns CSV file", async () => {
      thenableResults = [
        [
          {
            recommendationDate: "2025-01-01",
            recommenderName: "Park",
            recommenderCompany: "ABC",
            recommendedName: "Kim",
            tradeType: "철근",
            reason: "안전 우수",
            siteName: "Severance",
          },
        ],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/export", {}, env);
      expect(res.status).toBe(200);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/csv");
    });

    it("fills optional fields as empty strings in CSV", async () => {
      thenableResults = [
        [
          {
            recommendationDate: "2025-01-01",
            recommenderName: null,
            recommenderCompany: null,
            recommendedName: "Kim",
            tradeType: "철근",
            reason: "안전 우수",
            siteName: null,
          },
        ],
      ];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/export", {}, env);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("2025-01-01,,,");
    });

    it("returns header-only CSV when export rows are empty", async () => {
      thenableResults = [[]];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/recommendations/export", {}, env);

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("추천일,추천자,소속,피추천자,공종,추천 사유,현장");
    });

    it("applies optional export filters and returns CSV", async () => {
      thenableResults = [[]];
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/recommendations/export?siteId=s1&startDate=2025-01-01&endDate=2025-01-31",
        {},
        env,
      );

      expect(res.status).toBe(200);
      const contentType = res.headers.get("Content-Type") || "";
      expect(contentType).toContain("text/csv");
    });
  });
});
