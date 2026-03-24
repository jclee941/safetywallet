import { Category, RejectReason } from "@safetywallet/types";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_POINTS,
  DEFAULT_RISK_BONUS,
  rejectReasons,
} from "../constants";

describe("review-actions constants", () => {
  it("contains default base points for all categories", () => {
    expect(DEFAULT_BASE_POINTS[Category.HAZARD]).toBe(10);
    expect(DEFAULT_BASE_POINTS[Category.UNSAFE_BEHAVIOR]).toBe(8);
    expect(DEFAULT_BASE_POINTS[Category.INCONVENIENCE]).toBe(5);
    expect(DEFAULT_BASE_POINTS[Category.SUGGESTION]).toBe(7);
    expect(DEFAULT_BASE_POINTS[Category.BEST_PRACTICE]).toBe(10);
  });

  it("contains risk bonus mapping", () => {
    expect(DEFAULT_RISK_BONUS.HIGH).toBe(5);
    expect(DEFAULT_RISK_BONUS.MEDIUM).toBe(3);
    expect(DEFAULT_RISK_BONUS.LOW).toBe(0);
  });

  it("contains all reject reasons and templates", () => {
    const values = rejectReasons.map((item) => item.value);
    expect(values).toEqual([
      RejectReason.DUPLICATE,
      RejectReason.UNCLEAR_PHOTO,
      RejectReason.INSUFFICIENT,
      RejectReason.FALSE,
      RejectReason.IRRELEVANT,
      RejectReason.OTHER,
    ]);

    const other = rejectReasons.find(
      (item) => item.value === RejectReason.OTHER,
    );
    expect(other?.template).toBe("");

    const duplicate = rejectReasons.find(
      (item) => item.value === RejectReason.DUPLICATE,
    );
    expect(duplicate?.template).toBe("이미 동일한 내용이 보고되었습니다.");
  });
});
