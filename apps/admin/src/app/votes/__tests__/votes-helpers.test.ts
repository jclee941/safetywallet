import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  epochToKstDateString,
  dateStringToKstEpoch,
  getPeriodStatus,
  exportResultsCsv,
  PERIOD_STATUS_CONFIG,
} from "../votes-helpers";
import type { VotePeriod, VoteResult } from "@/types/vote";

describe("epochToKstDateString", () => {
  it("converts epoch seconds to KST date string", () => {
    const epoch = dateStringToKstEpoch("2024-01-15");
    const result = epochToKstDateString(epoch);
    expect(result).toBe("2024-01-15");
  });

  it("roundtrips with dateStringToKstEpoch", () => {
    const dates = ["2024-06-01", "2025-12-31", "2023-03-15"];
    for (const d of dates) {
      expect(epochToKstDateString(dateStringToKstEpoch(d))).toBe(d);
    }
  });
});

describe("dateStringToKstEpoch", () => {
  it("converts YYYY-MM-DD to epoch seconds at KST midnight", () => {
    const result = dateStringToKstEpoch("2024-01-15");
    const expected = Math.floor(
      new Date("2024-01-15T00:00:00+09:00").getTime() / 1000,
    );
    expect(result).toBe(expected.toString());
  });

  it("returns string representation", () => {
    const result = dateStringToKstEpoch("2025-12-31");
    expect(typeof result).toBe("string");
    expect(Number(result)).toBeGreaterThan(0);
  });
});

describe("PERIOD_STATUS_CONFIG", () => {
  it("has entries for UPCOMING, ACTIVE, ENDED", () => {
    expect(PERIOD_STATUS_CONFIG.UPCOMING.label).toBe("UPCOMING");
    expect(PERIOD_STATUS_CONFIG.ACTIVE.label).toBe("ACTIVE");
    expect(PERIOD_STATUS_CONFIG.ENDED.label).toBe("ENDED");
    expect(PERIOD_STATUS_CONFIG.UPCOMING.className).toContain("blue");
    expect(PERIOD_STATUS_CONFIG.ACTIVE.className).toContain("green");
    expect(PERIOD_STATUS_CONFIG.ENDED.className).toContain("gray");
  });
});

describe("getPeriodStatus", () => {
  it("returns null for null period", () => {
    expect(getPeriodStatus(null)).toBeNull();
  });

  it("returns null for undefined period", () => {
    expect(getPeriodStatus(undefined)).toBeNull();
  });

  it("returns UPCOMING when now is before start", () => {
    const futureStart = Math.floor(Date.now() / 1000) + 86400;
    const futureEnd = futureStart + 86400 * 7;
    const period = {
      startDate: futureStart.toString(),
      endDate: futureEnd.toString(),
    } as VotePeriod;
    expect(getPeriodStatus(period)).toBe("UPCOMING");
  });

  it("returns ACTIVE when now is between start and end", () => {
    const pastStart = Math.floor(Date.now() / 1000) - 86400;
    const futureEnd = Math.floor(Date.now() / 1000) + 86400;
    const period = {
      startDate: pastStart.toString(),
      endDate: futureEnd.toString(),
    } as VotePeriod;
    expect(getPeriodStatus(period)).toBe("ACTIVE");
  });

  it("returns ENDED when now is after end", () => {
    const pastStart = Math.floor(Date.now() / 1000) - 86400 * 14;
    const pastEnd = Math.floor(Date.now() / 1000) - 86400;
    const period = {
      startDate: pastStart.toString(),
      endDate: pastEnd.toString(),
    } as VotePeriod;
    expect(getPeriodStatus(period)).toBe("ENDED");
  });
});

describe("exportResultsCsv", () => {
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let clickMock: () => void;
  let createdAnchor: HTMLAnchorElement;
  let origCreateObjectURL: typeof window.URL.createObjectURL;
  let origRevokeObjectURL: typeof window.URL.revokeObjectURL;

  beforeEach(() => {
    origCreateObjectURL = window.URL.createObjectURL;
    origRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi
      .fn<(obj: Blob | MediaSource) => string>()
      .mockReturnValue("blob:mock-url");
    window.URL.revokeObjectURL = vi.fn<(url: string) => void>();

    clickMock = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === "a") {
        createdAnchor = el as HTMLAnchorElement;
        createdAnchor.click = clickMock;
      }
      return el;
    });

    appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node);
  });

  afterEach(() => {
    window.URL.createObjectURL = origCreateObjectURL;
    window.URL.revokeObjectURL = origRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("creates and downloads CSV with sorted results", () => {
    const results: VoteResult[] = [
      { user: { nameMasked: "김*수" }, voteCount: 5 } as VoteResult,
      { user: { nameMasked: "이*영" }, voteCount: 10 } as VoteResult,
      { user: { nameMasked: "박*진" }, voteCount: 3 } as VoteResult,
    ];

    exportResultsCsv(results, "2026-03");

    expect(window.URL.createObjectURL).toHaveBeenCalledOnce();
    const blob = vi.mocked(window.URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("text/csv;charset=utf-8;");

    expect(createdAnchor.href).toContain("blob:mock-url");
    expect(createdAnchor.download).toBe("vote_results_2026-03.csv");

    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(removeChildSpy).toHaveBeenCalledOnce();
  });

  it("handles empty results array", () => {
    exportResultsCsv([], "2026-01");

    expect(window.URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickMock).toHaveBeenCalledOnce();
  });

  it("sorts results by voteCount descending", () => {
    const results: VoteResult[] = [
      { user: { nameMasked: "A" }, voteCount: 1 } as VoteResult,
      { user: { nameMasked: "B" }, voteCount: 100 } as VoteResult,
    ];

    exportResultsCsv(results, "2025-06");

    const blob = vi.mocked(window.URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
  });
});
