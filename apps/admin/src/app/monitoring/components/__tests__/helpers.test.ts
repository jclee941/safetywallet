import {
  PERIOD_OPTIONS,
  formatDuration,
  formatTime,
  getErrorRateBadge,
  getErrorRateColor,
} from "../helpers";
import { describe, expect, it, vi } from "vitest";

describe("monitoring helpers", () => {
  it("exposes period options", () => {
    expect(PERIOD_OPTIONS).toEqual([
      { value: "60", label: "최근 1시간" },
      { value: "360", label: "최근 6시간" },
      { value: "1440", label: "최근 24시간" },
      { value: "10080", label: "최근 7일" },
    ]);
  });

  it("formats duration for sub-ms, ms, and seconds", () => {
    expect(formatDuration(0.3)).toBe("<1ms");
    expect(formatDuration(123.4)).toBe("123ms");
    expect(formatDuration(1250)).toBe("1.25s");
  });

  it("formats time bucket as HH:mm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(formatTime("2026-01-01T09:07:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
    vi.useRealTimers();
  });

  it("returns error-rate color tiers", () => {
    expect(getErrorRateColor(10)).toBe("text-red-600");
    expect(getErrorRateColor(7)).toBe("text-orange-500");
    expect(getErrorRateColor(2)).toBe("text-yellow-500");
    expect(getErrorRateColor(0.5)).toBe("text-green-600");
  });

  it("returns error-rate badge tiers", () => {
    expect(getErrorRateBadge(12)).toBe("destructive");
    expect(getErrorRateBadge(7)).toBe("secondary");
    expect(getErrorRateBadge(2)).toBe("outline");
  });
});
