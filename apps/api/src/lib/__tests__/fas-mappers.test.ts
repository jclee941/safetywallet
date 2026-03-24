import { describe, expect, it } from "vitest";
import { mapToFasAttendance, mapToFasEmployee } from "../fas/mappers";

describe("fas/mappers", () => {
  it("maps employee with fallback defaults and inactive state", () => {
    const before = Date.now();
    const result = mapToFasEmployee({
      empl_cd: null,
      empl_nm: undefined,
      part_cd: 0,
      part_nm: null,
      tel_no: null,
      social_no: undefined,
      gojo_cd: "",
      jijo_cd: null,
      care_cd: undefined,
      role_cd: null,
      state_flag: "R",
      entr_day: null,
      retr_day: undefined,
      rfid: null,
      viol_cnt: undefined,
      update_dt: "not-a-date",
    });
    const after = Date.now();

    expect(result.emplCd).toBe("");
    expect(result.name).toBe("");
    expect(result.partCd).toBe("");
    expect(result.companyName).toBe("");
    expect(result.phone).toBe("");
    expect(result.socialNo).toBe("");
    expect(result.stateFlag).toBe("R");
    expect(result.violCnt).toBe(0);
    expect(result.isActive).toBe(false);
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.updatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("maps employee as active when state_flag is W and preserves Date", () => {
    const updatedAt = new Date("2026-03-10T12:00:00.000Z");
    const result = mapToFasEmployee({
      empl_cd: "E-1",
      empl_nm: "Worker",
      state_flag: "W",
      update_dt: updatedAt,
      viol_cnt: 3,
    });

    expect(result.emplCd).toBe("E-1");
    expect(result.name).toBe("Worker");
    expect(result.isActive).toBe(true);
    expect(result.updatedAt).toBe(updatedAt);
    expect(result.violCnt).toBe(3);
  });

  it("maps attendance with padded time and null fallbacks", () => {
    const mapped = mapToFasAttendance({
      empl_cd: "E-1",
      accs_day: "20260324",
      in_time: "915",
      out_time: 1745,
      state: 2,
      part_cd: "P1",
    });

    expect(mapped).toEqual({
      emplCd: "E-1",
      accsDay: "20260324",
      inTime: "0915",
      outTime: "1745",
      state: 2,
      partCd: "P1",
    });

    const fallback = mapToFasAttendance({
      empl_cd: null,
      accs_day: undefined,
      in_time: "",
      out_time: null,
      state: undefined,
      part_cd: null,
    });

    expect(fallback).toEqual({
      emplCd: "",
      accsDay: "",
      inTime: null,
      outTime: null,
      state: 0,
      partCd: "",
    });
  });
});
