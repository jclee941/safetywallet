import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DAY_CUTOFF_HOUR,
  getTodayRange,
  parseDateParam,
  getKstDayRangeFromDate,
  toExclusiveEndDate,
  formatKst,
  formatYearMonth,
  csvEscape,
  buildCsv,
  getClientIp,
  requireExportAccess,
  requireManagerOrAdmin,
  type AppContext,
} from "../helpers";

const { mockDbGet } = vi.hoisted(() => {
  const mockDbGet = vi.fn();
  return { mockDbGet };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockDbGet,
        })),
      })),
    })),
  })),
}));

describe("DAY_CUTOFF_HOUR", () => {
  it("is 5 (5 AM KST cutoff)", () => {
    expect(DAY_CUTOFF_HOUR).toBe(5);
  });
});

describe("parseDateParam", () => {
  it("returns null for undefined", () => {
    expect(parseDateParam(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDateParam("")).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(parseDateParam("not-a-date")).toBeNull();
  });

  it("parses ISO date string", () => {
    const result = parseDateParam("2026-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toContain("2026-01-15");
  });

  it("parses ISO datetime string", () => {
    const result = parseDateParam("2026-03-10T14:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2026-03-10T14:30:00.000Z");
  });

  it("returns null for NaN date", () => {
    expect(parseDateParam("9999-99-99")).toBeNull();
  });
});

describe("getKstDayRangeFromDate — invalid month/day", () => {
  it("returns null for month > 12", () => {
    expect(getKstDayRangeFromDate("2026-13-01")).toBeNull();
  });

  it("returns null for month < 1", () => {
    expect(getKstDayRangeFromDate("2026-00-15")).toBeNull();
  });

  it("returns null for day > 31", () => {
    expect(getKstDayRangeFromDate("2026-01-32")).toBeNull();
  });

  it("returns null for day < 1", () => {
    expect(getKstDayRangeFromDate("2026-01-00")).toBeNull();
  });
});

describe("toExclusiveEndDate", () => {
  it("returns null for undefined", () => {
    expect(toExclusiveEndDate(undefined)).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(toExclusiveEndDate("invalid")).toBeNull();
  });

  it("adds one day for date-only string (YYYY-MM-DD)", () => {
    const result = toExclusiveEndDate("2026-02-10");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getDate()).toBe(11);
    expect(result?.getHours()).toBe(0);
    expect(result?.getMinutes()).toBe(0);
  });

  it("returns parsed date as-is for datetime strings (length > 10)", () => {
    const result = toExclusiveEndDate("2026-02-10T14:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe("2026-02-10T14:30:00.000Z");
  });

  it("handles month boundary correctly", () => {
    const result = toExclusiveEndDate("2026-01-31");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getMonth()).toBe(1);
    expect(result?.getDate()).toBe(1);
  });
});

describe("getKstDayRangeFromDate", () => {
  it("returns KST day range in UTC for date-only input", () => {
    const range = getKstDayRangeFromDate("2026-02-20");
    expect(range).not.toBeNull();
    expect(range?.start.toISOString()).toBe("2026-02-19T15:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-02-20T15:00:00.000Z");
  });

  it("accepts datetime input and uses its date part", () => {
    const range = getKstDayRangeFromDate("2026-02-20T08:00:00Z");
    expect(range).not.toBeNull();
    expect(range?.start.toISOString()).toBe("2026-02-19T15:00:00.000Z");
    expect(range?.end.toISOString()).toBe("2026-02-20T15:00:00.000Z");
  });

  it("returns null for invalid values", () => {
    expect(getKstDayRangeFromDate(undefined)).toBeNull();
    expect(getKstDayRangeFromDate("bad")).toBeNull();
  });
});

describe("formatKst", () => {
  it("returns empty string for null", () => {
    expect(formatKst(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatKst(undefined)).toBe("");
  });

  it("formats a date in Korean locale", () => {
    const date = new Date("2026-01-15T06:00:00Z");
    const result = formatKst(date);
    expect(result).toBeTruthy();
    expect(result).toContain("2026");
  });
});

describe("formatYearMonth", () => {
  it("formats date as YYYY-MM in KST", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    expect(formatYearMonth(date)).toBe("2026-03");
  });

  it("pads single-digit months with leading zero", () => {
    const date = new Date("2026-01-10T12:00:00Z");
    expect(formatYearMonth(date)).toBe("2026-01");
  });

  it("handles December correctly", () => {
    const date = new Date("2026-12-25T12:00:00Z");
    expect(formatYearMonth(date)).toBe("2026-12");
  });

  it("accounts for KST timezone offset near midnight UTC", () => {
    const date = new Date("2026-02-28T23:00:00Z");
    expect(formatYearMonth(date)).toBe("2026-03");
  });
});

describe("csvEscape", () => {
  it("returns empty string for null", () => {
    expect(csvEscape(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(csvEscape(undefined)).toBe("");
  });

  it("returns plain string as-is", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("converts number to string", () => {
    expect(csvEscape(42)).toBe("42");
  });

  it("wraps string containing comma in quotes", () => {
    expect(csvEscape("hello,world")).toBe('"hello,world"');
  });

  it("wraps string containing double-quote and escapes inner quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps string containing newline in quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles string with all special characters", () => {
    expect(csvEscape('a,b"c\nd')).toBe('"a,b""c\nd"');
  });

  it("handles zero", () => {
    expect(csvEscape(0)).toBe("0");
  });

  it("handles empty string", () => {
    expect(csvEscape("")).toBe("");
  });
});

describe("buildCsv", () => {
  it("builds CSV with UTF-8 BOM prefix", () => {
    const csv = buildCsv(["Name", "Age"], [["Alice", 30]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("builds header row correctly", () => {
    const csv = buildCsv(["Name", "Score"], []);
    expect(csv).toBe("\uFEFFName,Score");
  });

  it("builds data rows correctly", () => {
    const csv = buildCsv(
      ["Name", "Score"],
      [
        ["Alice", 100],
        ["Bob", 85],
      ],
    );
    const lines = csv.replace("\uFEFF", "").split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Name,Score");
    expect(lines[1]).toBe("Alice,100");
    expect(lines[2]).toBe("Bob,85");
  });

  it("escapes special characters in data", () => {
    const csv = buildCsv(["Name"], [['He said "hi"']]);
    const lines = csv.replace("\uFEFF", "").split("\n");
    expect(lines[1]).toBe('"He said ""hi"""');
  });

  it("handles null/undefined values in rows", () => {
    const csv = buildCsv(["A", "B"], [[null, undefined]]);
    const lines = csv.replace("\uFEFF", "").split("\n");
    expect(lines[1]).toBe(",");
  });

  it("handles empty rows array", () => {
    const csv = buildCsv(["Col1"], []);
    expect(csv).toBe("\uFEFFCol1");
  });
});

describe("getTodayRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function toKst(date: Date): Date {
    return new Date(date.getTime() + 9 * 60 * 60 * 1000);
  }

  it("returns start and end as Date objects", () => {
    const { start, end } = getTodayRange();
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it("end is exactly 24 hours after start", () => {
    const { start, end } = getTodayRange();
    const diffMs = end.getTime() - start.getTime();
    expect(diffMs).toBe(24 * 60 * 60 * 1000);
  });

  it("start aligns to 5 AM KST cutoff", () => {
    const { start } = getTodayRange();
    const startKst = toKst(start);
    expect(startKst.getUTCHours()).toBe(DAY_CUTOFF_HOUR);
    expect(startKst.getUTCMinutes()).toBe(0);
    expect(startKst.getUTCSeconds()).toBe(0);
  });

  it("uses previous logical day before 5 AM KST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T18:30:00.000Z"));

    const { start, end } = getTodayRange();

    expect(start.toISOString()).toBe("2026-02-18T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-19T20:00:00.000Z");
  });

  it("uses current logical day at or after 5 AM KST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T21:30:00.000Z"));

    const { start, end } = getTodayRange();

    expect(start.toISOString()).toBe("2026-02-19T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-20T20:00:00.000Z");
  });
});

describe("getClientIp", () => {
  it("returns CF-Connecting-IP when present", async () => {
    const { Hono } = await import("hono");
    const app = new Hono();
    app.get("/test", (c) => c.json({ ip: getClientIp(c) }));
    const res = await app.request("/test", {
      headers: { "CF-Connecting-IP": "1.2.3.4" },
    });
    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe("1.2.3.4");
  });

  it("falls back to X-Forwarded-For", async () => {
    const { Hono } = await import("hono");
    const app = new Hono();
    app.get("/test", (c) => c.json({ ip: getClientIp(c) }));
    const res = await app.request("/test", {
      headers: { "X-Forwarded-For": "5.6.7.8" },
    });
    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe("5.6.7.8");
  });

  it("returns unknown when no IP headers present", async () => {
    const { Hono } = await import("hono");
    const app = new Hono();
    app.get("/test", (c) => c.json({ ip: getClientIp(c) }));
    const res = await app.request("/test");
    const body = (await res.json()) as { ip: string };
    expect(body.ip).toBe("unknown");
  });
});

describe("requireExportAccess", () => {
  afterEach(() => {
    mockDbGet.mockReset();
  });

  it("calls next when non-SUPER_ADMIN user has canExport", async () => {
    mockDbGet.mockResolvedValueOnce({ canExport: true });
    const next = vi.fn();
    const c = {
      get: vi.fn().mockReturnValue({ user: { id: "u1", role: "SITE_ADMIN" } }),
      env: { DB: {} },
    };

    await requireExportAccess(c as unknown as AppContext, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireManagerOrAdmin", () => {
  afterEach(() => {
    mockDbGet.mockReset();
  });

  it("returns 400 when non-admin user has no siteId", async () => {
    const next = vi.fn();
    const c = {
      get: vi.fn().mockReturnValue({ user: { id: "u1", role: "WORKER" } }),
      env: { DB: {} },
      req: {
        query: vi.fn().mockReturnValue(undefined),
        param: vi.fn().mockReturnValue(undefined),
      },
      json: vi.fn().mockReturnValue(new Response()),
    };

    await requireManagerOrAdmin(c as unknown as AppContext, next);
    expect(next).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: "SITE_ID_REQUIRED" }),
      }),
      400,
    );
  });

  it("calls next when non-admin user has manager membership", async () => {
    mockDbGet.mockResolvedValueOnce({
      role: "MANAGER",
      userId: "u1",
      siteId: "s1",
      status: "ACTIVE",
    });
    const next = vi.fn();
    const c = {
      get: vi.fn().mockReturnValue({ user: { id: "u1", role: "WORKER" } }),
      env: { DB: {} },
      req: {
        query: vi.fn().mockReturnValue("site-1"),
        param: vi.fn().mockReturnValue(undefined),
      },
    };

    await requireManagerOrAdmin(c as unknown as AppContext, next);
    expect(next).toHaveBeenCalled();
  });
});
