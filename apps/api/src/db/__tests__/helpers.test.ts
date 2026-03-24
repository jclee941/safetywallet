import type { DrizzleD1Database } from "drizzle-orm/d1";
import { describe, expect, it, vi } from "vitest";
import { dbBatch, dbBatchChunked } from "../helpers";

type DbType = DrizzleD1Database<Record<string, never>>;

function createBatchableD1() {
  const batchFn = vi.fn().mockResolvedValue([]);
  const db = { batch: batchFn } as unknown as DbType;
  return { db, batchFn };
}

function makeMockPromise(): Promise<unknown> {
  return Promise.resolve({ results: [] });
}

describe("db/helpers", () => {
  describe("dbBatch", () => {
    it("calls batch on the database with operations", async () => {
      const { db, batchFn } = createBatchableD1();
      const op = makeMockPromise();

      await dbBatch(db, [op]);

      expect(batchFn).toHaveBeenCalledWith([op]);
    });

    it("passes multiple operations to batch", async () => {
      const { db, batchFn } = createBatchableD1();
      const ops = [makeMockPromise(), makeMockPromise()];

      await dbBatch(db, ops);

      expect(batchFn).toHaveBeenCalledWith(ops);
    });
  });

  describe("dbBatchChunked", () => {
    it("returns early without calling batch for empty operations", async () => {
      const { db, batchFn } = createBatchableD1();

      const result = await dbBatchChunked(db, []);

      expect(result).toEqual({
        totalOps: 0,
        completedOps: 0,
        failedChunks: 0,
        errors: [],
      });
      expect(batchFn).not.toHaveBeenCalled();
    });

    it("makes a single batch call for <= 100 operations", async () => {
      const { db, batchFn } = createBatchableD1();
      batchFn.mockResolvedValue([]);
      const ops = Array.from({ length: 50 }, () => makeMockPromise());

      await dbBatchChunked(db, ops);

      expect(batchFn).toHaveBeenCalledTimes(1);
    });

    it("chunks into multiple batch calls for > 100 operations", async () => {
      const { db, batchFn } = createBatchableD1();
      batchFn.mockResolvedValue([]);
      const ops = Array.from({ length: 250 }, () => makeMockPromise());

      await dbBatchChunked(db, ops);

      expect(batchFn).toHaveBeenCalledTimes(3);
    });

    it("chunks exactly at boundary (200 items = 2 chunks)", async () => {
      const { db, batchFn } = createBatchableD1();
      batchFn.mockResolvedValue([]);
      const ops = Array.from({ length: 200 }, () => makeMockPromise());

      await dbBatchChunked(db, ops);

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it("101 items results in 2 batch calls", async () => {
      const { db, batchFn } = createBatchableD1();
      batchFn.mockResolvedValue([]);
      const ops = Array.from({ length: 101 }, () => makeMockPromise());

      await dbBatchChunked(db, ops);

      expect(batchFn).toHaveBeenCalledTimes(2);
    });

    it("records failed chunks and continues when at least one chunk succeeds", async () => {
      const { db, batchFn } = createBatchableD1();
      const ops = Array.from({ length: 250 }, () => makeMockPromise());

      batchFn
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("chunk failed"))
        .mockResolvedValueOnce([]);

      const result = await dbBatchChunked(db, ops);

      expect(result.totalOps).toBe(250);
      expect(result.completedOps).toBe(150);
      expect(result.failedChunks).toBe(1);
      expect(result.errors).toEqual([{ chunkIndex: 1, error: "chunk failed" }]);
    });

    it("stringifies non-Error failures in chunk errors", async () => {
      const { db, batchFn } = createBatchableD1();
      const ops = Array.from({ length: 120 }, () => makeMockPromise());

      batchFn.mockRejectedValueOnce("db-down").mockResolvedValueOnce([]);

      const result = await dbBatchChunked(db, ops);

      expect(result.failedChunks).toBe(1);
      expect(result.errors[0]).toEqual({ chunkIndex: 0, error: "db-down" });
    });

    it("throws when all chunks fail", async () => {
      const { db, batchFn } = createBatchableD1();
      const ops = Array.from({ length: 50 }, () => makeMockPromise());

      batchFn.mockRejectedValue(new Error("all failed"));

      await expect(dbBatchChunked(db, ops)).rejects.toThrow(
        "dbBatchChunked failed: all chunks failed",
      );
    });
  });
});
