import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { HyperdriveBinding } from "../../types";

// Mock mysql2/promise
const mockQuery = vi.fn();
const mockPing = vi.fn().mockResolvedValue(undefined);
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockConnection = {
  query: mockQuery,
  ping: mockPing,
  end: mockEnd,
};

vi.mock("mysql2/promise", () => ({
  default: {
    createConnection: vi.fn().mockResolvedValue(mockConnection),
  },
}));

// Mock the validator to pass through
vi.mock("../../validators/fas-sync", () => ({
  FasGetUpdatedEmployeesParamsSchema: {
    parse: (v: unknown) => v,
  },
}));

const mockHyperdrive: HyperdriveBinding = {
  connectionString: "mysql://user:pass@localhost:3306/mdidev",
  host: "localhost",
  port: 3306,
  user: "testuser",
  password: "testpass",
  database: "mdidev",
};

function sampleEmployeeRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    empl_cd: "24000001",
    empl_nm: "김우현",
    part_cd: "P001",
    part_nm: "제일건설",
    tel_no: "01091865156",
    social_no: "6905281",
    gojo_cd: "G01",
    jijo_cd: "J01",
    care_cd: "C01",
    role_cd: "R01",
    state_flag: "W",
    entr_day: "20240101",
    retr_day: "",
    rfid: "RFID001",
    viol_cnt: 0,
    update_dt: new Date("2026-02-06T00:00:00Z"),
    ...overrides,
  };
}

function sampleAttendanceRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    empl_cd: "24000001",
    accs_day: "20260206",
    in_time: "0830",
    out_time: "1730",
    state: 0,
    part_cd: "P001",
    ...overrides,
  };
}

