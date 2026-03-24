import { describe, expect, it } from "vitest";
import {
  isValidActionTransition,
  ACTION_STATUSES,
  VALID_ACTION_TRANSITIONS,
  type ActionStatus,
} from "../helpers";

describe("routes/actions/helpers", () => {
  describe("isValidActionTransition", () => {
    it("returns true for valid transitions", () => {
      expect(isValidActionTransition("NONE", "ASSIGNED")).toBe(true);
      expect(isValidActionTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
      expect(isValidActionTransition("ASSIGNED", "NONE")).toBe(true);
      expect(isValidActionTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
      expect(isValidActionTransition("COMPLETED", "VERIFIED")).toBe(true);
      expect(isValidActionTransition("VERIFIED", "IN_PROGRESS")).toBe(true);
      expect(isValidActionTransition("OVERDUE", "ASSIGNED")).toBe(true);
    });

    it("returns false for invalid transitions", () => {
      expect(isValidActionTransition("NONE", "COMPLETED")).toBe(false);
      expect(isValidActionTransition("ASSIGNED", "VERIFIED")).toBe(false);
      expect(isValidActionTransition("COMPLETED", "NONE")).toBe(false);
    });

    it("returns false when from status is not in transition map", () => {
      // Covers the ?? false branch on line 36 when VALID_ACTION_TRANSITIONS[from] is undefined
      const unknownStatus = "UNKNOWN_STATUS" as ActionStatus;
      expect(isValidActionTransition(unknownStatus, "ASSIGNED")).toBe(false);
    });
  });

  describe("ACTION_STATUSES", () => {
    it("contains all expected statuses", () => {
      expect(ACTION_STATUSES).toEqual([
        "NONE",
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "VERIFIED",
        "OVERDUE",
      ]);
    });
  });

  describe("VALID_ACTION_TRANSITIONS", () => {
    it("has entries for all statuses", () => {
      for (const status of ACTION_STATUSES) {
        expect(VALID_ACTION_TRANSITIONS).toHaveProperty(status);
      }
    });
  });
});
