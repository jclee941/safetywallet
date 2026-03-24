import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  analyzeEducationContent,
  generateQuizFromContent,
  analyzeTbmRecord,
  generateTbmMeetingMinutes,
  getAiCredentials,
} from "../../lib/gemini-ai";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

type ZodStrictFlag = {
  __strictZodValidation?: boolean;
};

const globalWithStrictFlag = globalThis as typeof globalThis & ZodStrictFlag;

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
      await next();
    },
  ),
}));

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          raw: Request;
          addValidatedData: (target: string, data: unknown) => void;
          param: () => Record<string, string>;
        };
      },
      next: () => Promise<void>,
    ) => {
      if (_target === "param") {
        const params = c.req.param();
        c.req.addValidatedData("param", params);
      } else {
        const cloned = c.req.raw.clone();
        try {
          const body = await cloned.json();
          if (
            globalWithStrictFlag.__strictZodValidation &&
            typeof _schema === "object" &&
            _schema !== null &&
            "safeParse" in _schema &&
            typeof (_schema as { safeParse?: unknown }).safeParse === "function"
          ) {
            const parser = _schema as {
              safeParse: (data: unknown) => { success: boolean; data: unknown };
            };
            const parsed = parser.safeParse(body);
            if (!parsed.success) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: {
                    code: "VALIDATION_ERROR",
                    message: "Validation failed",
                  },
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }
            c.req.addValidatedData("json", parsed.data);
          } else {
            c.req.addValidatedData("json", body);
          }
        } catch {
          c.req.addValidatedData("json", {});
        }
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
  chain.onConflictDoNothing = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(self);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = mockGet;
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.where = vi.fn(self);
  chain.run = mockRun;
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(undefined);
      }
      return target[prop as string];
    },
  });
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
  sql: Object.assign((..._args: unknown[]) => ({ as: () => "alias" }), {
    raw: vi.fn(),
  }),
}));