describe("fas-mariadb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapToFasEmployee (tested via fasGetEmployeeInfo)", () => {
    it("maps a DB row to FasEmployee with isActive=true when state_flag is W", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result).not.toBeNull();
      expect(result?.emplCd).toBe("24000001");
      expect(result?.name).toBe("김우현");
      expect(result?.companyName).toBe("제일건설");
      expect(result?.phone).toBe("01091865156");
      expect(result?.isActive).toBe(true);
      expect(result?.stateFlag).toBe("W");
      expect(result?.violCnt).toBe(0);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it("maps isActive=false when state_flag is not W", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow({ state_flag: "R" })],
      ]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result?.isActive).toBe(false);
    });

    it("returns null when no rows found", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "NOTFOUND");

      expect(result).toBeNull();
    });

    it("defaults update_dt to new Date() when not a Date instance", async () => {
      const { fasGetEmployeeInfo } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow({ update_dt: "not-a-date" })],
      ]);

      const result = await fasGetEmployeeInfo(mockHyperdrive, "24000001");

      expect(result?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("fasGetEmployeesBatch", () => {
    it("returns empty map for empty input", async () => {
      const { fasGetEmployeesBatch } = await import("../fas-mariadb");

      const result = await fasGetEmployeesBatch(mockHyperdrive, []);

      expect(result.size).toBe(0);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("returns map of employees keyed by emplCd", async () => {
      const { fasGetEmployeesBatch } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [
          sampleEmployeeRow({ empl_cd: "001" }),
          sampleEmployeeRow({ empl_cd: "002" }),
        ],
      ]);

      const result = await fasGetEmployeesBatch(mockHyperdrive, ["001", "002"]);

      expect(result.size).toBe(2);
      expect(result.get("001")?.emplCd).toBe("001");
      expect(result.get("002")?.emplCd).toBe("002");
    });
  });

  describe("fasGetUpdatedEmployees", () => {
    it("queries all employees when sinceTimestamp is null", async () => {
      const { fasGetUpdatedEmployees } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetUpdatedEmployees(mockHyperdrive, null);

      expect(result).toHaveLength(1);
      // Should NOT include timestamp filter
      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).not.toContain("update_dt >");
    });

    it("queries with timestamp filter when sinceTimestamp provided", async () => {
      const { fasGetUpdatedEmployees } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      await fasGetUpdatedEmployees(mockHyperdrive, "2026-02-01 00:00:00");

      const queryStr = mockQuery.mock.calls[0][0] as string;
      expect(queryStr).toContain("update_dt >");
    });
  });

  describe("fasGetAllEmployeesPaginated", () => {
    it("returns employees and total count", async () => {
      const { fasGetAllEmployeesPaginated } = await import("../fas-mariadb");
      // First call: COUNT
      mockQuery.mockResolvedValueOnce([[{ cnt: 100 }]]);
      // Second call: actual rows
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      const result = await fasGetAllEmployeesPaginated(mockHyperdrive, 0, 10);

      expect(result.total).toBe(100);
      expect(result.employees).toHaveLength(1);
    });
  });

  describe("FAS source resolution", () => {
    it("initializes and resolves source defaults", async () => {
      const { initFasConfig, resolveFasSource, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      initFasConfig({
        FAS_DB_NAME: "tenant_a",
        FAS_SITE_CD: "20",
        FAS_SITE_NAME: "테넌트A",
      });

      expect(resolveFasSource("tenant_a").dbName).toBe("tenant_a");
      expect(resolveFasSource("unknown").dbName).toBe("tenant_a");
      expect(resolveFasSource(null).dbName).toBe("tenant_a");
    });

    it("resolves worker id prefixes with fallback", async () => {
      const { resolveFasSourceByWorkerId } = await import("../fas-mariadb");

      const resolved = resolveFasSourceByWorkerId("EMP-001");
      expect(resolved.rawEmplCd).toBe("EMP-001");
      expect(resolved.source).toBeDefined();
    });
  });

  describe("fasGetDailyAttendance", () => {
    it("maps attendance rows correctly", async () => {
      const { fasGetDailyAttendance, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [
          sampleAttendanceRow(),
          sampleAttendanceRow({ in_time: null, out_time: null }),
        ],
      ]);

      const result = await fasGetDailyAttendance(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        emplCd: "24000001",
        accsDay: "20260206",
        inTime: "0830",
        outTime: "1730",
        state: 0,
        partCd: "P001",
      });
      expect(result[1]).toEqual({
        emplCd: "24000001",
        accsDay: "20260206",
        inTime: null,
        outTime: null,
        state: 0,
        partCd: "P001",
      });

      const queryStr = mockQuery.mock.calls[0][0] as string;
      const params = mockQuery.mock.calls[0][1] as string[];
      expect(queryStr).toContain("WHERE ad.accs_day = ?");
      expect(queryStr).toContain("ad.site_cd = ?");
      expect(params).toEqual(["20260206", DEFAULT_FAS_SOURCE.siteCd]);
    });

    it("falls back to access/access_history sources when access_daily is empty", async () => {
      const { fasGetDailyAttendance, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [sampleAttendanceRow({ in_time: "0900", out_time: "1800" })],
        ])
        .mockResolvedValueOnce([
          [sampleAttendanceRow({ in_time: "0830", out_time: "1830" })],
        ]);

      const result = await fasGetDailyAttendance(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result).toHaveLength(1);
      expect(result[0].inTime).toBe("0830");
      expect(result[0].outTime).toBe("1830");
    });

    it("continues when fallback source query throws", async () => {
      const { fasGetDailyAttendance, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error("access fail"))
        .mockResolvedValueOnce([[sampleAttendanceRow({ in_time: "0910" })]]);

      const result = await fasGetDailyAttendance(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );
      expect(result).toHaveLength(1);
      expect(result[0].inTime).toBe("0910");
    });
  });

  describe("raw attendance helper APIs", () => {
    it("returns merged raw summary across sources", async () => {
      const { fasGetDailyAttendanceRawSummary, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[{ empl_cd: "w1" }, { empl_cd: "w2" }]])
        .mockResolvedValueOnce([[{ empl_cd: "w2" }, { empl_cd: "w3" }]])
        .mockResolvedValueOnce([[{ empl_cd: "w1" }]]);

      const result = await fasGetDailyAttendanceRawSummary(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result.totalRows).toBe(5);
      expect(result.uniqueWorkers).toBe(3);
      expect(result.source).toContain("access_daily.raw");
    });

    it("returns none source when all raw summary queries fail", async () => {
      const { fasGetDailyAttendanceRawSummary, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockRejectedValueOnce(new Error("s1"))
        .mockRejectedValueOnce(new Error("s2"))
        .mockRejectedValueOnce(new Error("s3"));

      const result = await fasGetDailyAttendanceRawSummary(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result.source).toBe("none");
      expect(result.totalRows).toBe(0);
    });

    it("returns trimmed raw rows with safe limit", async () => {
      const { fasGetDailyAttendanceRawRows, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]])
        .mockResolvedValueOnce([[{ id: 3 }, { id: 4 }]])
        .mockResolvedValueOnce([[{ id: 5 }]]);

      const result = await fasGetDailyAttendanceRawRows(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
        3,
      );

      expect(result.rows).toHaveLength(3);
      expect(result.source).toContain("access_daily.raw");
    });

    it("returns none source when all raw rows queries fail", async () => {
      const { fasGetDailyAttendanceRawRows, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockRejectedValueOnce(new Error("rows1"))
        .mockRejectedValueOnce(new Error("rows2"))
        .mockRejectedValueOnce(new Error("rows3"));

      const result = await fasGetDailyAttendanceRawRows(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result.source).toBe("none");
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("attendance analytics APIs", () => {
    it("aggregates realtime stats and deduplicates checkins", async () => {
      const { fasGetDailyAttendanceRealtimeStats, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([
          [
            { empl_cd: "w1", checkin_key: "202602060830" },
            { empl_cd: "w1", checkin_key: "202602060830" },
          ],
        ])
        .mockResolvedValueOnce([
          [{ empl_cd: "w2", checkin_key: "202602060900" }],
        ])
        .mockResolvedValueOnce([
          [{ empl_cd: "w3", checkin_key: "202602061000" }],
        ]);

      const stats = await fasGetDailyAttendanceRealtimeStats(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(stats.totalRows).toBe(4);
      expect(stats.checkedInWorkers).toBe(3);
      expect(stats.dedupCheckinEvents).toBe(3);
    });

    it("returns site counts sorted desc and clipped by limit", async () => {
      const { fasGetDailyAttendanceSiteCounts, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery.mockResolvedValueOnce([
        [
          { site_cd: "11", cnt: 3 },
          { site_cd: "10", cnt: 10 },
          { site_cd: "", cnt: 50 },
        ],
      ]);

      const result = await fasGetDailyAttendanceSiteCounts(
        mockHyperdrive,
        "20260206",
        1,
        DEFAULT_FAS_SOURCE,
      );

      expect(result.siteCounts).toHaveLength(1);
      expect(result.siteCounts[0].siteCd).toBe("10");
    });

    it("returns attendance trend points", async () => {
      const { fasGetAttendanceTrend, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery.mockResolvedValueOnce([
        [
          { accs_day: "20260205", cnt: 2 },
          { accs_day: "20260206", cnt: 3 },
        ],
      ]);

      const result = await fasGetAttendanceTrend(
        mockHyperdrive,
        "20260205",
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(result).toEqual([
        { date: "20260205", count: 2 },
        { date: "20260206", count: 3 },
      ]);
    });

    it("returns attendance trend points with defaulted values", async () => {
      const { fasGetAttendanceTrend, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery.mockResolvedValueOnce([
        [
          { accs_day: null, cnt: null },
          { accs_day: "20260206", cnt: undefined },
        ],
      ]);

      const result = await fasGetAttendanceTrend(
        mockHyperdrive,
        "20260205",
        "20260206",
        null,
        DEFAULT_FAS_SOURCE,
      );

      expect(result).toEqual([
        { date: "", count: 0 },
        { date: "20260206", count: 0 },
      ]);
    });

    it("returns paginated attendance list with total", async () => {
      const { fasGetAttendanceList, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery.mockResolvedValueOnce([[{ cnt: 2 }]]).mockResolvedValueOnce([
        [
          {
            empl_cd: "24000001",
            empl_nm: "김우현",
            part_cd: "P001",
            part_nm: "제일건설",
            in_time: "0830",
            out_time: "1730",
            accs_day: "20260206",
          },
        ],
      ]);

      const result = await fasGetAttendanceList(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
        50,
        0,
      );

      expect(result.total).toBe(2);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].emplCd).toBe("24000001");
    });

    it("applies list fallback branches for site, pagination, and null fields", async () => {
      const { fasGetAttendanceList, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery.mockResolvedValueOnce([[{}]]).mockResolvedValueOnce([
        [
          {
            empl_cd: null,
            empl_nm: null,
            part_cd: null,
            part_nm: null,
            in_time: null,
            out_time: null,
            accs_day: null,
          },
        ],
      ]);

      const result = await fasGetAttendanceList(
        mockHyperdrive,
        "20260206",
        null,
        0,
        -10.7,
        DEFAULT_FAS_SOURCE,
      );

      expect(result.total).toBe(0);
      expect(result.records).toEqual([
        {
          emplCd: "",
          name: "",
          partCd: "",
          companyName: "",
          inTime: null,
          outTime: null,
          accsDay: "",
        },
      ]);

      const countQuery = mockQuery.mock.calls[0][0] as string;
      const countParams = mockQuery.mock.calls[0][1] as unknown[];
      const listParams = mockQuery.mock.calls[1][1] as unknown[];

      expect(countQuery).not.toContain("ad.site_cd = ?");
      expect(countParams).toEqual(["20260206"]);
      expect(listParams).toEqual(["20260206", 1, 0]);
    });

    it("clamps oversized list limit and normalizes offset", async () => {
      const { fasGetAttendanceList, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[{ cnt: 1 }]])
        .mockResolvedValueOnce([[sampleAttendanceRow({ in_time: "915" })]]);

      const result = await fasGetAttendanceList(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
        1234.9,
        9.9,
        DEFAULT_FAS_SOURCE,
      );

      expect(result.records[0]?.inTime).toBe("0915");

      const listParams = mockQuery.mock.calls[1][1] as unknown[];
      expect(listParams).toEqual([
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
        500,
        9,
      ]);
    });

    it("ignores invalid realtime rows without worker/checkin keys", async () => {
      const { fasGetDailyAttendanceRealtimeStats, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([
          [
            { empl_cd: "", checkin_key: "202602060830" },
            { empl_cd: "w1", checkin_key: "" },
            { empl_cd: "w1", checkin_key: "202602060830" },
          ],
        ])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);

      const stats = await fasGetDailyAttendanceRealtimeStats(
        mockHyperdrive,
        "20260206",
        DEFAULT_FAS_SOURCE.siteCd,
      );

      expect(stats.totalRows).toBe(3);
      expect(stats.checkedInWorkers).toBe(1);
      expect(stats.dedupCheckinEvents).toBe(1);
    });
  });

  describe("fasCheckWorkerAttendance", () => {
    it("returns hasAttendance=true with merged records", async () => {
      const { fasCheckWorkerAttendance, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockResolvedValueOnce([[sampleAttendanceRow({ in_time: "0830" })]])
        .mockResolvedValueOnce([[sampleAttendanceRow({ in_time: "0900" })]])
        .mockResolvedValueOnce([[sampleAttendanceRow({ out_time: "1900" })]]);

      const result = await fasCheckWorkerAttendance(
        mockHyperdrive,
        "24000001",
        "20260206",
        DEFAULT_FAS_SOURCE,
      );

      expect(result.hasAttendance).toBe(true);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].inTime).toBe("0830");
      expect(result.records[0].outTime).toBe("1900");
    });

    it("returns hasAttendance=false when all attendance source queries fail", async () => {
      const { fasCheckWorkerAttendance, DEFAULT_FAS_SOURCE } =
        await import("../fas-mariadb");

      mockQuery
        .mockRejectedValueOnce(new Error("f1"))
        .mockRejectedValueOnce(new Error("f2"))
        .mockRejectedValueOnce(new Error("f3"));

      const result = await fasCheckWorkerAttendance(
        mockHyperdrive,
        "24000001",
        "20260206",
        DEFAULT_FAS_SOURCE,
      );

      expect(result.hasAttendance).toBe(false);
      expect(result.records).toHaveLength(0);
    });
  });

  describe("fasSearchEmployeeByPhone", () => {
    it("normalizes phone number by removing dashes", async () => {
      const { fasSearchEmployeeByPhone } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[sampleEmployeeRow()]]);

      await fasSearchEmployeeByPhone(mockHyperdrive, "010-9186-5156");

      const params = mockQuery.mock.calls[0][1] as string[];
      expect(params).toContain("01091865156");
    });

    it("returns null when no match", async () => {
      const { fasSearchEmployeeByPhone } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([[]]);

      const result = await fasSearchEmployeeByPhone(
        mockHyperdrive,
        "01000000000",
      );

      expect(result).toBeNull();
    });
  });

  describe("fasSearchEmployeeByName", () => {
    it("returns matching employees by name", async () => {
      const { fasSearchEmployeeByName } = await import("../fas-mariadb");
      mockQuery.mockResolvedValueOnce([
        [sampleEmployeeRow(), sampleEmployeeRow({ empl_cd: "002" })],
      ]);

      const result = await fasSearchEmployeeByName(mockHyperdrive, "김");

      expect(result).toHaveLength(2);
      const params = mockQuery.mock.calls[0][1] as string[];
      expect(params).toContain("%김%");
    });
  });

  describe("cleanupExpiredConnections", () => {
    it("is exported and callable", async () => {
      const { cleanupExpiredConnections } = await import("../fas-mariadb");
      expect(typeof cleanupExpiredConnections).toBe("function");
      // Should not throw when called
      cleanupExpiredConnections();
    });
  });

  describe("testConnection", () => {
    it("returns true when ping succeeds", async () => {
      const { testConnection } = await import("../fas-mariadb");
      mockPing.mockResolvedValue(undefined);

      const result = await testConnection(mockHyperdrive);

      expect(result).toBe(true);
    });

    it("returns false when connection fails", async () => {
      const { testConnection } = await import("../fas-mariadb");
      // Force ping to fail (cached connection is reused, so createConnection won't be called)
      mockPing.mockRejectedValueOnce(new Error("Connection lost"));
      // After cache miss, also fail createConnection
      const mysql = await import("mysql2/promise");
      (
        mysql.default.createConnection as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await testConnection(mockHyperdrive);

      expect(result).toBe(false);
    });
  });
});
