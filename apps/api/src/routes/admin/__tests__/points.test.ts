import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: { user: { id: string; role: string } } };
};

vi.mock("@hono/zod-validator", () => ({
  zValidator: (_target: string, _schema: unknown) => {
    return async (
      c: {
        req: {
          raw: Request;
          addValidatedData: (target: string, data: unknown) => void;
        };
      },
      next: () => Promise<void>,
    ) => {
      const cloned = c.req.raw.clone();
      try {
        const body = await cloned.json();
        c.req.addValidatedData("json", body);
      } catch {
        c.req.addValidatedData("json", {});
      }
      await next();
    };
  },
}));

vi.mock("../../../lib/audit", () => ({
  logAuditWithContext: vi.fn(),
}));

const mockEnqueueNotification = vi.fn();
vi.mock("../../../lib/notification-queue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
vi.mock("../../../lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  })),
}));

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
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  return chain;
}

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("../../../db/schema", () => ({
  pointsLedger: {
    id: "id",
    userId: "userId",
    siteId: "siteId",
    postId: "postId",
    refLedgerId: "refLedgerId",
    amount: "amount",
    reasonCode: "reasonCode",
    reasonText: "reasonText",
    adminId: "adminId",
    settleMonth: "settleMonth",
    occurredAt: "occurredAt",
    createdAt: "createdAt",
  },
  siteMemberships: {
    userId: "userId",
    siteId: "siteId",
    status: "status",
    role: "role",
  },
  pushSubscriptions: {
    id: "id",
    userId: "userId",
    endpoint: "endpoint",
    p256dh: "p256dh",
    auth: "auth",
    failCount: "failCount",
  },
}));

const ORIGINAL = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  siteId: "33333333-3333-3333-3333-333333333333",
  postId: "44444444-4444-4444-4444-444444444444",
  amount: 10,
  settleMonth: "2026-02",
};

const ACTIVE_MEMBERSHIP = {
  userId: "admin-1",
  siteId: ORIGINAL.siteId,
  status: "ACTIVE",
  role: "SITE_ADMIN",
};

function enqueueGets(...items: unknown[]) {
  mockGetQueue.push(...items);
}

function enqueueAll(...items: unknown[]) {
  mockAllQueue.push(...items);
}

async function createApp(role = "SITE_ADMIN", kvGet = vi.fn()) {
  const { default: pointsRoute } = await import("../points");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { user: { id: "admin-1", role } });
    await next();
  });
  app.route("/", pointsRoute);

  const env = {
    DB: {},
    KV: { get: kvGet },
    NOTIFICATION_QUEUE: undefined,
  } as Record<string, unknown>;

  return { app, env };
}

describe("routes/admin/points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
    mockDb.select.mockImplementation(() => makeSelectChain());
    mockInsertValues.mockImplementation(() => ({
      returning: mockInsertReturning,
    }));
    mockInsertReturning.mockResolvedValue([{ id: "corr-ledger-1" }]);
  });

  it("returns 200 for REVOKE happy path", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp("SITE_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Admin revoke",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: -ORIGINAL.amount,
        reasonCode: "REVOCATION",
      }),
    );
    const body = (await res.json()) as { data: { correctedAmount: number } };
    expect(body.data.correctedAmount).toBe(-10);
  });

  it("returns 200 for CORRECTION with delta amount", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp("SITE_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Adjust amount",
          correctionType: "CORRECTION",
          correctedAmount: 7,
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ amount: -3, reasonCode: "CORRECTION" }),
    );
    const body = (await res.json()) as { data: { correctedAmount: number } };
    expect(body.data.correctedAmount).toBe(-3);
  });

  it("returns 400 for CORRECTION without correctedAmount", async () => {
    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Missing amount",
          correctionType: "CORRECTION",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns 400 for CORRECTION with negative correctedAmount", async () => {
    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Negative amount",
          correctionType: "CORRECTION",
          correctedAmount: -1,
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns 404 when original ledger is missing", async () => {
    enqueueGets(null);
    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "No ledger",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when already corrected", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, { id: "existing-correction" });
    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Duplicate",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(409);
  });

  it("returns 409 when settlement is finalized", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    const kvGet = vi.fn().mockResolvedValue("1");
    const { app, env } = await createApp("SITE_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Finalized month",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(409);
  });

  it("returns 503 when settlement KV read fails", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    const kvGet = vi.fn().mockRejectedValue(new Error("KV unavailable"));
    const { app, env } = await createApp("SITE_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "KV fail",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(503);
  });

  it("returns 403 when site admin is scoped to a different site", async () => {
    enqueueGets(ORIGINAL, null);
    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Wrong site",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(403);
  });

  it("returns 200 for SUPER_ADMIN even without site membership", async () => {
    enqueueGets(ORIGINAL, null, null);
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp("SUPER_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Super admin override",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
  });

  it("enqueues notification when subscriptions exist", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    enqueueAll([
      {
        id: "sub-1",
        userId: ORIGINAL.userId,
        endpoint: "https://push.example/1",
        p256dh: "p256dh",
        auth: "auth",
        failCount: 0,
      },
    ]);

    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );
    env.NOTIFICATION_QUEUE = { send: vi.fn() };

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Notify worker",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
  });

  it("covers postId ?? undefined when original has no postId", async () => {
    const noPostOriginal = { ...ORIGINAL, postId: null };
    enqueueGets(noPostOriginal, ACTIVE_MEMBERSHIP, null);
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp("SITE_ADMIN", kvGet);

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "No postId",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
  });

  it("logs non-Error notification failure", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    enqueueAll([
      {
        id: "sub-1",
        userId: ORIGINAL.userId,
        endpoint: "https://push.example/1",
        p256dh: "p256dh",
        auth: "auth",
        failCount: 0,
      },
    ]);
    mockEnqueueNotification.mockRejectedValueOnce("string-error");

    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );
    env.NOTIFICATION_QUEUE = { send: vi.fn() };

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "String error",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        error: expect.objectContaining({
          name: "UnknownError",
          message: "string-error",
        }),
      }),
    );
  });

  it("returns 200 even when notification enqueue fails", async () => {
    enqueueGets(ORIGINAL, ACTIVE_MEMBERSHIP, null);
    enqueueAll([
      {
        id: "sub-1",
        userId: ORIGINAL.userId,
        endpoint: "https://push.example/1",
        p256dh: "p256dh",
        auth: "auth",
        failCount: 0,
      },
    ]);
    mockEnqueueNotification.mockRejectedValueOnce(new Error("queue failure"));

    const { app, env } = await createApp(
      "SITE_ADMIN",
      vi.fn().mockResolvedValue(null),
    );
    env.NOTIFICATION_QUEUE = { send: vi.fn() };

    const res = await app.request(
      "/points/correct",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledgerId: ORIGINAL.id,
          reason: "Queue fail",
          correctionType: "REVOKE",
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