vi.mock("../../db/schema", () => ({
  educationContents: {
    id: "id",
    siteId: "siteId",
    title: "title",
    contentType: "contentType",
    isActive: "isActive",
    createdAt: "createdAt",
  },
  quizzes: {
    id: "id",
    siteId: "siteId",
    title: "title",
    status: "status",
    pointsReward: "pointsReward",
    createdAt: "createdAt",
    createdById: "createdById",
  },
  quizQuestions: {
    id: "id",
    quizId: "quizId",
    question: "question",
    options: "options",
    correctAnswer: "correctAnswer",
    orderIndex: "orderIndex",
    questionType: "questionType",
    correctAnswerText: "correctAnswerText",
    explanation: "explanation",
    imageUrl: "imageUrl",
  },
  quizAttempts: {
    id: "id",
    quizId: "quizId",
    userId: "userId",
    passed: "passed",
    completedAt: "completedAt",
  },
  pointPolicies: {
    siteId: "siteId",
    reasonCode: "reasonCode",
    isActive: "isActive",
    defaultAmount: "defaultAmount",
  },
  statutoryTrainings: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    trainingType: "trainingType",
    status: "status",
    createdAt: "createdAt",
  },
  tbmRecords: {
    id: "id",
    siteId: "siteId",
    date: "date",
    topic: "topic",
    leaderId: "leaderId",
    createdAt: "createdAt",
  },
  tbmTopicCategoryEnum: [
    "FALL_PREVENTION",
    "SCAFFOLD_SAFETY",
    "EXCAVATION",
    "CRANE_OPERATION",
    "ELECTRICAL",
    "FIRE_PREVENTION",
    "PPE",
    "CHEMICAL_HANDLING",
    "CONFINED_SPACE",
    "TRAFFIC",
    "WEATHER",
    "GENERAL",
  ],
  tbmAttendees: {
    id: "id",
    tbmRecordId: "tbmRecordId",
    userId: "userId",
    attendedAt: "attendedAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    role: "role",
    status: "status",
  },
  pointsLedger: { id: "id" },
  users: { id: "id", name: "name" },
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
  analyzeEducationContent: vi.fn(async () => null),
  generateQuizFromContent: vi.fn(async () => null),
  analyzeTbmRecord: vi.fn(async () => null),
  generateTbmMeetingMinutes: vi.fn(async () => null),
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

describe("education", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalWithStrictFlag.__strictZodValidation = false;
    mockGet.mockReset();
    mockAll.mockReset();
    mockRun.mockReset();
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
    mockDb.delete.mockImplementation(() => makeDeleteChain());
  });

  describe("POST /contents", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Test" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Test",
            contentType: "VIDEO",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("creates content as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "content-1",
        siteId: "site-1",
        title: "Test",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Test",
            contentType: "VIDEO",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /contents", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns contents for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([{ id: "c1", title: "Test" }]);
      mockGet.mockResolvedValueOnce({ count: 1 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /contents/:id", () => {
    it("returns 404 when content not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns content for SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        title: "Test",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /contents/:id", () => {
    it("returns 404 when content not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", { method: "DELETE" }, env);
      expect(res.status).toBe(404);
    });

    it("soft-deletes content", async () => {
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        title: "Test",
      });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/c1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /quizzes", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Quiz" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates quiz as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "quiz-1",
        siteId: "site-1",
        title: "Quiz",
        status: "DRAFT",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", title: "Quiz" }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /quizzes", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns quizzes for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /quizzes/:id", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes/q1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns quiz with questions", async () => {
      mockGet.mockResolvedValueOnce({
        id: "q1",
        siteId: "site-1",
        title: "Quiz",
      });
      mockAll.mockResolvedValueOnce([{ id: "qq1", question: "Q?" }]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/quizzes/q1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /quizzes/:quizId/questions", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Q?",
            options: ["A", "B"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("creates quiz question", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "qq1",
          question: "Q?",
          questionType: "SINGLE_CHOICE",
          imageUrl: null,
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Q?",
            options: ["A", "B"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("POST /quizzes/:quizId/attempt", () => {
    it("returns 404 when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0, 1] }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when quiz not published", async () => {
      mockGet.mockResolvedValueOnce({
        id: "q1",
        siteId: "site-1",
        status: "DRAFT",
        pointsReward: 10,
      });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("submits quiz attempt and scores", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
        { id: "qq2", correctAnswer: 1, orderIndex: 1 },
      ]);
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ defaultAmount: 20 })
        .mockResolvedValueOnce({
          id: "attempt-1",
          score: 100,
          passed: true,
          pointsAwarded: 20,
        });
      mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0, 1] }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("POST /statutory", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates statutory training as SUPER_ADMIN", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "NEW_WORKER",
            trainingName: "신규 교육",
            trainingDate: "2025-01-15",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /statutory", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/statutory", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns statutory trainings for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/statutory?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /tbm", () => {
    it("returns 400 for missing fields", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates TBM record as SUPER_ADMIN", async () => {
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-1",
        siteId: "site-1",
        topic: "Safety",
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            date: "2025-01-15",
            topic: "Morning Safety",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("GET /tbm", () => {
    it("returns 400 when siteId missing", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns TBM records for SUPER_ADMIN", async () => {
      mockAll.mockResolvedValueOnce([]);
      mockGet.mockResolvedValueOnce({ count: 0 });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm?siteId=site-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /tbm/:id", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/tbm-1", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns TBM with attendees", async () => {
      mockGet.mockResolvedValueOnce({
        record: { id: "tbm-1", siteId: "site-1", topic: "Safety" },
        leaderName: "Kim",
      });
      mockAll.mockResolvedValueOnce([
        { attendee: { id: "a1" }, userName: "Lee" },
      ]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/tbm-1", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("POST /tbm/:tbmId/attend", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("attends TBM successfully", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "att-1",
          tbmRecordId: "tbm-1",
          userId: "user-1",
        });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 400 for duplicate attendance", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "existing" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /tbm/:tbmId/attendees", () => {
    it("returns 404 when TBM not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/tbm/tbm-1/attendees", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns attendees list", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([
        { attendee: { id: "a1" }, userName: "Lee" },
      ]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/tbm/tbm-1/attendees", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /youtube-oembed", () => {
    it("returns 400 when url query is missing", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/youtube-oembed", {}, env);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid youtube url", async () => {
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/youtube-oembed?url=https://example.com/nope",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 502 when youtube responds non-ok", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 500 }));
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/youtube-oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        {},
        env,
      );
      expect(res.status).toBe(502);
      fetchSpy.mockRestore();
    });

    it("returns 502 when youtube fetch throws", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("network error"));
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/youtube-oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        {},
        env,
      );
      expect(res.status).toBe(502);
      fetchSpy.mockRestore();
    });

    it("returns parsed oembed payload", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "video-title",
            author_name: "author",
            html: "<iframe></iframe>",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/youtube-oembed?url=https://youtu.be/dQw4w9WgXcQ",
        {},
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { videoId: string } };
      expect(body.data.videoId).toBe("dQw4w9WgXcQ");
      fetchSpy.mockRestore();
    });
  });

  describe("extended quiz question validation", () => {
    it("rejects invalid questionType", async () => {
      mockGet.mockResolvedValueOnce({ id: "q1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Q?",
            questionType: "INVALID_TYPE",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("validates OX correctAnswer range", async () => {
      mockGet.mockResolvedValueOnce({ id: "q1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "O/X?",
            questionType: "OX",
            correctAnswer: 2,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates OX question", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "qq-ox",
          questionType: "OX",
          imageUrl: null,
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "O/X?",
            questionType: "OX",
            correctAnswer: 1,
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("rejects invalid MULTI_CHOICE answer text", async () => {
      mockGet.mockResolvedValueOnce({ id: "q1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "multi",
            questionType: "MULTI_CHOICE",
            options: ["a", "b"],
            correctAnswerText: "not-json",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects SHORT_ANSWER without correctAnswerText", async () => {
      mockGet.mockResolvedValueOnce({ id: "q1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "short",
            questionType: "SHORT_ANSWER",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("creates IMAGE question with imageUrl", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "qq-img",
          questionType: "IMAGE",
          imageUrl: "/r2/quiz-images/test.jpg",
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "이 사진에서 위험요소를 식별하세요",
            questionType: "IMAGE",
            options: ["추락 위험", "감전 위험", "끼임 위험"],
            correctAnswer: 0,
            imageUrl: "/r2/quiz-images/test.jpg",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { questionType: string; imageUrl: string };
      };
      expect(body.data.questionType).toBe("IMAGE");
      expect(body.data.imageUrl).toBe("/r2/quiz-images/test.jpg");
    });

    it("rejects IMAGE question without imageUrl", async () => {
      mockGet.mockResolvedValueOnce({ id: "q1", siteId: "site-1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "이 사진에서 위험요소를 식별하세요",
            questionType: "IMAGE",
            options: ["추락 위험", "감전 위험", "끼임 위험"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /quizzes/:quizId/questions/:questionId", () => {
    it("returns 404 when question missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions/qq1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("updates question successfully", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "qq1",
          quizId: "q1",
          questionType: "SINGLE_CHOICE",
          options: ["A", "B"],
          correctAnswer: 0,
          correctAnswerText: null,
        })
        .mockResolvedValueOnce({ id: "qq1", question: "updated" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions/qq1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "updated", correctAnswer: 1 }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /quizzes/:quizId/questions/:questionId", () => {
    it("deletes existing question", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "qq1", quizId: "q1" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions/qq1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("additional quiz attempt branches", () => {
    it("returns 400 when quiz has no questions", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 when user already completed", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "existing", passed: true });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("returns 409 when already submitted but failed", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce({ id: "existing", passed: false });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(409);
    });

    it("scores using question-order mapping when answer array is shorter", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ defaultAmount: 20 })
        .mockResolvedValueOnce({
          id: "attempt-short",
          score: 50,
          passed: true,
          pointsAwarded: 20,
        });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
        { id: "qq2", correctAnswer: 1, orderIndex: 1 },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { totalQuestions: number; correctCount: number };
      };
      expect(body.data.totalQuestions).toBe(2);
      expect(body.data.correctCount).toBe(1);
    });

    it("scores question-id map with mismatched IDs as unanswered", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ role: "WORKER" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ defaultAmount: 20 })
        .mockResolvedValueOnce({
          id: "attempt-mismatch",
          score: 0,
          passed: true,
          pointsAwarded: 20,
        });
      mockAll.mockResolvedValueOnce([
        { id: "qq1", correctAnswer: 0, orderIndex: 0 },
        { id: "qq2", correctAnswer: 1, orderIndex: 1 },
      ]);

      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: { wrongQ1: 0, wrongQ2: 1 } }),
        },
        env,
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: { score: number; correctCount: number };
      };
      expect(body.data.score).toBe(0);
      expect(body.data.correctCount).toBe(0);
    });
  });

  describe("GET /quizzes/:quizId/my-attempts", () => {
    it("returns 404 when quiz is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/quizzes/q404/my-attempts", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns attempts for authorized member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce({ role: "WORKER" });
      mockAll.mockResolvedValueOnce([{ id: "attempt-1" }]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/quizzes/q1/my-attempts", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("more statutory/tbm branches", () => {
    it("rejects invalid statutory trainingType", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "u1",
            trainingType: "BAD",
            trainingName: "bad",
            trainingDate: "2025-01-01",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid statutory status", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "u1",
            trainingType: "NEW_WORKER",
            trainingName: "name",
            trainingDate: "2025-01-01",
            status: "BAD",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("rejects TBM create when leader is not active member", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            date: "2025-01-01",
            topic: "topic",
            leaderId: "leader-1",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-member on TBM list", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-member on attendees", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/tbm-1/attendees", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("contents AI and quiz generation branches", () => {
    it("returns 503 when AI is not configured for manual content analysis", async () => {
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        contentType: "TEXT",
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 400 when content type is VIDEO for manual analysis", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          contentType: "VIDEO",
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 500 when manual analysis returns null", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          contentType: "TEXT",
          title: "Safety",
          description: "desc",
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
    });

    it("stores manual AI analysis result", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce({
        score: 95,
      } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          contentType: "TEXT",
          title: "Safety",
          description: "desc",
        })
        .mockResolvedValueOnce(null);
      mockRun.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/analyze",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns 400 when quiz generation has no AI analysis", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          title: "Safety",
          aiAnalysis: null,
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/generate-quiz",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 503 when quiz generation AI is unavailable", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          title: "Safety",
          aiAnalysis: '{"ok":true}',
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/generate-quiz",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 201 when quiz is generated from AI analysis", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(generateQuizFromContent).mockResolvedValueOnce({
        quizTitle: "AI Quiz",
        questions: [
          {
            question: "Q1",
            options: ["A", "B"],
            correctAnswer: 0,
            explanation: "because",
            questionType: "SINGLE_CHOICE",
          },
        ],
      } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          title: "Safety",
          aiAnalysis: '{"ok":true}',
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "quiz-1", siteId: "site-1" });
      mockAll.mockResolvedValueOnce([{ id: "qq-1", quizId: "quiz-1" }]);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/generate-quiz",
        { method: "POST" },
        env,
      );

      expect(res.status).toBe(201);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("tbm AI and maintenance branches", () => {
    it("returns 404 for PUT /tbm/:id when record is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/missing",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 503 for POST /tbm/:id/analyze without AI config", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/t1/analyze", { method: "POST" }, env);
      expect(res.status).toBe(503);
    });

    it("returns 500 for POST /tbm/:id/analyze when AI fails", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce({
        id: "t1",
        siteId: "site-1",
        topic: "topic",
        content: "content",
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/t1/analyze", { method: "POST" }, env);
      expect(res.status).toBe(500);
    });

    it("analyzes TBM successfully", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeTbmRecord).mockResolvedValueOnce({
        risk: "high",
      } as never);
      mockGet.mockResolvedValueOnce({
        id: "t1",
        siteId: "site-1",
        topic: "topic",
        content: "content",
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/t1/analyze", { method: "POST" }, env);
      expect(res.status).toBe(200);
    });

    it("returns 503 for POST /tbm/:id/generate-minutes without AI config", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/t1/generate-minutes",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(503);
    });

    it("returns 500 for POST /tbm/:id/generate-minutes when AI fails", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce({
        record: {
          id: "t1",
          siteId: "site-1",
          topic: "topic",
          content: "content",
          date: 1735689600,
        },
        leaderName: "Kim",
        attendeeCount: 2,
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/t1/generate-minutes",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
    });

    it("generates TBM meeting minutes", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(generateTbmMeetingMinutes).mockResolvedValueOnce({
        summary: "minutes",
      } as never);
      mockGet.mockResolvedValueOnce({
        record: {
          id: "t1",
          siteId: "site-1",
          topic: "topic",
          content: "content",
          date: 1735689600,
        },
        leaderName: "Kim",
        attendeeCount: 2,
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/t1/generate-minutes",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("education auth branch", () => {
    it("returns 401 when auth context is missing", async () => {
      const { app, env } = await createApp();
      const res = await app.request("/contents?siteId=site-1", {}, env);
      expect(res.status).toBe(401);
    });
  });

  describe("statutory additional branches", () => {
    it("returns 403 for GET /statutory/:id when worker is not site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/statutory/st-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 404 for PUT /statutory/:id when record is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory/missing",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingName: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for PUT /statutory/:id with invalid trainingType", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingType: "BAD_TYPE" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("updates statutory training", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "st-1", trainingName: "Updated" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingName: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 403 for DELETE /statutory/:id when worker is not site admin", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "st-1",
          siteId: "site-1",
          userId: "u1",
          trainingType: "REGULAR",
        })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/statutory/st-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("deletes statutory training", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "st-1",
          siteId: "site-1",
          userId: "u1",
          trainingType: "REGULAR",
        })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("contents additional branches", () => {
    it("returns 400 for invalid contentType", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Bad",
            contentType: "BAD_TYPE",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for GET /contents/:id/ai-analysis when content is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/contents/missing/ai-analysis", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 for GET /contents/:id/ai-analysis when non-member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", aiAnalysis: null })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents/c1/ai-analysis", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns parsed AI analysis", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          aiAnalysis: '{"risk":"high"}',
          aiAnalyzedAt: "2026-03-20T00:00:00.000Z",
        })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents/c1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 404 for POST /contents/:id/generate-quiz when content missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/missing/generate-quiz",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for POST /contents/:id/generate-quiz when worker is not admin", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          title: "Safety",
          aiAnalysis: '{"ok":true}',
        })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/contents/c1/generate-quiz",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 500 for POST /contents/:id/generate-quiz when AI generation fails", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce({
        id: "c1",
        siteId: "site-1",
        title: "Safety",
        aiAnalysis: '{"ok":true}',
      });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1/generate-quiz",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(500);
    });
  });

  describe("quizzes additional branches", () => {
    it("returns 400 for invalid quiz status on create", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Quiz",
            status: "BAD_STATUS",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for create quiz when contentId is invalid", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Quiz",
            contentId: "content-404",
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid status filter on GET /quizzes", async () => {
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes?siteId=site-1&status=BAD",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for PATCH /quizzes/:id when worker is not admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1", title: "Quiz" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for DELETE /quizzes/:quizId/questions/:questionId when question missing", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions/missing",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("tbm additional branches", () => {
    it("returns 403 for POST /tbm when worker is not site admin", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            date: "2025-01-01",
            topic: "Safety",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for PUT /tbm/:id when update affects no row", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/tbm/t1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for GET /tbm/:id/ai-analysis when non-member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/t1/ai-analysis", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 404 for POST /tbm/:id/generate-minutes when TBM is missing", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/missing/generate-minutes",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for POST /tbm/:id/generate-minutes when worker is not admin", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet
        .mockResolvedValueOnce({
          record: {
            id: "t1",
            siteId: "site-1",
            topic: "topic",
            content: "content",
            date: 1735689600,
          },
          leaderName: "Kim",
          attendeeCount: 2,
        })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm/t1/generate-minutes",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns parsed meeting minutes", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "t1",
          siteId: "site-1",
          aiMeetingMinutes: '{"summary":"done"}',
          aiMinutesGeneratedAt: "2026-03-20T00:00:00.000Z",
        })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/t1/meeting-minutes", {}, env);
      expect(res.status).toBe(200);
    });
  });

  describe("contents patch/list additional branches", () => {
    it("returns 403 for PATCH /contents/:id when worker is not admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/contents/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for PATCH /contents/:id when content is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/missing",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for PATCH /contents/:id when update returns no row", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/contents/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for PATCH /contents/:id with empty body", async () => {
      globalWithStrictFlag.__strictZodValidation = true;
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );

      expect(res.status).toBe(400);
      globalWithStrictFlag.__strictZodValidation = false;
    });

    it("returns 403 for GET /contents when worker is not site member", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns empty AI analysis payload when content has no analysis", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", aiAnalysis: null })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents/c1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { analysis: unknown; analyzedAt: unknown };
      };
      expect(body.data.analysis).toBeNull();
      expect(body.data.analyzedAt).toBeNull();
    });

    it("returns 404 for POST /contents/:id/analyze when content is missing", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/missing/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for POST /contents/:id/analyze when worker is not admin", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "site-1",
          contentType: "TEXT",
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/contents/c1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("quizzes metadata/delete additional branches", () => {
    it("returns 404 for PATCH /quizzes/:id when quiz is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/missing",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for PATCH /quizzes/:id when contentId references another site", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "content-1", siteId: "site-2" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/quizzes/q1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentId: "content-1" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for PATCH /quizzes/:id when update affects no row", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/quizzes/q1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for DELETE /quizzes/:id when worker is not admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1", title: "Quiz" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/quizzes/q1", { method: "DELETE" }, env);
      expect(res.status).toBe(403);
    });

    it("deletes quiz and questions for admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1", title: "Quiz" })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/quizzes/q1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });
  });

  describe("tbm delete/manual analysis additional branches", () => {
    it("returns 404 for DELETE /tbm/:id when record is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/tbm/missing", { method: "DELETE" }, env);
      expect(res.status).toBe(404);
    });

    it("returns 403 for DELETE /tbm/:id when worker is not admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1", topic: "topic" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/t1", { method: "DELETE" }, env);
      expect(res.status).toBe(403);
    });

    it("deletes TBM and attendees for admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1", topic: "topic" })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/tbm/t1", { method: "DELETE" }, env);
      expect(res.status).toBe(200);
    });

    it("returns 404 for POST /tbm/:id/analyze when TBM is missing", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm/missing/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 for GET /tbm/:id/meeting-minutes when non-member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/t1/meeting-minutes", {}, env);
      expect(res.status).toBe(403);
    });
  });

  describe("statutory additional branches 2", () => {
    it("returns 400 for POST /statutory when target is not an active site member", async () => {
      mockGet.mockResolvedValueOnce({ id: "m1" }).mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "NEW_WORKER",
            trainingName: "신규 교육",
            trainingDate: "2025-01-15",
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for GET /statutory/:id when record is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request("/statutory/missing", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns 400 for PUT /statutory/:id with invalid status", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "BAD" }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for DELETE /statutory/:id when record is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/missing",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("coverage-focused branch tests", () => {
    it("returns 403 for POST /quizzes/:quizId/attempt when user is not a site member", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0] }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 400 for POST /quizzes/:quizId/attempt when answers are missing", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ id: "m1" });

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("accepts question-id answer map for POST /quizzes/:quizId/attempt", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 0,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "attempt-obj",
          score: 100,
          passed: true,
          pointsAwarded: 0,
        });
      mockAll.mockResolvedValueOnce([
        {
          id: "qq1",
          correctAnswer: 0,
          orderIndex: 0,
          questionType: "SINGLE_CHOICE",
        },
      ]);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: { qq1: 0 } }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("deduplicates POST /quizzes/:quizId/attempt with clientAttemptId", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 10,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "attempt-existing", passed: true });
      mockAll.mockResolvedValueOnce([
        {
          id: "qq1",
          correctAnswer: 0,
          orderIndex: 0,
          questionType: "SINGLE_CHOICE",
        },
      ]);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [0], clientAttemptId: "client-1" }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { deduplicated: boolean } };
      expect(body.data.deduplicated).toBe(true);
    });

    it("returns 403 for GET /quizzes/:quizId/my-attempts when user is not a member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/quizzes/q1/my-attempts", {}, env);
      expect(res.status).toBe(403);
    });

    it("scores zero when indexed answers are missing entries", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "q1",
          siteId: "site-1",
          status: "PUBLISHED",
          pointsReward: 0,
          createdById: "admin-1",
        })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "attempt-empty",
          score: 0,
          passed: true,
          pointsAwarded: 0,
        });
      mockAll.mockResolvedValueOnce([
        {
          id: "qq1",
          correctAnswer: 1,
          orderIndex: 0,
          questionType: "SINGLE_CHOICE",
        },
      ]);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/quizzes/q1/attempt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [] }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("creates content as SITE_ADMIN member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({
          id: "content-1",
          siteId: "site-1",
          title: "Safety",
        });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Site Admin Content",
            contentType: "TEXT",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 for DELETE /contents/:id when worker is not site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", title: "Test" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents/c1", { method: "DELETE" }, env);
      expect(res.status).toBe(403);
    });

    it("creates statutory training as SITE_ADMIN with active target member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ id: "target-membership" })
        .mockResolvedValueOnce({
          id: "st-1",
          siteId: "site-1",
          userId: "worker-1",
        });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "REGULAR",
            trainingName: "정기 교육",
            trainingDate: "2025-01-15",
            status: "COMPLETED",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("returns 403 for GET /statutory when worker is not site admin", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/statutory?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("applies status filter on GET /statutory", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory?siteId=site-1&status=COMPLETED",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("applies trainingType filter on GET /statutory", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory?siteId=site-1&trainingType=REGULAR",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns statutory training detail for authorized site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "admin-membership" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request("/statutory/st-1", {}, env);
      expect(res.status).toBe(200);
    });

    it("returns 403 for PUT /statutory/:id when worker is not site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingName: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("creates TBM with explicit leader when leader is active member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ id: "leader-membership" })
        .mockResolvedValueOnce({
          id: "tbm-1",
          siteId: "site-1",
          topic: "Safety",
        });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            date: "2025-01-15",
            topic: "Morning Safety",
            leaderId: "leader-1",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("updates TBM as site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ id: "tbm-1", topic: "Updated" });

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/tbm/tbm-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 403 for POST /tbm/:tbmId/attend when worker is not a member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm/tbm-1/attend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 for POST /tbm/:id/analyze when worker is not site admin", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "tbm-1",
          siteId: "site-1",
          topic: "topic",
          content: "content",
        })
        .mockResolvedValueOnce(null);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm/tbm-1/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for GET /tbm/:id/ai-analysis when TBM is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/missing/ai-analysis", {}, env);
      expect(res.status).toBe(404);
    });

    it("returns null AI analysis payload for GET /tbm/:id/ai-analysis", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "tbm-1",
          siteId: "site-1",
          aiAnalysis: null,
          aiAnalyzedAt: null,
        })
        .mockResolvedValueOnce({ id: "member-1" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/tbm-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { analysis: unknown; analyzedAt: unknown };
      };
      expect(body.data.analysis).toBeNull();
      expect(body.data.analyzedAt).toBeNull();
    });

    it("returns 404 for GET /tbm/:id/meeting-minutes when TBM is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/missing/meeting-minutes", {}, env);
      expect(res.status).toBe(404);
    });

    it("analyzes DOCUMENT content using R2 payload in manual analyze route", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce({
        score: 90,
      } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c-doc",
          siteId: "site-1",
          contentType: "DOCUMENT",
          contentUrl: "docs/manual.pdf",
          title: "Manual",
          description: "desc",
        })
        .mockResolvedValueOnce({ id: "admin-membership" });
      mockRun.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      env.R2 = {
        get: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
          httpMetadata: { contentType: "application/pdf" },
        }),
      };

      const res = await app.request(
        "/contents/c-doc/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("analyzes IMAGE content using R2 payload in manual analyze route", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce({
        score: 88,
      } as never);
      mockGet
        .mockResolvedValueOnce({
          id: "c-img",
          siteId: "site-1",
          contentType: "IMAGE",
          contentUrl: "images/hazard.jpg",
          title: "Image",
          description: "desc",
        })
        .mockResolvedValueOnce({ id: "admin-membership" });
      mockRun.mockResolvedValueOnce(undefined);

      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      env.R2 = {
        get: vi.fn().mockResolvedValue({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
          httpMetadata: { contentType: "image/jpeg" },
        }),
      };

      const res = await app.request(
        "/contents/c-img/analyze",
        { method: "POST" },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 403 for GET /contents/:id when worker is not site member", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", title: "Test" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/contents/c1", {}, env);
      expect(res.status).toBe(403);
    });

    it("updates content successfully as site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", title: "Before" })
        .mockResolvedValueOnce({ id: "admin-membership" })
        .mockResolvedValueOnce({ id: "c1", siteId: "site-1", title: "After" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/contents/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "After" }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 for GET /statutory with invalid trainingType filter", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory?siteId=site-1&trainingType=BAD",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for GET /statutory with invalid status filter", async () => {
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory?siteId=site-1&status=BAD",
        {},
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 for POST /statutory when worker is not site admin", async () => {
      mockGet.mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "NEW_WORKER",
            trainingName: "신규",
            trainingDate: "2025-01-15",
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it("filters TBM list by valid topic category", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "member-1" })
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);

      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm?siteId=site-1&topicCategory=GENERAL",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 403 for GET /tbm/:id when worker is not a site member", async () => {
      mockGet
        .mockResolvedValueOnce({
          record: { id: "tbm-1", siteId: "site-1", topic: "Safety" },
          leaderName: "Kim",
        })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/tbm-1", {}, env);
      expect(res.status).toBe(403);
    });

    it("returns 403 for PUT /tbm/:id when worker is not site admin", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "tbm-1", siteId: "site-1" })
        .mockResolvedValueOnce(null);
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request(
        "/tbm/tbm-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "Updated" }),
        },
        env,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("contents branch coverage: fire-and-forget, PATCH fields, analyze, includeInactive", () => {
    const r2Obj = (ct?: string) => ({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      httpMetadata: ct !== undefined ? { contentType: ct } : undefined,
    });

    async function fireAndForget(
      mockContentType: string,
      contentUrl: string | null,
      r2: unknown,
      aiResult: unknown,
    ) {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce(
        aiResult as never,
      );
      mockGet.mockResolvedValueOnce({ id: "m1" }).mockResolvedValueOnce({
        id: "c1",
        siteId: "s1",
        title: "T",
        contentType: mockContentType,
        contentUrl,
        description: "d",
      });
      if (aiResult) mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      if (r2 !== undefined) env.R2 = { get: vi.fn().mockResolvedValue(r2) };
      const wp: Promise<unknown>[] = [];
      const bodyType = ["IMAGE", "DOCUMENT", "TEXT"].includes(mockContentType)
        ? mockContentType
        : "IMAGE";
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "s1",
            title: "T",
            contentType: bodyType,
            ...(contentUrl ? { contentUrl } : {}),
          }),
        },
        env,
        {
          waitUntil: (p: Promise<unknown>) => wp.push(p),
          passThroughOnException: vi.fn(),
        } as never,
      );
      await Promise.allSettled(wp);
      return res;
    }

    async function analyzeContent(
      contentType: string,
      contentUrl: string | null,
      r2: unknown,
      aiResult: unknown,
    ) {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce(
        aiResult as never,
      );
      mockGet
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "s1",
          contentType,
          contentUrl,
          title: "T",
          description: "d",
        })
        .mockResolvedValueOnce(null);
      if (aiResult) mockRun.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      if (r2 !== undefined) env.R2 = { get: vi.fn().mockResolvedValue(r2) };
      return app.request("/contents/c1/analyze", { method: "POST" }, env);
    }

    // --- POST /contents fire-and-forget AI analysis ---

    it("ff: IMAGE + R2 obj + httpMetadata + AI result triggers update", async () => {
      const res = await fireAndForget(
        "IMAGE",
        "img/t.jpg",
        r2Obj("image/png"),
        { score: 95 },
      );
      expect(res.status).toBe(201);
      expect(analyzeEducationContent).toHaveBeenCalled();
    });

    it("ff: IMAGE + R2 obj without httpMetadata + AI null skips update", async () => {
      const res = await fireAndForget("IMAGE", "img/t.jpg", r2Obj(), null);
      expect(res.status).toBe(201);
    });

    it("ff: IMAGE + R2 returns null obj", async () => {
      const res = await fireAndForget("IMAGE", "img/t.jpg", null, null);
      expect(res.status).toBe(201);
    });

    it("ff: DOCUMENT + R2 obj + httpMetadata + AI result", async () => {
      const res = await fireAndForget(
        "DOCUMENT",
        "docs/t.pdf",
        r2Obj("application/pdf"),
        { score: 90 },
      );
      expect(res.status).toBe(201);
      expect(analyzeEducationContent).toHaveBeenCalled();
    });

    it("ff: DOCUMENT + R2 returns null obj", async () => {
      const res = await fireAndForget("DOCUMENT", "docs/t.pdf", null, null);
      expect(res.status).toBe(201);
    });

    it("ff: DOCUMENT + R2 obj without httpMetadata uses pdf fallback", async () => {
      const res = await fireAndForget("DOCUMENT", "docs/t.pdf", r2Obj(), null);
      expect(res.status).toBe(201);
    });

    it("ff: TEXT content uses title+description as textContent", async () => {
      const res = await fireAndForget("TEXT", null, undefined, { score: 80 });
      expect(res.status).toBe(201);
      expect(analyzeEducationContent).toHaveBeenCalled();
    });

    it("ff: unknown contentType in mock falls through all branches", async () => {
      const res = await fireAndForget("AUDIO", null, undefined, null);
      expect(res.status).toBe(201);
    });

    it("ff: returns 201 when executionCtx.waitUntil throws", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({ key: "x" } as never);
      vi.mocked(analyzeEducationContent).mockResolvedValueOnce({
        score: 77,
      } as never);
      mockGet.mockResolvedValueOnce({ id: "m1" }).mockResolvedValueOnce({
        id: "c1",
        siteId: "s1",
        title: "T",
        contentType: "TEXT",
        contentUrl: null,
        description: "d",
      });

      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "s1",
            title: "T",
            contentType: "TEXT",
          }),
        },
        env,
        {
          waitUntil: () => {
            throw new Error("waitUntil not available");
          },
          passThroughOnException: vi.fn(),
        } as never,
      );

      expect(res.status).toBe(201);
    });

    // --- GET /contents includeInactive ---

    it("GET /contents with includeInactive=true uses siteId-only filter", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ count: 1 });
      mockAll.mockResolvedValueOnce([{ id: "c1", title: "Content" }]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents?siteId=s1&includeInactive=true",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    // --- PATCH /contents with all optional fields ---

    it("PATCH /contents/:id sends all optional spread fields", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "c1", siteId: "s1", title: "Old" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({
          id: "c1",
          siteId: "s1",
          title: "New",
          description: "desc",
          contentType: "DOCUMENT",
          contentUrl: "/url",
          thumbnailUrl: "/thumb.jpg",
          durationMinutes: 30,
          externalSource: "YOUTUBE",
          externalId: "yt-1",
          sourceUrl: "https://example.com",
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/contents/c1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New",
            description: "desc",
            contentType: "DOCUMENT",
            contentUrl: "/url",
            thumbnailUrl: "/thumb.jpg",
            durationMinutes: 30,
            externalSource: "YOUTUBE",
            externalId: "yt-1",
            sourceUrl: "https://example.com",
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    // --- POST /contents/:id/analyze edge cases ---

    it("analyze: IMAGE + R2 returns null obj", async () => {
      const res = await analyzeContent("IMAGE", "img/t.jpg", null, {
        score: 90,
      });
      expect(res.status).toBe(200);
    });

    it("analyze: IMAGE + R2 obj without httpMetadata uses jpeg fallback", async () => {
      const res = await analyzeContent("IMAGE", "img/t.jpg", r2Obj(), {
        score: 90,
      });
      expect(res.status).toBe(200);
    });

    it("analyze: DOCUMENT + R2 returns null obj", async () => {
      const res = await analyzeContent("DOCUMENT", "docs/t.pdf", null, {
        score: 90,
      });
      expect(res.status).toBe(200);
    });

    it("analyze: DOCUMENT + R2 obj without httpMetadata uses pdf fallback", async () => {
      const res = await analyzeContent("DOCUMENT", "docs/t.pdf", r2Obj(), {
        score: 90,
      });
      expect(res.status).toBe(200);
    });

    it("analyze: IMAGE with null contentUrl falls through all R2 branches", async () => {
      const res = await analyzeContent("IMAGE", null, undefined, {
        score: 90,
      });
      expect(res.status).toBe(200);
    });
  });

  describe("remaining branch coverage tests", () => {
    it("returns 404 for POST /quizzes when contentId belongs to different site", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: "c1", siteId: "other-site" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            title: "Quiz",
            contentId: "c1",
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("applies valid status filter on GET /quizzes", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes?siteId=site-1&status=PUBLISHED",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("updates quiz with all optional fields", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: "q1", title: "Updated" });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Updated",
            description: "New desc",
            status: "PUBLISHED",
            pointsReward: 20,
            timeLimitMinutes: 30,
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 400 for POST /quizzes/:quizId/questions without question field", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            options: ["A", "B"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for PUT /quizzes/:quizId/questions/:questionId when quiz is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/missing/questions/qq1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "updated" }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 for PUT /quizzes/:quizId/questions/:questionId with invalid correctAnswer", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: "qq1",
          quizId: "q1",
          questionType: "SINGLE_CHOICE",
          options: ["A", "B"],
          correctAnswer: 0,
          correctAnswerText: null,
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/q1/questions/qq1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correctAnswer: 99 }),
        },
        env,
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 for DELETE /quizzes/:quizId/questions/:questionId when quiz is missing", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/quizzes/missing/questions/qq1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
    });

    it("POST /tbm with AI fire-and-forget analyzes and generates minutes", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        key: "x",
      } as never);
      vi.mocked(analyzeTbmRecord).mockResolvedValueOnce({
        riskLevel: "high",
      } as never);
      vi.mocked(generateTbmMeetingMinutes).mockResolvedValueOnce({
        summary: "Meeting notes",
      } as never);
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-new",
        siteId: "site-1",
        topic: "Safety topic",
        content: "Discussion",
        date: 1719792000,
        weatherCondition: null,
        specialNotes: null,
      });
      const wp: Promise<unknown>[] = [];
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            topic: "Safety topic",
            content: "Discussion",
            date: "2025-06-30",
          }),
        },
        env,
        {
          waitUntil: (p: Promise<unknown>) => wp.push(p),
          passThroughOnException: vi.fn(),
        } as never,
      );
      await Promise.allSettled(wp);
      expect(res.status).toBe(201);
      expect(analyzeTbmRecord).toHaveBeenCalled();
      expect(generateTbmMeetingMinutes).toHaveBeenCalled();
    });

    it("POST /tbm AI fire-and-forget skips update when analysis returns null", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        key: "x",
      } as never);
      vi.mocked(analyzeTbmRecord).mockResolvedValueOnce(null as never);
      vi.mocked(generateTbmMeetingMinutes).mockResolvedValueOnce(null as never);
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-new",
        siteId: "site-1",
        topic: "Safety",
        content: "Content",
        date: 1719792000,
      });
      const wp: Promise<unknown>[] = [];
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            topic: "Safety",
            content: "Content",
            date: "2025-06-30",
          }),
        },
        env,
        {
          waitUntil: (p: Promise<unknown>) => wp.push(p),
          passThroughOnException: vi.fn(),
        } as never,
      );
      await Promise.allSettled(wp);
      expect(res.status).toBe(201);
    });

    it("POST /tbm AI fire-and-forget catches analysis and minutes errors", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        key: "x",
      } as never);
      vi.mocked(analyzeTbmRecord).mockRejectedValueOnce(new Error("AI fail"));
      vi.mocked(generateTbmMeetingMinutes).mockRejectedValueOnce(
        "string error",
      );
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-new",
        siteId: "site-1",
        topic: "Safety",
        content: "Content",
        date: 1719792000,
      });
      const wp: Promise<unknown>[] = [];
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            topic: "Safety",
            content: "Content",
            date: "2025-06-30",
          }),
        },
        env,
        {
          waitUntil: (p: Promise<unknown>) => wp.push(p),
          passThroughOnException: vi.fn(),
        } as never,
      );
      await Promise.allSettled(wp);
      expect(res.status).toBe(201);
    });

    it("applies topicCategory filter on GET /tbm", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm?siteId=site-1&topicCategory=FALL_PREVENTION",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("updates TBM with all optional spread fields", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "t1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "t1", topic: "Updated" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/tbm/t1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: "2025-06-01",
            topic: "Updated topic",
            topicCategory: "PPE",
            content: "New content",
            weatherCondition: "Sunny",
            specialNotes: "Note",
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns parsed AI analysis for GET /tbm/:id/ai-analysis", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "tbm-1",
          siteId: "site-1",
          aiAnalysis: '{"riskLevel":"high","score":90}',
          aiAnalyzedAt: "2025-01-01T00:00:00Z",
        })
        .mockResolvedValueOnce({ id: "member-1" });
      const { app, env } = await createApp(makeAuth("WORKER"));
      const res = await app.request("/tbm/tbm-1/ai-analysis", {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          analysis: { riskLevel: string; score: number };
          analyzedAt: string;
        };
      };
      expect(body.data.analysis).toEqual({ riskLevel: "high", score: 90 });
      expect(body.data.analyzedAt).toBe("2025-01-01T00:00:00Z");
    });

    it("creates statutory training with expirationDate", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: "target-m" })
        .mockResolvedValueOnce({
          id: "st-new",
          siteId: "site-1",
          userId: "worker-1",
          expirationDate: 1768435200,
        });
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            userId: "worker-1",
            trainingType: "NEW_WORKER",
            trainingName: "신규 교육",
            trainingDate: "2025-01-15",
            expirationDate: "2026-01-15",
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    });

    it("applies userId filter on GET /statutory", async () => {
      mockGet
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/statutory?siteId=site-1&userId=worker-1",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("updates statutory training with all optional fields including expirationDate", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "st-1", trainingName: "Updated" });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainingType: "REGULAR",
            trainingName: "Updated Training",
            trainingDate: "2025-06-01",
            expirationDate: "2026-06-01",
            provider: "Provider Co",
            certificateUrl: "https://cert.url",
            hoursCompleted: 8,
            status: "COMPLETED",
            notes: "Done",
          }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("updates statutory training with expirationDate set to null", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "st-1", siteId: "site-1" })
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ id: "st-1", expirationDate: null });
      const { app, env } = await createApp(makeAuth("SITE_ADMIN"));
      const res = await app.request(
        "/statutory/st-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expirationDate: null }),
        },
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 for DELETE /quizzes/:id when quiz not found", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/missing-quiz",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("QUIZ_NOT_FOUND");
    });

    it("returns 403 for POST /quizzes/:quizId/questions when WORKER has no admin membership", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/questions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: "Test?",
            options: ["A", "B", "C", "D"],
            correctAnswer: 0,
          }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("SITE_ADMIN_REQUIRED");
    });

    it("returns 403 for PUT /quizzes/:quizId/questions/:questionId when WORKER has no admin membership", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/questions/qn-1",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "Updated?" }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("SITE_ADMIN_REQUIRED");
    });

    it("returns 403 for DELETE /quizzes/:quizId/questions/:questionId when WORKER has no admin membership", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes/q1/questions/qn-1",
        { method: "DELETE" },
        env,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("SITE_ADMIN_REQUIRED");
    });

    it("applies date filter on GET /tbm", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "m1" })
        .mockResolvedValueOnce({ count: 0 });
      mockAll.mockResolvedValueOnce([]);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/tbm?siteId=site-1&date=2025-06-01",
        {},
        env,
      );
      expect(res.status).toBe(200);
    });

    it("returns 403 for POST /quizzes when WORKER has no admin membership", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request(
        "/quizzes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: "site-1", title: "Quiz" }),
        },
        env,
      );
      expect(res.status).toBe(403);
      const b1 = (await res.json()) as { error: { code: string } };
      expect(b1.error.code).toBe("SITE_ADMIN_REQUIRED");
    });

    it("returns 403 for GET /quizzes when WORKER has no site membership", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/quizzes?siteId=site-1", {}, env);
      expect(res.status).toBe(403);
      const b2 = (await res.json()) as { error: { code: string } };
      expect(b2.error.code).toBe("NOT_SITE_MEMBER");
    });

    it("returns 403 for GET /quizzes/:id when WORKER has no site membership", async () => {
      mockGet
        .mockResolvedValueOnce({ id: "q1", siteId: "site-1" })
        .mockResolvedValueOnce(undefined);
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/quizzes/q1", {}, env);
      expect(res.status).toBe(403);
      const b3 = (await res.json()) as { error: { code: string } };
      expect(b3.error.code).toBe("NOT_SITE_MEMBER");
    });

    it("POST /tbm AI fire-and-forget with reversed error types covers remaining ternary branches", async () => {
      vi.mocked(getAiCredentials).mockReturnValueOnce({
        key: "x",
      } as never);
      vi.mocked(analyzeTbmRecord).mockRejectedValueOnce("non-Error string");
      vi.mocked(generateTbmMeetingMinutes).mockRejectedValueOnce(
        new Error("minutes fail"),
      );
      mockGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        id: "tbm-rev",
        siteId: "site-1",
        topic: "Reversed",
        content: "Content",
        date: 1719792000,
      });
      const wp: Promise<unknown>[] = [];
      const { app, env } = await createApp(makeAuth("SUPER_ADMIN"));
      const res = await app.request(
        "/tbm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: "site-1",
            topic: "Reversed",
            content: "Content",
            date: "2025-06-30",
          }),
        },
        env,
        {
          waitUntil: (p: Promise<unknown>) => wp.push(p),
          passThroughOnException: vi.fn(),
        } as never,
      );
      await Promise.allSettled(wp);
      expect(res.status).toBe(201);
    });

    it("returns meeting-minutes with null when aiMeetingMinutes is null", async () => {
      mockGet
        .mockResolvedValueOnce({
          id: "t1",
          siteId: "site-1",
          aiMeetingMinutes: null,
          aiMinutesGeneratedAt: null,
        })
        .mockResolvedValueOnce({ id: "m1" });
      const { app, env } = await createApp(makeAuth());
      const res = await app.request("/tbm/t1/meeting-minutes", {}, env);
      expect(res.status).toBe(200);
      const b4 = (await res.json()) as {
        data: { minutes: unknown; generatedAt: unknown };
      };
      expect(b4.data.minutes).toBeNull();
      expect(b4.data.generatedAt).toBeNull();
    });
  });
});
