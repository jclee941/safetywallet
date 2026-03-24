import { describe, expect, it, vi } from "vitest";
import {
  getClientIp,
  getUserAgent,
  logAudit,
  logAuditWithContext,
} from "../audit";

function mockContext(headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name],
    },
    env: {},
  } as unknown as Parameters<typeof logAuditWithContext>[0];
}

function createMockDb() {
  const values = vi.fn().mockReturnThis();
  return {
    insert: vi.fn(() => ({ values })),
    _values: values,
  };
}

describe("audit", () => {
  describe("getClientIp", () => {
    it("returns CF-Connecting-IP when present", () => {
      const c = mockContext({ "CF-Connecting-IP": "1.2.3.4" });
      expect(getClientIp(c)).toBe("1.2.3.4");
    });

    it("falls back to X-Forwarded-For", () => {
      const c = mockContext({ "X-Forwarded-For": "5.6.7.8, 9.10.11.12" });
      expect(getClientIp(c)).toBe("5.6.7.8, 9.10.11.12");
    });

    it("returns unknown when no IP headers", () => {
      const c = mockContext();
      expect(getClientIp(c)).toBe("unknown");
    });
  });

  describe("getUserAgent", () => {
    it("returns User-Agent header", () => {
      const c = mockContext({ "User-Agent": "TestBot/1.0" });
      expect(getUserAgent(c)).toBe("TestBot/1.0");
    });

    it("returns empty string when no User-Agent", () => {
      const c = mockContext();
      expect(getUserAgent(c)).toBe("");
    });
  });

  describe("logAudit", () => {
    it("inserts audit log entry", async () => {
      const db = createMockDb();
      await logAudit(
        db as never,
        "LOGIN_SUCCESS",
        "actor-1",
        "USER",
        "target-1",
        { reason: "test" },
        "1.2.3.4",
        "TestBot/1.0",
      );

      expect(db.insert).toHaveBeenCalledOnce();
      const valuesArg = db._values.mock.calls[0][0];
      expect(valuesArg).toMatchObject({
        action: "LOGIN_SUCCESS",
        actorId: "actor-1",
        targetType: "USER",
        targetId: "target-1",
        reason: JSON.stringify({ reason: "test" }),
        ip: "1.2.3.4",
        userAgent: "TestBot/1.0",
      });
    });

    it("swallows insert errors", async () => {
      const db = {
        insert: vi.fn(() => ({
          values: vi.fn().mockRejectedValue(new Error("db insert failed")),
        })),
      };

      await expect(
        logAudit(
          db as never,
          "LOGIN_FAILED",
          "actor-err",
          "USER",
          "target-err",
          { reason: "failure" },
          "0.0.0.0",
          "Agent",
        ),
      ).resolves.toBeUndefined();
    });

    it("swallows non-Error thrown values", async () => {
      const db = {
        insert: vi.fn(() => ({
          values: vi.fn().mockRejectedValue("db insert failed"),
        })),
      };

      await expect(
        logAudit(
          db as never,
          "LOGIN_FAILED",
          "actor-err-2",
          "USER",
          "target-err-2",
          { reason: "failure" },
          "0.0.0.0",
          "Agent",
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("logAuditWithContext", () => {
    it("extracts IP and UA from context and calls logAudit", async () => {
      const c = mockContext({
        "CF-Connecting-IP": "10.0.0.1",
        "User-Agent": "Worker/2.0",
      });
      const db = createMockDb();

      await logAuditWithContext(
        c,
        db as never,
        "POST_REVIEWED",
        "actor-2",
        "POST",
        "post-1",
        { reason: "approved" },
      );

      const valuesArg = db._values.mock.calls[0][0];
      expect(valuesArg.ip).toBe("10.0.0.1");
      expect(valuesArg.userAgent).toBe("Worker/2.0");
      expect(valuesArg.action).toBe("POST_REVIEWED");
    });

    it("handles empty details", async () => {
      const c = mockContext();
      const db = createMockDb();

      await logAuditWithContext(
        c,
        db as never,
        "LOGIN_FAILED",
        "a",
        "USER",
        "t",
        {},
      );

      const valuesArg = db._values.mock.calls[0][0];
      expect(valuesArg.reason).toBe("{}");
    });
  });
});
