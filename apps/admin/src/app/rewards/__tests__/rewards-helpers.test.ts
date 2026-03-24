import { describe, expect, it, vi } from "vitest";
import { TABS, formatDate, getCurrentMonth } from "../rewards-helpers";

describe("rewards helpers", () => {
  it("returns tab definitions", () => {
    expect(TABS).toEqual([
      { key: "rankings", label: "월간 순위" },
      { key: "criteria", label: "포상 기준 설정" },
      { key: "history", label: "지급 내역" },
      { key: "distribution", label: "배분 기록" },
      { key: "export", label: "내보내기" },
    ]);
  });

  it("formats current month and date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T10:20:30.000Z"));

    expect(getCurrentMonth()).toMatch(/^2026-0?4$/);
    expect(formatDate("2026-04-03T10:20:30.000Z")).toMatch(/^2026-04-0?3$/);

    vi.useRealTimers();
  });
});
