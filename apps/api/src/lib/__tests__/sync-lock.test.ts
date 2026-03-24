import { describe, expect, it, vi } from "vitest";
import { acquireSyncLock, releaseSyncLock } from "../sync-lock";
import { createMockKV } from "../../__tests__/helpers";

describe("sync-lock", () => {
  // ---------- acquireSyncLock ----------

  describe("acquireSyncLock", () => {
    it("acquires lock when not held", async () => {
      const kv = createMockKV();
      const result = await acquireSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
      );
      expect(result.acquired).toBe(true);
    });

    it("writes lock to KV with expirationTtl", async () => {
      const kv = createMockKV();
      await acquireSyncLock(kv as unknown as KVNamespace, "test-lock", 120);

      expect(kv.put).toHaveBeenCalledWith(
        "sync:lock:test-lock",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 120 }),
      );
    });

    it("fails when lock is already held", async () => {
      const kv = createMockKV();
      // Pre-set a lock
      await kv.put("sync:lock:test-lock", "existing-holder");

      const result = await acquireSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
      );
      expect(result.acquired).toBe(false);
      expect(result.holder).toBe("existing-holder");
    });

    it("uses default TTL of 600 seconds", async () => {
      const kv = createMockKV();
      await acquireSyncLock(kv as unknown as KVNamespace, "test-lock");

      expect(kv.put).toHaveBeenCalledWith(
        "sync:lock:test-lock",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 600 }),
      );
    });

    it("returns not acquired when KV get fails", async () => {
      const kv = createMockKV();
      (kv.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("kv read failed"),
      );

      const result = await acquireSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
      );

      expect(result).toEqual({ acquired: false });
    });

    it("returns not acquired when KV put fails", async () => {
      const kv = createMockKV();
      (kv.put as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("kv write failed"),
      );

      const result = await acquireSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
      );

      expect(result).toEqual({ acquired: false });
    });
  });

  // ---------- releaseSyncLock ----------

  describe("releaseSyncLock", () => {
    it("deletes the lock from KV", async () => {
      const kv = createMockKV();
      await kv.put("sync:lock:test-lock", "holder");

      await releaseSyncLock(kv as unknown as KVNamespace, "test-lock");

      expect(kv.delete).toHaveBeenCalledWith("sync:lock:test-lock");
    });

    it("does not throw when lock does not exist", async () => {
      const kv = createMockKV();
      await expect(
        releaseSyncLock(kv as unknown as KVNamespace, "nonexistent"),
      ).resolves.not.toThrow();
    });

    it("handles KV delete errors gracefully", async () => {
      const kv = createMockKV();
      (kv.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("KV down"),
      );

      // Should not throw
      await expect(
        releaseSyncLock(kv as unknown as KVNamespace, "test-lock"),
      ).resolves.not.toThrow();
    });

    it("skips delete when holder does not match", async () => {
      const kv = createMockKV();
      await kv.put("sync:lock:test-lock", "actual-holder");

      await releaseSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
        "expected-holder",
      );

      expect(kv.delete).not.toHaveBeenCalled();
    });

    it("deletes lock when holder check finds matching value", async () => {
      const kv = createMockKV();
      await kv.put("sync:lock:test-lock", "holder-1");

      await releaseSyncLock(
        kv as unknown as KVNamespace,
        "test-lock",
        "holder-1",
      );

      expect(kv.delete).toHaveBeenCalledWith("sync:lock:test-lock");
    });

    it("still deletes when holder is provided but lock key is missing", async () => {
      const kv = createMockKV();

      await releaseSyncLock(
        kv as unknown as KVNamespace,
        "missing-lock",
        "holder-1",
      );

      expect(kv.delete).toHaveBeenCalledWith("sync:lock:missing-lock");
    });
  });
});
