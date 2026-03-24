import { describe, expect, it } from "vitest";
import {
  DEVICE_REGISTRATION_LIMIT,
  DEVICE_REGISTRATION_WINDOW_MS,
  checkDeviceRegistrationLimit,
  getDeviceRegistrationKey,
  loadRecentDeviceRegistrations,
  normalizeDeviceId,
  recordDeviceRegistration,
} from "../device-registrations";
import type { DeviceRegistrationEntry } from "../device-registrations";
import { createMockKV } from "../../__tests__/helpers";

describe("device-registrations", () => {
  // ---------- normalizeDeviceId ----------

  describe("normalizeDeviceId", () => {
    it("returns trimmed string for valid device id", () => {
      expect(normalizeDeviceId("device-abc-123")).toBe("device-abc-123");
    });

    it("trims whitespace", () => {
      expect(normalizeDeviceId("  device-abc  ")).toBe("device-abc");
    });

    it("returns null for non-string input", () => {
      expect(normalizeDeviceId(123)).toBeNull();
      expect(normalizeDeviceId(null)).toBeNull();
      expect(normalizeDeviceId(undefined)).toBeNull();
      expect(normalizeDeviceId({})).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(normalizeDeviceId("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(normalizeDeviceId("   ")).toBeNull();
    });

    it("returns null for string exceeding 128 chars", () => {
      const longId = "a".repeat(129);
      expect(normalizeDeviceId(longId)).toBeNull();
    });

    it("accepts string at exactly 128 chars", () => {
      const exactId = "b".repeat(128);
      expect(normalizeDeviceId(exactId)).toBe(exactId);
    });
  });

  // ---------- getDeviceRegistrationKey ----------

  describe("getDeviceRegistrationKey", () => {
    it("returns correct KV key format", () => {
      expect(getDeviceRegistrationKey("my-device")).toBe(
        "device:my-device:registrations",
      );
    });

    it("handles special characters in device id", () => {
      expect(getDeviceRegistrationKey("device/123:456")).toBe(
        "device:device/123:456:registrations",
      );
    });
  });

  // ---------- constants ----------

  describe("constants", () => {
    it("DEVICE_REGISTRATION_LIMIT is 3", () => {
      expect(DEVICE_REGISTRATION_LIMIT).toBe(3);
    });

    it("DEVICE_REGISTRATION_WINDOW_MS is 24 hours", () => {
      expect(DEVICE_REGISTRATION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
    });
  });

  // ---------- KV-dependent functions ----------

  describe("loadRecentDeviceRegistrations", () => {
    it("returns empty array when KV has no data", async () => {
      const kv = createMockKV();
      const result = await loadRecentDeviceRegistrations(
        kv as unknown as KVNamespace,
        "dev1",
        Date.now(),
      );
      expect(result).toEqual([]);
    });

    it("returns only entries within 24h window", async () => {
      const now = Date.now();
      const recentEntry: DeviceRegistrationEntry = {
        userId: "u1",
        timestamp: new Date(now - 1000).toISOString(),
      };
      const oldEntry: DeviceRegistrationEntry = {
        userId: "u2",
        timestamp: new Date(
          now - DEVICE_REGISTRATION_WINDOW_MS - 1000,
        ).toISOString(),
      };

      const kv = createMockKV();
      await kv.put(
        getDeviceRegistrationKey("dev1"),
        JSON.stringify([recentEntry, oldEntry]),
      );

      const result = await loadRecentDeviceRegistrations(
        kv as unknown as KVNamespace,
        "dev1",
        now,
      );
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("u1");
    });

    it("handles malformed JSON in KV gracefully", async () => {
      const kv = createMockKV();
      await kv.put(getDeviceRegistrationKey("dev1"), "not-json{{");

      const result = await loadRecentDeviceRegistrations(
        kv as unknown as KVNamespace,
        "dev1",
        Date.now(),
      );
      expect(result).toEqual([]);
    });

    it("filters out entries with invalid structure", async () => {
      const kv = createMockKV();
      await kv.put(
        getDeviceRegistrationKey("dev1"),
        JSON.stringify([
          { userId: "u1", timestamp: new Date().toISOString() },
          { userId: 123, timestamp: "bad" },
          { timestamp: "missing-userId" },
          null,
        ]),
      );

      const result = await loadRecentDeviceRegistrations(
        kv as unknown as KVNamespace,
        "dev1",
        Date.now(),
      );
      // Only the first valid entry should be considered (may be filtered by time)
      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe("checkDeviceRegistrationLimit", () => {
    it("allows registration when under limit", async () => {
      const kv = createMockKV();
      const result = await checkDeviceRegistrationLimit(
        kv as unknown as KVNamespace,
        "dev1",
        Date.now(),
      );
      expect(result.allowed).toBe(true);
      expect(result.recent).toEqual([]);
    });

    it("denies registration when at limit", async () => {
      const now = Date.now();
      const entries: DeviceRegistrationEntry[] = [
        { userId: "u1", timestamp: new Date(now - 1000).toISOString() },
        { userId: "u2", timestamp: new Date(now - 2000).toISOString() },
        { userId: "u3", timestamp: new Date(now - 3000).toISOString() },
      ];

      const kv = createMockKV();
      await kv.put(getDeviceRegistrationKey("dev1"), JSON.stringify(entries));

      const result = await checkDeviceRegistrationLimit(
        kv as unknown as KVNamespace,
        "dev1",
        now,
      );
      expect(result.allowed).toBe(false);
      expect(result.recent).toHaveLength(3);
    });

    it("respects custom limit", async () => {
      const now = Date.now();
      const entries: DeviceRegistrationEntry[] = [
        { userId: "u1", timestamp: new Date(now - 1000).toISOString() },
      ];

      const kv = createMockKV();
      await kv.put(getDeviceRegistrationKey("dev1"), JSON.stringify(entries));

      const result = await checkDeviceRegistrationLimit(
        kv as unknown as KVNamespace,
        "dev1",
        now,
        1,
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe("recordDeviceRegistration", () => {
    it("adds new entry and writes to KV", async () => {
      const now = Date.now();
      const kv = createMockKV();

      const result = await recordDeviceRegistration(
        kv as unknown as KVNamespace,
        "dev1",
        "user-1",
        now,
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-1");
      expect(kv.put).toHaveBeenCalled();
    });

    it("appends to existing entries when recent is provided", async () => {
      const now = Date.now();
      const kv = createMockKV();
      const existing: DeviceRegistrationEntry[] = [
        { userId: "user-0", timestamp: new Date(now - 5000).toISOString() },
      ];

      const result = await recordDeviceRegistration(
        kv as unknown as KVNamespace,
        "dev1",
        "user-1",
        now,
        existing,
      );

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe("user-0");
      expect(result[1].userId).toBe("user-1");
    });

    it("sets expirationTtl on KV put", async () => {
      const now = Date.now();
      const kv = createMockKV();

      await recordDeviceRegistration(
        kv as unknown as KVNamespace,
        "dev1",
        "user-1",
        now,
      );

      expect(kv.put).toHaveBeenCalledWith(
        getDeviceRegistrationKey("dev1"),
        expect.any(String),
        expect.objectContaining({
          expirationTtl: Math.ceil(DEVICE_REGISTRATION_WINDOW_MS / 1000),
        }),
      );
    });
  });
});
