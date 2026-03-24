import { describe, expect, it } from "vitest";

describe("fas index re-exports", () => {
  it("exports core FAS symbols from ../fas", async () => {
    const fas = await import("../fas");

    expect(typeof fas.initFasConfig).toBe("function");
    expect(typeof fas.resolveFasSource).toBe("function");
    expect(typeof fas.resolveFasSourceByWorkerId).toBe("function");
    expect(typeof fas.cleanupExpiredConnections).toBe("function");
    expect(typeof fas.testConnection).toBe("function");
    expect(typeof fas.fasGetEmployeeInfo).toBe("function");
    expect(typeof fas.fasGetDailyAttendance).toBe("function");
    expect(fas.DEFAULT_FAS_SOURCE).toBeDefined();
    expect(Array.isArray(fas.FAS_SOURCES)).toBe(true);
  });
});

describe("fas-mariadb adapter re-export", () => {
  it("re-exports everything from ../fas", async () => {
    const fas = await import("../fas");
    const adapter = await import("../fas-mariadb");

    expect(typeof adapter.initFasConfig).toBe("function");
    expect(typeof adapter.resolveFasSource).toBe("function");
    expect(typeof adapter.fasGetEmployeeInfo).toBe("function");
    expect(typeof adapter.fasGetDailyAttendance).toBe("function");
    expect(adapter.DEFAULT_FAS_SOURCE).toEqual(fas.DEFAULT_FAS_SOURCE);
  });
});
