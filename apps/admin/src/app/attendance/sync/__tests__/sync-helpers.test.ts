import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTION_BADGES,
  ACTION_LABELS,
  formatKstDateTime,
  formatRelativeTime,
} from "../sync-helpers";

describe("sync-helpers", () => {
  describe("formatKstDateTime", () => {
    it("returns dash for null", () => {
      expect(formatKstDateTime(null)).toBe("-");
    });

    it("formats valid datetime", () => {
      const result = formatKstDateTime("2026-03-01T00:00:00.000Z");
      expect(result).not.toBe("-");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns original string when formatter throws", () => {
      const spy = vi
        .spyOn(Date.prototype, "toLocaleString")
        .mockImplementation(() => {
          throw new Error("boom");
        });

      expect(formatKstDateTime("2026-03-01T00:00:00.000Z")).toBe(
        "2026-03-01T00:00:00.000Z",
      );

      spy.mockRestore();
    });
  });

  describe("formatRelativeTime", () => {
    const baseNow = new Date("2026-03-10T12:00:00.000Z").getTime();

    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(baseNow);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns dash for null", () => {
      expect(formatRelativeTime(null)).toBe("-");
    });

    it("returns just now for under one minute", () => {
      expect(formatRelativeTime("2026-03-10T11:59:40.000Z")).toBe("방금 전");
    });

    it("returns minutes for under one hour", () => {
      expect(formatRelativeTime("2026-03-10T11:30:00.000Z")).toBe("30분 전");
    });

    it("returns hours for under one day", () => {
      expect(formatRelativeTime("2026-03-10T09:00:00.000Z")).toBe("3시간 전");
    });

    it("returns days for over one day", () => {
      expect(formatRelativeTime("2026-03-08T12:00:00.000Z")).toBe("2일 전");
    });

    it("returns original string when getTime throws", () => {
      const spy = vi.spyOn(Date.prototype, "getTime").mockImplementation(() => {
        throw new Error("boom");
      });

      expect(formatRelativeTime("2026-03-08T12:00:00.000Z")).toBe(
        "2026-03-08T12:00:00.000Z",
      );

      spy.mockRestore();
    });
  });

  it("exports action labels and badge variants", () => {
    expect(ACTION_LABELS.FAS_SYNC_COMPLETED).toBe("동기화 완료");
    expect(ACTION_LABELS.FAS_SYNC_FAILED).toBe("동기화 실패");
    expect(ACTION_LABELS.FAS_WORKERS_SYNCED).toBe("수동 동기화");

    expect(ACTION_BADGES.FAS_SYNC_COMPLETED).toBe("default");
    expect(ACTION_BADGES.FAS_SYNC_FAILED).toBe("destructive");
    expect(ACTION_BADGES.FAS_WORKERS_SYNCED).toBe("secondary");
  });
});
