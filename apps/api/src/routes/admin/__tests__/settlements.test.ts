import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

type AppEnv = {
  Bindings: Record<string, unknown>;
  Variables: { auth: { user: { id: string; role: string } } };
};

vi.mock("../helpers", () => ({
  requireManagerOrAdmin: vi.fn(
    async (
      c: {
        get: (key: string) => { user?: { role?: string } } | undefined | null;
        json: (body: unknown, status?: number) => Response;
      },
      next: () => Promise<void>,
    ) => {
      const auth = c.get("auth");
      const role = auth?.user?.role;
      if (!role) {
        return c.json(
          {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Unauthorized" },
          },
          401,
        );
      }
      if (role !== "SITE_ADMIN" && role !== "SUPER_ADMIN") {
        return c.json(
          {
            success: false,
            error: { code: "FORBIDDEN", message: "Forbidden" },
          },
          403,
        );
      }
      return next();
    },
  ),
  formatYearMonth: vi.fn(() => "2026-02"),
}));

vi.mock("../../../lib/auth.ts", () => ({}));

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
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.get = vi.fn(() => dequeueGet());
  chain.all = vi.fn(() => dequeueAll());
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeSelectChain()),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("../../../db/schema", () => ({
  pointsLedger: {
    amount: "amount",
    userId: "userId",
    siteId: "siteId",
    settleMonth: "settleMonth",
    createdAt: "createdAt",
  },
  disputes: {
    id: "id",
    siteId: "siteId",
    userId: "userId",
    type: "type",
    status: "status",
    title: "title",
    description: "description",
    createdAt: "createdAt",
  },
  users: { id: "id", nameMasked: "nameMasked" },
}));

async function createApp(
  kvGet = vi.fn(),
  kvPut = vi.fn(),
  auth: { user: { id: string; role: string } } | null = {
    user: { id: "admin-1", role: "SITE_ADMIN" },
  },
) {
  const { default: settlementsRoute } = await import("../settlements");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (auth) {
      c.set("auth", auth);
    }
    await next();
  });
  app.route("/admin", settlementsRoute);

  const env = {
    DB: {},
    KV: { get: kvGet, put: kvPut },
  } as Record<string, unknown>;
  return { app, env };
}

