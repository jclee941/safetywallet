import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthContext } from "../../../types";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
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

vi.mock("drizzle-orm", async () => {
  const actual =
    await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn(),
    and: vi.fn(),
    desc: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    count: vi.fn(),
  };
});

vi.mock("../../../db/schema", async () => {
  const actual =
    await vi.importActual<typeof import("../../../db/schema")>(
      "../../../db/schema",
    );
  return actual;
});

function makeAuth(role: AuthContext["user"]["role"] = "SUPER_ADMIN") {
  return {
    user: {
      id: "admin-1",
      name: "Admin",
      nameMasked: "Adm**",
      phone: "010-0000-0000",
      role,
    },
    loginDate: "2026-03-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../education");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/", route);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("admin/education completions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thenableIndex = 0;
    thenableResults = [];
    mockDb.select.mockImplementation(() => makeThenableChain());
  });

  it("returns completions list", async () => {
    thenableResults = [
      [
        {
          id: "comp-1",
          contentId: "c-1",
          contentTitle: "안전 교육",
          userName: "홍길동",
          userCompany: "테스트",
          signedAt: "2026-03-01T00:00:00Z",
          signatureData: "data:image/png",
        },
      ],
      [{ count: 1 }],
    ];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/education/completions?siteId=site-1&page=1&limit=10",
      {},
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(1);
  });

  it("applies optional completion filters and handles empty total", async () => {
    thenableResults = [[], []];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/education/completions?siteId=site-1&contentId=content-1&startDate=2026-03-01&endDate=2026-03-31&page=2&limit=5",
      {},
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { items: unknown[]; pagination: { total: number; page: number } };
    };
    expect(body.data.items).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
    expect(body.data.pagination.page).toBe(2);
  });

  it("returns quiz attempts list", async () => {
    thenableResults = [
      [
        {
          id: "attempt-1",
          quizId: "quiz-1",
          userName: "홍길동",
          score: 80,
          passed: true,
          pointsAwarded: 10,
          completedAt: "2026-03-02T00:00:00Z",
        },
      ],
      [{ count: 1 }],
    ];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/education/quiz-attempts?siteId=site-1&quizId=quiz-1&page=1&limit=10",
      {},
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(1);
  });
});
