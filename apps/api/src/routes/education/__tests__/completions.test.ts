import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthContext } from "../../../types";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: AuthContext };
};

const mockLoggerWarn = vi.fn();

vi.mock("../../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: (...a: unknown[]) => mockLoggerWarn(...a),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

let selectResults: unknown[] = [];
let insertResult: unknown = undefined;
let updateResult: unknown = undefined;

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

function makeSelectChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.leftJoin = vi.fn(self);
  chain.get = vi.fn(() => selectResults.shift());
  return chain;
}

function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.values = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = vi.fn(() => insertResult);
  return chain;
}

function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  const self = (): Record<string, unknown> => chain;
  chain.set = vi.fn(self);
  chain.where = vi.fn(self);
  chain.returning = vi.fn(self);
  chain.get = vi.fn(() => updateResult);
  return chain;
}

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
  };
});

vi.mock("../../../db/schema", async () => {
  const actual =
    await vi.importActual<typeof import("../../../db/schema")>(
      "../../../db/schema",
    );
  return actual;
});

interface MakeAuthArgs {
  role?: AuthContext["user"]["role"];
}

function makeAuth({ role = "WORKER" }: MakeAuthArgs = {}): AuthContext {
  return {
    user: {
      id: "user-1",
      phone: "010-1234-5678",
      role,
      name: "Worker",
      nameMasked: "W****",
    },
    loginDate: "2026-03-01",
  };
}

async function createApp(auth?: AuthContext) {
  const { default: route } = await import("../completions");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    await next();
  });
  app.route("/completions", route);
  const env = { DB: {} } as Record<string, unknown>;
  return { app, env };
}

describe("education/completions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    insertResult = undefined;
    updateResult = undefined;
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockDb.insert.mockImplementation(() => makeInsertChain());
    mockDb.update.mockImplementation(() => makeUpdateChain());
  });

  it("returns 404 when content is missing", async () => {
    selectResults = [undefined];
    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "missing",
          signature: "data:image/png;base64,sig",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("creates completion with signature", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" }, // content lookup
      { id: "membership-1" }, // membership
      undefined, // existing completion
    ];
    insertResult = { id: "comp-1", signatureData: "data:image/png" };

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "c-1",
          signature: "data:image/png;base64,sig",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { completion: unknown } };
    expect(body.data.completion).toBeTruthy();
  });

  it("returns 403 when worker is not a site member", async () => {
    selectResults = [{ id: "c-1", siteId: "site-1" }, undefined];

    const { app, env } = await createApp(makeAuth({ role: "WORKER" }));
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "c-1",
          signature: "data:image/png;base64,signature",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(403);
  });

  it("updates an existing completion record", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" },
      { id: "membership-1" },
      { id: "comp-1", contentId: "c-1", userId: "user-1" },
    ];
    updateResult = {
      id: "comp-1",
      contentId: "c-1",
      userId: "user-1",
      signatureData: "data:image/png;base64,updated",
    };

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "c-1",
          signature: "data:image/png;base64,updated",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { completion: { id: string } } };
    expect(body.data.completion.id).toBe("comp-1");
  });

  it("returns completion details for GET /:contentId/me", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" },
      { id: "membership-1" },
      {
        id: "comp-1",
        signedAt: "2026-03-01T00:00:00.000Z",
        signatureData: "data:image/png;base64,sig",
      },
    ];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request("/completions/c-1/me", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { completion: { id: string; signatureData: string } };
    };
    expect(body.data.completion.id).toBe("comp-1");
  });

  it("returns null completion for GET /:contentId/me when none exists", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" },
      { id: "membership-1" },
      undefined,
    ];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request("/completions/c-1/me", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { completion: unknown } };
    expect(body.data.completion).toBeNull();
  });

  it("returns 404 for GET /:contentId/me when content does not exist", async () => {
    selectResults = [undefined];

    const { app, env } = await createApp(makeAuth());
    const res = await app.request("/completions/missing/me", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 403 for GET /:contentId/me when worker is not a member", async () => {
    selectResults = [{ id: "c-1", siteId: "site-1" }, undefined];

    const { app, env } = await createApp(makeAuth({ role: "WORKER" }));
    const res = await app.request("/completions/c-1/me", {}, env);

    expect(res.status).toBe(403);
  });

  it("auto-awards EDUCATION_COMPLETION points when policy exists", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" },
      { id: "membership-1" },
      undefined,
      { defaultAmount: 10, name: "Education Points" },
    ];
    insertResult = { id: "comp-1", signatureData: "data:image/png" };

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "c-1",
          signature: "data:image/png;base64,sig",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("catches and warns when auto-award points insert fails", async () => {
    selectResults = [
      { id: "c-1", siteId: "site-1" },
      { id: "membership-1" },
      undefined,
      { defaultAmount: 10, name: "Education Points" },
    ];
    insertResult = { id: "comp-1", signatureData: "data:image/png" };
    mockDb.insert
      .mockImplementationOnce(() => makeInsertChain())
      .mockImplementationOnce(() => ({
        values: vi.fn(() => {
          throw new Error("points insert failed");
        }),
      }));

    const { app, env } = await createApp(makeAuth());
    const res = await app.request(
      "/completions",
      {
        method: "POST",
        body: JSON.stringify({
          contentId: "c-1",
          signature: "data:image/png;base64,sig",
        }),
        headers: { "Content-Type": "application/json" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Failed to auto-award EDUCATION_COMPLETION points",
      expect.objectContaining({
        error: { name: "Error", message: "points insert failed" },
      }),
    );
  });
});