describe("routes/admin/settlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.length = 0;
    mockAllQueue.length = 0;
  });

  it("returns settlement status", async () => {
    mockGetQueue.push({ totalPoints: 123, userCount: 4 });
    mockGetQueue.push({ disputeCount: 2 });
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: { totalPoints: number; userCount: number; disputeCount: number };
    };
    expect(body.data.totalPoints).toBe(123);
    expect(body.data.userCount).toBe(4);
    expect(body.data.disputeCount).toBe(2);
  });

  it("returns finalizedAt when finalized payload JSON is valid", async () => {
    mockGetQueue.push({ totalPoints: 11, userCount: 2 });
    mockGetQueue.push({ disputeCount: 1 });
    const kvGet = vi
      .fn()
      .mockResolvedValue('{"finalizedAt":"2026-02-28T12:00:00.000Z"}');
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { finalized: boolean; finalizedAt: string | null };
    };
    expect(body.data.finalized).toBe(true);
    expect(body.data.finalizedAt).toBe("2026-02-28T12:00:00.000Z");
  });

  it("returns 401 when auth is missing", async () => {
    const { app, env } = await createApp(vi.fn(), vi.fn(), null);
    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not manager/admin", async () => {
    const { app, env } = await createApp(vi.fn(), vi.fn(), {
      user: { id: "worker-1", role: "WORKER" },
    });
    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid status query", async () => {
    const { app, env } = await createApp();
    const res = await app.request(
      "/admin/settlements/status?month=2026-2",
      {},
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns finalized true with invalid finalized JSON", async () => {
    mockGetQueue.push({ totalPoints: 10, userCount: 1 });
    mockGetQueue.push({ disputeCount: 0 });
    const kvGet = vi.fn().mockResolvedValue("not-json");
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { finalized: boolean; finalizedAt: string | null };
    };
    expect(body.data.finalized).toBe(true);
    expect(body.data.finalizedAt).toBeNull();
  });

  it("creates settlement snapshot", async () => {
    mockAllQueue.push([
      { userId: "u1", totalAmount: 50 },
      { userId: "u2", totalAmount: 30 },
    ]);
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const { app, env } = await createApp(kvGet, kvPut);

    const res = await app.request(
      "/admin/settlements/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalPoints: number } };
    expect(body.data.totalPoints).toBe(80);
    expect(kvPut).toHaveBeenCalledTimes(1);
  });

  it("creates settlement snapshot filtered by siteId", async () => {
    mockAllQueue.push([{ userId: "u1", totalAmount: 40 }]);
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const { app, env } = await createApp(kvGet, kvPut);

    const res = await app.request(
      "/admin/settlements/snapshot?siteId=site-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalPoints: number } };
    expect(body.data.totalPoints).toBe(40);
  });

  it("returns 409 when snapshot target month is already finalized", async () => {
    const kvGet = vi
      .fn()
      .mockResolvedValue('{"finalizedAt":"2026-02-28T10:00:00.000Z"}');
    const { app, env } = await createApp(kvGet, vi.fn());

    const res = await app.request(
      "/admin/settlements/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02" }),
      },
      env,
    );

    expect(res.status).toBe(409);
  });

  it("finalizes settlement month", async () => {
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const { app, env } = await createApp(kvGet, kvPut);

    const res = await app.request(
      "/admin/settlements/finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02", confirm: true }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(kvPut).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when finalize confirm is false", async () => {
    const { app, env } = await createApp();
    const res = await app.request(
      "/admin/settlements/finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02", confirm: false }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when finalize target month is already finalized", async () => {
    const kvGet = vi
      .fn()
      .mockResolvedValue('{"finalizedAt":"2026-02-28T10:00:00.000Z"}');
    const { app, env } = await createApp(kvGet, vi.fn());
    const res = await app.request(
      "/admin/settlements/finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02", confirm: true }),
      },
      env,
    );
    expect(res.status).toBe(409);
  });

  it("returns 503 when finalize KV read fails", async () => {
    const kvGet = vi.fn().mockRejectedValue(new Error("kv down"));
    const { app, env } = await createApp(kvGet, vi.fn());
    const res = await app.request(
      "/admin/settlements/finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02", confirm: true }),
      },
      env,
    );
    expect(res.status).toBe(503);
  });

  it("returns 503 when finalize KV write fails", async () => {
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvPut = vi.fn().mockRejectedValue(new Error("kv write down"));
    const { app, env } = await createApp(kvGet, kvPut);
    const res = await app.request(
      "/admin/settlements/finalize",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02", confirm: true }),
      },
      env,
    );
    expect(res.status).toBe(503);
  });

  it("returns settlement history", async () => {
    mockAllQueue.push([
      { month: "2026-02", totalPoints: 100, userCount: 3 },
      { month: "2026-01", totalPoints: 120, userCount: 4 },
    ]);
    const kvGet = vi
      .fn()
      .mockResolvedValueOnce('{"finalizedAt":"2026-02-28T15:00:00.000Z"}')
      .mockResolvedValueOnce(null);
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/history?page=1&limit=20",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { history: Array<{ month: string }> };
    };
    expect(body.data.history).toHaveLength(2);
  });

  it("treats malformed finalized JSON as null in history", async () => {
    mockAllQueue.push([{ month: "2026-02", totalPoints: 100, userCount: 3 }]);
    const kvGet = vi.fn().mockResolvedValueOnce("not-json");
    const { app, env } = await createApp(kvGet);

    const res = await app.request("/admin/settlements/history", {}, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: { history: Array<{ finalizedAt: string | null }> };
    };
    expect(body.data.history[0]?.finalizedAt).toBeNull();
  });

  it("lists settlement disputes", async () => {
    mockAllQueue.push([
      {
        id: "d1",
        siteId: "s1",
        userId: "u1",
        type: "POINT_DISPUTE",
        status: "OPEN",
        title: "Point dispute",
        description: "Details",
        createdAt: new Date(),
        userName: "Kim",
      },
    ]);
    const { app, env } = await createApp();

    const res = await app.request(
      "/admin/settlements/disputes?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { disputes: unknown[] } };
    expect(body.data.disputes).toHaveLength(1);
  });

  it("returns 400 for invalid disputes month", async () => {
    const { app, env } = await createApp();
    const res = await app.request(
      "/admin/settlements/disputes?month=2026-2",
      {},
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when DB throws in settlements status", async () => {
    mockDb.select.mockImplementationOnce(() => {
      throw new Error("db failure");
    });
    const { app, env } = await createApp();
    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(500);
  });

  it("filters by siteId in status query", async () => {
    mockGetQueue.push({ totalPoints: 50, userCount: 2 });
    mockGetQueue.push({ disputeCount: 1 });
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02&siteId=site-1",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { totalPoints: number; finalized: boolean };
    };
    expect(body.data.totalPoints).toBe(50);
    expect(body.data.finalized).toBe(false);
  });

  it("treats KV.get rejection as not finalized in status", async () => {
    mockGetQueue.push({ totalPoints: 10, userCount: 1 });
    mockGetQueue.push({ disputeCount: 0 });
    const kvGet = vi.fn().mockRejectedValue(new Error("kv down"));
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { finalized: boolean; finalizedAt: string | null };
    };
    expect(body.data.finalized).toBe(false);
    expect(body.data.finalizedAt).toBeNull();
  });

  it("continues snapshot when KV.get throws", async () => {
    mockAllQueue.push([{ userId: "u1", totalAmount: 40 }]);
    const kvGet = vi.fn().mockRejectedValue(new Error("kv read error"));
    const kvPut = vi.fn().mockResolvedValue(undefined);
    const { app, env } = await createApp(kvGet, kvPut);

    const res = await app.request(
      "/admin/settlements/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalPoints: number } };
    expect(body.data.totalPoints).toBe(40);
  });

  it("returns success when KV.put throws in snapshot", async () => {
    mockAllQueue.push([{ userId: "u1", totalAmount: 25 }]);
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvPut = vi.fn().mockRejectedValue(new Error("kv write error"));
    const { app, env } = await createApp(kvGet, kvPut);

    const res = await app.request(
      "/admin/settlements/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: "2026-02" }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { created: boolean } };
    expect(body.data.created).toBe(true);
  });

  it("filters by siteId in history query", async () => {
    mockAllQueue.push([{ month: "2026-02", totalPoints: 80, userCount: 2 }]);
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/history?siteId=site-1",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { history: Array<{ month: string }> };
    };
    expect(body.data.history).toHaveLength(1);
  });

  it("treats KV.get rejection as null finalizedAt in history", async () => {
    mockAllQueue.push([{ month: "2026-02", totalPoints: 60, userCount: 3 }]);
    const kvGet = vi.fn().mockRejectedValue(new Error("kv down"));
    const { app, env } = await createApp(kvGet);

    const res = await app.request("/admin/settlements/history", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { history: Array<{ finalizedAt: string | null }> };
    };
    expect(body.data.history[0]?.finalizedAt).toBeNull();
  });

  it("falls back to zero when ledger and dispute summaries are undefined", async () => {
    const kvGet = vi.fn().mockResolvedValue(null);
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        totalPoints: number;
        userCount: number;
        disputeCount: number;
        finalized: boolean;
      };
    };
    expect(body.data.totalPoints).toBe(0);
    expect(body.data.userCount).toBe(0);
    expect(body.data.disputeCount).toBe(0);
    expect(body.data.finalized).toBe(false);
  });

  it("returns null finalizedAt when KV value is valid JSON without finalizedAt field", async () => {
    mockGetQueue.push({ totalPoints: 20, userCount: 1 });
    mockGetQueue.push({ disputeCount: 0 });
    const kvGet = vi.fn().mockResolvedValue('{"other":"value"}');
    const { app, env } = await createApp(kvGet);

    const res = await app.request(
      "/admin/settlements/status?month=2026-02",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { finalized: boolean; finalizedAt: string | null };
    };
    expect(body.data.finalized).toBe(true);
    expect(body.data.finalizedAt).toBeNull();
  });

  it("returns null finalizedAt in history when KV value is valid JSON without finalizedAt field", async () => {
    mockAllQueue.push([{ month: "2026-02", totalPoints: 50, userCount: 2 }]);
    const kvGet = vi.fn().mockResolvedValueOnce('{"other":"value"}');
    const { app, env } = await createApp(kvGet);

    const res = await app.request("/admin/settlements/history", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { history: Array<{ finalizedAt: string | null }> };
    };
    expect(body.data.history[0]?.finalizedAt).toBeNull();
  });

  it("filters by siteId in disputes query", async () => {
    mockAllQueue.push([]);
    const { app, env } = await createApp();

    const res = await app.request(
      "/admin/settlements/disputes?month=2026-02&siteId=site-1",
      {},
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { disputes: unknown[] } };
    expect(body.data.disputes).toHaveLength(0);
  });
});
