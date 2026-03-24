import { describe, expect, it } from "vitest";
import {
  formatAccsDayWithDash,
  mergeAttendanceRecord,
  sortAttendanceByInTime,
} from "../fas/attendance-helpers";

describe("fas/attendance-helpers", () => {
  it("formats accsDay with dashes", () => {
    expect(formatAccsDayWithDash("20260324")).toBe("2026-03-24");
  });

  it("stores record when worker/day key does not exist", () => {
    const byWorker = new Map();
    const row = {
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0830",
      outTime: "1730",
      state: 0,
      partCd: "P1",
    };

    mergeAttendanceRecord(byWorker, row);
    expect(byWorker.size).toBe(1);
    expect(byWorker.get("E-1|20260324")).toEqual(row);
  });

  it("merges existing record using earliest inTime and latest outTime", () => {
    const byWorker = new Map([
      [
        "E-1|20260324",
        {
          emplCd: "E-1",
          accsDay: "20260324",
          inTime: "0900",
          outTime: "1700",
          state: 0,
          partCd: "",
        },
      ],
    ]);

    mergeAttendanceRecord(byWorker, {
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0830",
      outTime: "1800",
      state: 1,
      partCd: "P1",
    });

    expect(byWorker.get("E-1|20260324")).toEqual({
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0830",
      outTime: "1800",
      state: 1,
      partCd: "P1",
    });
  });

  it("uses nullish and truthy fallbacks when times and fields are missing", () => {
    const byWorker = new Map([
      [
        "E-1|20260324",
        {
          emplCd: "E-1",
          accsDay: "20260324",
          inTime: null,
          outTime: "1900",
          state: 0,
          partCd: "P1",
        },
      ],
    ]);

    mergeAttendanceRecord(byWorker, {
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0910",
      outTime: null,
      state: 2,
      partCd: "P2",
    });

    expect(byWorker.get("E-1|20260324")).toEqual({
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0910",
      outTime: "1900",
      state: 2,
      partCd: "P1",
    });
  });

  it("sorts records by inTime with null times last", () => {
    const sorted = sortAttendanceByInTime([
      {
        emplCd: "E-3",
        accsDay: "20260324",
        inTime: null,
        outTime: null,
        state: 0,
        partCd: "",
      },
      {
        emplCd: "E-2",
        accsDay: "20260324",
        inTime: "0900",
        outTime: null,
        state: 0,
        partCd: "",
      },
      {
        emplCd: "E-1",
        accsDay: "20260324",
        inTime: "0830",
        outTime: null,
        state: 0,
        partCd: "",
      },
    ]);

    expect(sorted.map((row) => row.emplCd)).toEqual(["E-1", "E-2", "E-3"]);
  });
});
