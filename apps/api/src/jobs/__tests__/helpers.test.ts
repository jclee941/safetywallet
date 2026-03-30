import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSyncFailureEventId,
  chunkArray,
  deleteFromOptionalTableByAge,
  emitSyncFailureToElk,
  ensureSiteMemberships,
  findExistingColumn,
  formatSettleMonth,
  getElkDailyIndexDate,
  getKSTDate,
  getMonthRange,
  getOrCreateSystemUser,
  persistSyncFailure,
  tableExists,
  VOTE_REWARD_POINT_CODES,
  VOTE_REWARD_POINTS,
  withRetry,
} from "../helpers";
import type { Env } from "../../types";

describe("scheduled helpers", () => {
  // ---------- getKSTDate ----------

  describe("getKSTDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns a Date object", () => {
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
      const result = getKSTDate();
      expect(result).toBeInstanceOf(Date);
    });

    it("is 9 hours ahead of UTC", () => {
      // 2025-06-15T12:00:00Z -> KST 21:00
      vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
      const utcNow = new Date();
      const kst = getKSTDate();
      const diffMs = kst.getTime() - utcNow.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      expect(diffHours).toBe(9);
    });

    it("rolls over to next day when UTC is past 15:00", () => {
      // UTC 16:00 = KST 01:00 next day
      vi.setSystemTime(new Date("2025-06-15T16:00:00Z"));
      const kst = getKSTDate();
      expect(kst.getUTCDate()).toBe(16); // Next day in KST
    });
  });

  // ---------- getMonthRange ----------

  describe("getMonthRange", () => {
    it("returns start and end for a given month", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
    });

    it("start is first day of month at 00:00:00", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCDate()).toBe(1);
      expect(range.start.getUTCHours()).toBe(0);
      expect(range.start.getUTCMinutes()).toBe(0);
      expect(range.start.getUTCSeconds()).toBe(0);
    });

    it("end is last day of month at 23:59:59", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      const range = getMonthRange(date);

      // June has 30 days
      expect(range.end.getUTCDate()).toBe(30);
      expect(range.end.getUTCHours()).toBe(23);
      expect(range.end.getUTCMinutes()).toBe(59);
      expect(range.end.getUTCSeconds()).toBe(59);
    });

    it("handles February in leap year", () => {
      const date = new Date("2024-02-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCDate()).toBe(1);
      expect(range.end.getUTCDate()).toBe(29);
    });

    it("handles February in non-leap year", () => {
      const date = new Date("2025-02-15T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.end.getUTCDate()).toBe(28);
    });

    it("handles December correctly", () => {
      const date = new Date("2025-12-20T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(range.end.getUTCDate()).toBe(31);
    });

    it("handles January correctly", () => {
      const date = new Date("2025-01-05T12:00:00Z");
      const range = getMonthRange(date);

      expect(range.start.getUTCMonth()).toBe(0); // January (0-indexed)
      expect(range.end.getUTCDate()).toBe(31);
    });
  });

  // ---------- formatSettleMonth ----------

  describe("formatSettleMonth", () => {
    it("formats as YYYY-MM", () => {
      const date = new Date("2025-06-15T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-06");
    });

    it("pads single-digit month with zero", () => {
      const date = new Date("2025-01-15T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-01");
    });

    it("formats December correctly", () => {
      const date = new Date("2025-12-01T12:00:00Z");
      expect(formatSettleMonth(date)).toBe("2025-12");
    });
  });

  // ---------- withRetry ----------

  describe("withRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(fn, 3, 10);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds eventually", async () => {
      vi.useRealTimers();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, 3, 1);

      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useFakeTimers();
    });

    it("throws after max attempts exhausted", async () => {
      vi.useRealTimers();
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        throw new Error("always-fail");
      });

      await expect(withRetry(fn, 2, 1)).rejects.toThrow("always-fail");
      expect(callCount).toBe(2);
      vi.useFakeTimers();
    });

    it("uses default values (maxAttempts=3, baseDelayMs=1000)", async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const result = await withRetry(fn);
      expect(result).toBe(42);
    });
  });

  describe("ELK telemetry helpers", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("builds daily index date from ISO timestamp", () => {
      expect(getElkDailyIndexDate("2026-02-20T02:03:04.567Z")).toBe(
        "2026.02.20",
      );
    });

    it("builds deterministic sync failure event id", () => {
      const eventId = buildSyncFailureEventId({
        timestamp: "2026-02-20T02:03:04.567Z",
        correlationId: "corr-123",
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
      });

      expect(eventId).toBe("FAS_WORKER-corr-123");
    });

    it("skips ELK emission when ELASTICSEARCH_URL is missing", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await emitSyncFailureToElk({} as Env, {
        timestamp: "2026-02-20T02:03:04.567Z",
        correlationId: "corr-123",
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("emits PUT request with deterministic _doc id", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_WORKER",
          errorCode: "FAS_WORKER_SYNC_FAILED",
          errorMessage: "worker down",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toBe(
        "https://elastic.example/safetywallet-logs-2026.02.20/_doc/FAS_WORKER-corr-123",
      );
      expect(init?.method).toBe("PUT");

      const body = JSON.parse(String(init?.body)) as {
        metadata: { correlationId: string; eventId: string; lockName: string };
      };
      expect(body.metadata.correlationId).toBe("corr-123");
      expect(body.metadata.eventId).toBe("FAS_WORKER-corr-123");
      expect(body.metadata.lockName).toBe("fas-full");
    });

    it("uses overridden Elasticsearch index prefix when provided", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        {
          ELASTICSEARCH_URL: "https://elastic.example",
          ELASTICSEARCH_INDEX_PREFIX: "safetywallet-logs",
        } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toBe(
        "https://elastic.example/safetywallet-logs-2026.02.20/_doc/FAS_WORKER-corr-123",
      );
    });

    it("retries once when first ELK request fails", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("network fail"))
        .mockResolvedValueOnce(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-123",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws when ELK responds non-ok after retries", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("boom", { status: 500 }),
      );

      await expect(
        emitSyncFailureToElk(
          { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
          {
            timestamp: "2026-02-20T02:03:04.567Z",
            correlationId: "corr-123",
            syncType: "FAS_WORKER",
            errorCode: "FULL_SYNC_FAILED",
            errorMessage: "boom",
            lockName: "fas-full",
          },
        ),
      ).rejects.toThrow("ELK ingest failed with status 500");
    });

    it("includes Authorization header when ELASTICSEARCH_API_KEY is set", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        {
          ELASTICSEARCH_URL: "https://elastic.example",
          ELASTICSEARCH_API_KEY: "test-key-123",
        } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-auth",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const init = fetchSpy.mock.calls[0]![1]!;
      expect(
        (init.headers as Record<string, string> | undefined)?.["Authorization"],
      ).toBe("ApiKey test-key-123");
    });

    it("omits Authorization header when ELASTICSEARCH_API_KEY is absent", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-noauth",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledOnce();
      const init = fetchSpy.mock.calls[0]![1]!;
      expect(
        (init.headers as Record<string, string> | undefined)?.["Authorization"],
      ).toBeUndefined();
    });

    it("retries on 403 and throws after exhausting retries", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("Forbidden", { status: 403 }));

      await expect(
        emitSyncFailureToElk(
          { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
          {
            timestamp: "2026-02-20T02:03:04.567Z",
            correlationId: "corr-403",
            syncType: "FAS_WORKER",
            errorCode: "FULL_SYNC_FAILED",
            errorMessage: "boom",
            lockName: "fas-full",
          },
        ),
      ).rejects.toThrow("ELK ingest failed with status 403");

      // 1 initial + 1 retry = 2 total calls (maxAttempts=2 in withRetry)
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("succeeds on retry after initial 403", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
        .mockResolvedValueOnce(new Response(null, { status: 201 }));

      await emitSyncFailureToElk(
        { ELASTICSEARCH_URL: "https://elastic.example" } as Env,
        {
          timestamp: "2026-02-20T02:03:04.567Z",
          correlationId: "corr-403-retry",
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
        },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("array/constants helpers", () => {
    it("chunks arrays by given size", () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray([], 2)).toEqual([]);
    });

    it("exports vote reward constants", () => {
      expect(VOTE_REWARD_POINTS).toEqual([50, 30, 20]);
      expect(VOTE_REWARD_POINT_CODES).toEqual([
        "VOTE_REWARD_RANK_1",
        "VOTE_REWARD_RANK_2",
        "VOTE_REWARD_RANK_3",
      ]);
    });
  });

  describe("optional table helpers", () => {
    it("tableExists returns true/false based on sqlite_master", async () => {
      const envTrue = {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ first: vi.fn(async () => ({ name: "x" })) })),
          })),
        },
      } as unknown as Env;
      const envFalse = {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ first: vi.fn(async () => null) })),
          })),
        },
      } as unknown as Env;

      await expect(tableExists(envTrue, "notifications")).resolves.toBe(true);
      await expect(tableExists(envFalse, "notifications")).resolves.toBe(false);
    });

    it("findExistingColumn returns first matching candidate", async () => {
      const env = {
        DB: {
          prepare: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [{ name: "createdAt" }, { name: "sent_at" }],
            })),
          })),
        },
      } as unknown as Env;

      await expect(
        findExistingColumn(env, "notifications", ["missing", "sent_at"]),
      ).resolves.toBe("sent_at");
      await expect(
        findExistingColumn(env, "notifications", ["missing"]),
      ).resolves.toBeNull();
    });

    it("deleteFromOptionalTableByAge handles missing table/column and delete", async () => {
      const envNoTable = {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({ first: vi.fn(async () => null) })),
          })),
        },
      } as unknown as Env;

      await expect(
        deleteFromOptionalTableByAge(
          envNoTable,
          "notifications",
          ["created_at"],
          new Date(),
        ),
      ).resolves.toBe(0);

      const envNoColumn = {
        DB: {
          prepare: vi
            .fn()
            .mockReturnValueOnce({
              bind: vi.fn(() => ({
                first: vi.fn(async () => ({ name: "ok" })),
              })),
            })
            .mockReturnValueOnce({
              all: vi.fn(async () => ({ results: [{ name: "other" }] })),
            }),
        },
      } as unknown as Env;

      await expect(
        deleteFromOptionalTableByAge(
          envNoColumn,
          "notifications",
          ["created_at"],
          new Date(),
        ),
      ).resolves.toBe(0);

      const envDelete = {
        DB: {
          prepare: vi
            .fn()
            .mockReturnValueOnce({
              bind: vi.fn(() => ({
                first: vi.fn(async () => ({ name: "ok" })),
              })),
            })
            .mockReturnValueOnce({
              all: vi.fn(async () => ({ results: [{ name: "created_at" }] })),
            })
            .mockReturnValueOnce({
              bind: vi.fn(() => ({
                run: vi.fn(async () => ({ meta: { changes: 7 } })),
              })),
            }),
        },
      } as unknown as Env;

      await expect(
        deleteFromOptionalTableByAge(
          envDelete,
          "notifications",
          ["created_at"],
          new Date("2026-03-20T00:00:00Z"),
        ),
      ).resolves.toBe(7);
    });

    it("deleteFromOptionalTableByAge returns 0 when result.meta is undefined", async () => {
      const env = {
        DB: {
          prepare: vi
            .fn()
            .mockReturnValueOnce({
              bind: vi.fn(() => ({
                first: vi.fn(async () => ({ name: "ok" })),
              })),
            })
            .mockReturnValueOnce({
              all: vi.fn(async () => ({ results: [{ name: "created_at" }] })),
            })
            .mockReturnValueOnce({
              bind: vi.fn(() => ({
                run: vi.fn(async () => ({})),
              })),
            }),
        },
      } as unknown as Env;

      await expect(
        deleteFromOptionalTableByAge(
          env,
          "notifications",
          ["created_at"],
          new Date("2026-03-20T00:00:00Z"),
        ),
      ).resolves.toBe(0);
    });
  });

  describe("persistSyncFailure + db membership helpers", () => {
    it("persistSyncFailure writes ELK/KV/syncErrors and tolerates failures", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));
      const kvPut = vi.fn(async () => undefined);
      const env = {
        ELASTICSEARCH_URL: "https://elastic.example",
        KV: { put: kvPut },
        DB: {},
      } as unknown as Env;

      await persistSyncFailure(env, {
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
        setFasDownStatus: true,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(kvPut).toHaveBeenCalledWith("fas-status", "down", {
        expirationTtl: 600,
      });
    });

    it("persistSyncFailure skips KV.put when setFasDownStatus is false", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response(null, { status: 201 }));
      const kvPut = vi.fn(async () => undefined);
      const env = {
        ELASTICSEARCH_URL: "https://elastic.example",
        KV: { put: kvPut },
        DB: {},
      } as unknown as Env;

      await persistSyncFailure(env, {
        syncType: "FAS_WORKER",
        errorCode: "FULL_SYNC_FAILED",
        errorMessage: "boom",
        lockName: "fas-full",
        setFasDownStatus: false,
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(kvPut).not.toHaveBeenCalled();
    });

    it("persistSyncFailure handles ELK and KV failures without throwing", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("elk down"));
      const kvPut = vi.fn(async () => {
        throw new Error("kv down");
      });
      const env = {
        ELASTICSEARCH_URL: "https://elastic.example",
        KV: { put: kvPut },
        DB: {},
      } as unknown as Env;

      await expect(
        persistSyncFailure(env, {
          syncType: "FAS_WORKER",
          errorCode: "FULL_SYNC_FAILED",
          errorMessage: "boom",
          lockName: "fas-full",
          setFasDownStatus: true,
        }),
      ).resolves.toBeUndefined();
    });

    it("persistSyncFailure handles non-Error ELK failure", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue("elk-string-error");
      const env = {
        ELASTICSEARCH_URL: "https://elastic.example",
        KV: { put: vi.fn(async () => undefined) },
        DB: {},
      } as unknown as Env;

      await expect(
        persistSyncFailure(env, {
          syncType: "FAS_WORKER",
          errorCode: "SYNC_FAIL",
          errorMessage: "boom",
          lockName: "fas",
          setFasDownStatus: false,
        }),
      ).resolves.toBeUndefined();
    });

    it("persistSyncFailure handles non-Error KV put failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 201 }),
      );
      const kvPut = vi.fn(async () => {
        throw "kv-string-error";
      });
      const env = {
        ELASTICSEARCH_URL: "https://elastic.example",
        KV: { put: kvPut },
        DB: {},
      } as unknown as Env;

      await expect(
        persistSyncFailure(env, {
          syncType: "FAS_WORKER",
          errorCode: "SYNC_FAIL",
          errorMessage: "boom",
          lockName: "fas",
          setFasDownStatus: true,
        }),
      ).resolves.toBeUndefined();
    });

    it("findExistingColumn handles non-array results", async () => {
      const env = {
        DB: {
          prepare: vi.fn(() => ({
            all: vi.fn(async () => ({ results: undefined })),
          })),
        },
      } as unknown as Env;

      await expect(
        findExistingColumn(env, "notifications", ["col_a"]),
      ).resolves.toBeNull();
    });

    it("getOrCreateSystemUser returns existing user or creates one", async () => {
      const dbExisting = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(async () => ({ id: "system-1" })),
            })),
          })),
        })),
      } as never;
      await expect(getOrCreateSystemUser(dbExisting)).resolves.toBe("system-1");

      const inserted: unknown[] = [];
      const dbCreate = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ get: vi.fn(async () => null) })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((v: unknown) => {
            inserted.push(v);
            return Promise.resolve();
          }),
        })),
      } as never;

      const createdId = await getOrCreateSystemUser(dbCreate);
      expect(createdId).toBeTypeOf("string");
      expect(inserted).toHaveLength(1);
    });

    it("ensureSiteMemberships handles empty input and inserts missing memberships", async () => {
      const dbEmpty = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ all: vi.fn(async () => []) })),
          })),
        })),
      } as never;
      await expect(ensureSiteMemberships(dbEmpty, [])).resolves.toBe(0);

      const existingCalls: string[][] = [];
      const insertChunks: unknown[] = [];
      const db = {
        select: vi
          .fn()
          .mockImplementationOnce(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                all: vi.fn(async () => [{ id: "site-1" }]),
              })),
            })),
          }))
          .mockImplementation(() => ({
            from: vi.fn(() => ({
              where: vi.fn((...args: unknown[]) => {
                void args;
                return {
                  all: vi.fn(async () => {
                    existingCalls.push(["called"]);
                    return [{ userId: "u1" }];
                  }),
                };
              }),
            })),
          })),
        insert: vi.fn(() => ({
          values: vi.fn((v: unknown) => {
            insertChunks.push(v);
            return {
              onConflictDoNothing: vi.fn(async () => undefined),
            };
          }),
        })),
      } as never;

      const created = await ensureSiteMemberships(db, ["u1", "u2", "u2"]);
      expect(existingCalls.length).toBeGreaterThan(0);
      expect(created).toBe(1);
      expect(insertChunks).toHaveLength(1);
    });

    it("ensureSiteMemberships returns 0 when no active sites exist", async () => {
      const db = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              all: vi.fn(async () => []),
            })),
          })),
        })),
      } as never;

      await expect(ensureSiteMemberships(db, ["u1", "u2"])).resolves.toBe(0);
    });

    it("ensureSiteMemberships returns 0 when all users are already members", async () => {
      const insertFn = vi.fn();
      const db = {
        select: vi
          .fn()
          .mockImplementationOnce(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                all: vi.fn(async () => [{ id: "site-1" }]),
              })),
            })),
          }))
          .mockImplementation(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                all: vi.fn(async () => [{ userId: "u1" }, { userId: "u2" }]),
              })),
            })),
          })),
        insert: insertFn,
      } as never;

      const created = await ensureSiteMemberships(db, ["u1", "u2"]);
      expect(created).toBe(0);
      expect(insertFn).not.toHaveBeenCalled();
    });
  });
});
