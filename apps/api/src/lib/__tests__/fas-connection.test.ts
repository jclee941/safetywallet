import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HyperdriveBinding } from "../../types";

const { createConnectionMock, loggerMock } = vi.hoisted(() => ({
  createConnectionMock: vi.fn(),
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: createConnectionMock,
  },
}));

vi.mock("../logger", () => ({
  createLogger: vi.fn(() => loggerMock),
}));

const hyperdrive: HyperdriveBinding = {
  connectionString: "mysql://user:pass@localhost:3306/mdidev",
  host: "localhost",
  port: 3306,
  user: "user",
  password: "pass",
  database: "mdidev",
};

function makeConnection(options?: {
  pingReject?: boolean;
  endReject?: boolean;
  queryDelayMs?: number;
}) {
  return {
    ping: options?.pingReject
      ? vi.fn().mockRejectedValue(new Error("ping failed"))
      : vi.fn().mockResolvedValue(undefined),
    end: options?.endReject
      ? vi.fn().mockRejectedValue(new Error("end failed"))
      : vi.fn().mockResolvedValue(undefined),
    query:
      options?.queryDelayMs !== undefined
        ? vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                setTimeout(
                  () => resolve([[{ ok: true }], { meta: true }]),
                  options.queryDelayMs,
                );
              }),
          )
        : vi.fn().mockResolvedValue([[{ ok: true }], { meta: true }]),
  };
}

describe("fas/connection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reuses cached connection when ping succeeds", async () => {
    vi.resetModules();
    const conn = makeConnection();
    createConnectionMock.mockResolvedValue(conn);

    const { getConnection, connectionCache } =
      await import("../fas/connection");
    connectionCache.clear();

    const first = await getConnection(hyperdrive);
    const second = await getConnection(hyperdrive);

    expect(first).toBe(second);
    expect(createConnectionMock).toHaveBeenCalledTimes(1);
    expect(conn.ping).toHaveBeenCalledTimes(1);
  });

  it("rotates cached connection when ping fails", async () => {
    vi.resetModules();
    const stale = makeConnection({ pingReject: true });
    const fresh = makeConnection();
    createConnectionMock
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(fresh);

    const { getConnection, connectionCache } =
      await import("../fas/connection");
    connectionCache.clear();

    const first = await getConnection(hyperdrive);
    const second = await getConnection(hyperdrive);

    expect(first).toBe(stale);
    expect(second).toBe(fresh);
    expect(createConnectionMock).toHaveBeenCalledTimes(2);
    expect(loggerMock.debug).toHaveBeenCalled();
  });

  it("cleanupExpiredConnections removes stale keys and ignores end failures", async () => {
    vi.resetModules();
    const { cleanupExpiredConnections, connectionCache } =
      await import("../fas/connection");

    const expired = makeConnection({ endReject: true });
    const active = makeConnection();
    const now = Date.now();
    connectionCache.clear();
    connectionCache.set("expired", {
      connection: expired,
      lastUsed: now - 31_000,
    });
    connectionCache.set("active", {
      connection: active,
      lastUsed: now,
    });

    cleanupExpiredConnections();

    expect(connectionCache.has("expired")).toBe(false);
    expect(connectionCache.has("active")).toBe(true);
    expect(expired.end).toHaveBeenCalledTimes(1);
  });

  it("queryWithTimeout resolves query result before timeout", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { queryWithTimeout } = await import("../fas/connection");
    const conn = makeConnection();

    const result = await queryWithTimeout(conn, "SELECT 1", [], 20);

    expect(result).toEqual([[{ ok: true }], { meta: true }]);

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("queryWithTimeout rejects when query exceeds timeout", async () => {
    vi.resetModules();
    const { queryWithTimeout } = await import("../fas/connection");
    const conn = {
      ping: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi
        .fn()
        .mockImplementation(() => new Promise<[unknown[], unknown]>(() => {})),
    };

    await expect(queryWithTimeout(conn, "SELECT SLEEP", [], 5)).rejects.toThrow(
      "FAS query timeout after 5ms",
    );
  });

  it("testConnection returns true on success", async () => {
    vi.resetModules();
    const conn = makeConnection();
    createConnectionMock.mockResolvedValue(conn);

    const { testConnection, connectionCache } =
      await import("../fas/connection");
    connectionCache.clear();

    await expect(testConnection(hyperdrive)).resolves.toBe(true);
    expect(conn.end).toHaveBeenCalledTimes(1);
  });

  it("testConnection returns false when connect fails", async () => {
    vi.resetModules();
    createConnectionMock.mockRejectedValue(new Error("connect failed"));

    const { testConnection, connectionCache } =
      await import("../fas/connection");
    connectionCache.clear();

    await expect(testConnection(hyperdrive)).resolves.toBe(false);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
