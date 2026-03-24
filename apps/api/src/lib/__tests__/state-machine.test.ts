import { describe, expect, it } from "vitest";
import {
  canResubmit,
  isTerminalActionStatus,
  isTerminalReviewStatus,
  validateActionTransition,
  validateReviewTransition,
} from "../state-machine";

describe("state-machine", () => {
  // ---------- validateReviewTransition ----------

  describe("validateReviewTransition", () => {
    describe("permission checks", () => {
      it("denies WORKER role for all admin-only actions", () => {
        const adminActions = [
          "APPROVE",
          "REJECT",
          "REQUEST_MORE",
          "MARK_URGENT",
          "ASSIGN",
          "CLOSE",
        ] as const;

        for (const action of adminActions) {
          const result = validateReviewTransition(
            action,
            "PENDING",
            "NONE",
            "WORKER",
          );
          expect(result.valid).toBe(false);
          expect(result.error).toContain("권한이 없습니다");
          expect(result.error).toContain(action);
        }
      });

      it("allows SITE_ADMIN to perform review actions", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
      });

      it("allows SUPER_ADMIN to perform review actions", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "NONE",
          "SUPER_ADMIN",
        );
        expect(result.valid).toBe(true);
      });

      it("allows SYSTEM to perform review actions", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "NONE",
          "SYSTEM",
        );
        expect(result.valid).toBe(true);
      });
    });

    describe("APPROVE action", () => {
      it("succeeds from PENDING", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
      });

      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "IN_REVIEW",
          "ASSIGNED",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
      });

      it("succeeds from NEED_INFO", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "NEED_INFO",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
      });

      it("fails from APPROVED (already approved)", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "APPROVED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
        expect(result.error).toContain("APPROVED");
      });

      it("fails from REJECTED", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "REJECTED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });

      it("fails from URGENT", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "URGENT",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });

      it("sets action status to COMPLETED when current is NONE", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newActionStatus).toBe("COMPLETED");
      });

      it("does not change action status when already assigned", () => {
        const result = validateReviewTransition(
          "APPROVE",
          "PENDING",
          "ASSIGNED",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newActionStatus).toBeUndefined();
      });
    });

    describe("REJECT action", () => {
      it("succeeds from PENDING", () => {
        const result = validateReviewTransition(
          "REJECT",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("REJECTED");
      });

      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "REJECT",
          "IN_REVIEW",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("REJECTED");
      });

      it("succeeds from NEED_INFO", () => {
        const result = validateReviewTransition(
          "REJECT",
          "NEED_INFO",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("REJECTED");
      });

      it("fails from APPROVED", () => {
        const result = validateReviewTransition(
          "REJECT",
          "APPROVED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });
    });

    describe("REQUEST_MORE action", () => {
      it("succeeds from PENDING", () => {
        const result = validateReviewTransition(
          "REQUEST_MORE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("NEED_INFO");
      });

      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "REQUEST_MORE",
          "IN_REVIEW",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("NEED_INFO");
      });

      it("fails from NEED_INFO (already in that state)", () => {
        const result = validateReviewTransition(
          "REQUEST_MORE",
          "NEED_INFO",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });
    });

    describe("MARK_URGENT action", () => {
      it("succeeds from PENDING", () => {
        const result = validateReviewTransition(
          "MARK_URGENT",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("URGENT");
      });

      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "MARK_URGENT",
          "IN_REVIEW",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("URGENT");
      });

      it("succeeds from NEED_INFO", () => {
        const result = validateReviewTransition(
          "MARK_URGENT",
          "NEED_INFO",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("URGENT");
      });

      it("fails from APPROVED", () => {
        const result = validateReviewTransition(
          "MARK_URGENT",
          "APPROVED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });
    });

    describe("ASSIGN action", () => {
      it("succeeds from PENDING", () => {
        const result = validateReviewTransition(
          "ASSIGN",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("IN_REVIEW");
        expect(result.newActionStatus).toBe("ASSIGNED");
      });

      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "ASSIGN",
          "IN_REVIEW",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("IN_REVIEW");
        expect(result.newActionStatus).toBe("ASSIGNED");
      });

      it("succeeds from APPROVED", () => {
        const result = validateReviewTransition(
          "ASSIGN",
          "APPROVED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("IN_REVIEW");
        expect(result.newActionStatus).toBe("ASSIGNED");
      });

      it("fails from REJECTED", () => {
        const result = validateReviewTransition(
          "ASSIGN",
          "REJECTED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });
    });

    describe("CLOSE action", () => {
      it("succeeds from IN_REVIEW", () => {
        const result = validateReviewTransition(
          "CLOSE",
          "IN_REVIEW",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
        expect(result.newActionStatus).toBe("VERIFIED");
      });

      it("succeeds from APPROVED", () => {
        const result = validateReviewTransition(
          "CLOSE",
          "APPROVED",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
        expect(result.newActionStatus).toBe("VERIFIED");
      });

      it("succeeds from URGENT", () => {
        const result = validateReviewTransition(
          "CLOSE",
          "URGENT",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("APPROVED");
        expect(result.newActionStatus).toBe("VERIFIED");
      });

      it("fails from PENDING", () => {
        const result = validateReviewTransition(
          "CLOSE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(false);
      });
    });

    it("returns unknown action error for invalid action", () => {
      const result = validateReviewTransition(
        "INVALID_ACTION" as unknown as "APPROVE",
        "PENDING",
        "NONE",
        "SITE_ADMIN",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("알 수 없는 액션");
    });

    it("falls back to IN_REVIEW for unexpected action in status resolver", () => {
      Reflect.set(
        Object.prototype as Record<string, unknown>,
        "__TEST_FAKE_REVIEW_ACTION__",
        ["PENDING"],
      );
      try {
        const result = validateReviewTransition(
          "__TEST_FAKE_REVIEW_ACTION__" as unknown as "APPROVE",
          "PENDING",
          "NONE",
          "SITE_ADMIN",
        );
        expect(result.valid).toBe(true);
        expect(result.newReviewStatus).toBe("IN_REVIEW");
      } finally {
        Reflect.deleteProperty(Object.prototype, "__TEST_FAKE_REVIEW_ACTION__");
      }
    });
  });

  // ---------- validateActionTransition ----------

  describe("validateActionTransition", () => {
    it("ASSIGN succeeds from NONE", () => {
      const result = validateActionTransition("ASSIGN", "NONE");
      expect(result.valid).toBe(true);
      expect(result.newActionStatus).toBe("ASSIGNED");
    });

    it("ASSIGN succeeds from OVERDUE", () => {
      const result = validateActionTransition("ASSIGN", "OVERDUE");
      expect(result.valid).toBe(true);
      expect(result.newActionStatus).toBe("ASSIGNED");
    });

    it("ASSIGN fails from ASSIGNED", () => {
      const result = validateActionTransition("ASSIGN", "ASSIGNED");
      expect(result.valid).toBe(false);
    });

    it("START succeeds from ASSIGNED", () => {
      const result = validateActionTransition("START", "ASSIGNED");
      expect(result.valid).toBe(true);
      expect(result.newActionStatus).toBe("IN_PROGRESS");
    });

    it("START fails from NONE", () => {
      const result = validateActionTransition("START", "NONE");
      expect(result.valid).toBe(false);
    });

    it("COMPLETE succeeds from IN_PROGRESS", () => {
      const result = validateActionTransition("COMPLETE", "IN_PROGRESS");
      expect(result.valid).toBe(true);
      expect(result.newActionStatus).toBe("COMPLETED");
    });

    it("COMPLETE fails from ASSIGNED", () => {
      const result = validateActionTransition("COMPLETE", "ASSIGNED");
      expect(result.valid).toBe(false);
    });

    it("REOPEN succeeds from VERIFIED", () => {
      const result = validateActionTransition("REOPEN", "VERIFIED");
      expect(result.valid).toBe(true);
      expect(result.newActionStatus).toBe("IN_PROGRESS");
    });

    it("REOPEN fails from COMPLETED", () => {
      const result = validateActionTransition("REOPEN", "COMPLETED");
      expect(result.valid).toBe(false);
    });

    it("returns error for invalid action type", () => {
      const result = validateActionTransition("INVALID" as "ASSIGN", "NONE");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("알 수 없는 액션 타입");
    });
  });

  // ---------- canResubmit ----------

  describe("canResubmit", () => {
    it("returns true for NEED_INFO", () => {
      expect(canResubmit("NEED_INFO")).toBe(true);
    });

    it("returns true for REJECTED", () => {
      expect(canResubmit("REJECTED")).toBe(true);
    });

    it("returns false for PENDING", () => {
      expect(canResubmit("PENDING")).toBe(false);
    });

    it("returns false for IN_REVIEW", () => {
      expect(canResubmit("IN_REVIEW")).toBe(false);
    });

    it("returns false for APPROVED", () => {
      expect(canResubmit("APPROVED")).toBe(false);
    });

    it("returns false for URGENT", () => {
      expect(canResubmit("URGENT")).toBe(false);
    });
  });

  // ---------- isTerminalReviewStatus ----------

  describe("isTerminalReviewStatus", () => {
    it("returns true for APPROVED", () => {
      expect(isTerminalReviewStatus("APPROVED")).toBe(true);
    });

    it("returns true for REJECTED", () => {
      expect(isTerminalReviewStatus("REJECTED")).toBe(true);
    });

    it("returns false for PENDING", () => {
      expect(isTerminalReviewStatus("PENDING")).toBe(false);
    });

    it("returns false for IN_REVIEW", () => {
      expect(isTerminalReviewStatus("IN_REVIEW")).toBe(false);
    });

    it("returns false for NEED_INFO", () => {
      expect(isTerminalReviewStatus("NEED_INFO")).toBe(false);
    });

    it("returns false for URGENT", () => {
      expect(isTerminalReviewStatus("URGENT")).toBe(false);
    });
  });

  // ---------- isTerminalActionStatus ----------

  describe("isTerminalActionStatus", () => {
    it("returns true for VERIFIED", () => {
      expect(isTerminalActionStatus("VERIFIED")).toBe(true);
    });

    it("returns true for OVERDUE", () => {
      expect(isTerminalActionStatus("OVERDUE")).toBe(true);
    });

    it("returns false for NONE", () => {
      expect(isTerminalActionStatus("NONE")).toBe(false);
    });

    it("returns false for ASSIGNED", () => {
      expect(isTerminalActionStatus("ASSIGNED")).toBe(false);
    });

    it("returns false for IN_PROGRESS", () => {
      expect(isTerminalActionStatus("IN_PROGRESS")).toBe(false);
    });

    it("returns false for COMPLETED", () => {
      expect(isTerminalActionStatus("COMPLETED")).toBe(false);
    });
  });
});
