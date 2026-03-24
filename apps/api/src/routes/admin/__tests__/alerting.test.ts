import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthContext, Env } from "../../../types";
import { createMockKV, makeAuth } from "../../../__tests__/helpers";

type AppEnv = { Bindings: Env; Variables: { auth: AuthContext } };

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) =>
    next(),
  ),
}));

vi.mock("../../../lib/alerting", () => ({
  getAlertConfig: vi.fn(),
  setAlertConfig: vi.fn(),
  fireAlert: vi.fn(),
}));

import alertingApp from "../alerting";
import {
  getAlertConfig,
  setAlertConfig,
  fireAlert,
  type AlertConfig,
} from "../../../lib/alerting";

let kv: ReturnType<typeof createMockKV>;

interface SuccessResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

interface ErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
  timestamp: string;
}

function buildApp() {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("auth", makeAuth("SITE_ADMIN"));
    await next();
  });

  app.route("/admin", alertingApp);
  return app;
}

describe("Admin Alerting and Maintenance Endpoints", () => {
  let app: ReturnType<typeof buildApp>;

  const defaultAlertConfig: AlertConfig = {
    webhookUrl: "https://example.com/webhook",
    cooldownSeconds: 300,
    enabled: true,
    errorRateThresholdPercent: 5,
    latencyThresholdMs: 3000,
    fasFailureThreshold: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    kv = createMockKV();
    app = buildApp();

    vi.mocked(getAlertConfig).mockResolvedValue(defaultAlertConfig);
    vi.mocked(setAlertConfig).mockResolvedValue(defaultAlertConfig);
    vi.mocked(fireAlert).mockResolvedValue(true);
  });

  function env(overrides?: Partial<Record<string, unknown>>) {
    return {
      KV: kv,
      ALERT_WEBHOOK_URL: "",
      ...overrides,
    };
  }

  describe("GET /admin/alerting/config", () => {
    it("returns alert config", async () => {
      const res = await app.request("/admin/alerting/config", {}, env());

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<AlertConfig>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(defaultAlertConfig);
      expect(body.timestamp).toEqual(expect.any(String));
      expect(vi.mocked(getAlertConfig)).toHaveBeenCalledWith(kv);
    });
  });

  describe("PUT /admin/alerting/config", () => {
    it("returns 400 for malformed JSON body", async () => {
      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "{invalid",
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_JSON");
    });

    it("updates alert config with valid keys", async () => {
      const updatePayload = {
        webhookUrl: "https://hooks.slack.com/services/test",
        cooldownSeconds: 600,
        enabled: false,
        errorRateThresholdPercent: 3.5,
        latencyThresholdMs: 5000,
        fasFailureThreshold: 2,
      };

      const updatedConfig: AlertConfig = {
        ...defaultAlertConfig,
        ...updatePayload,
      };
      vi.mocked(setAlertConfig).mockResolvedValue(updatedConfig);

      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        },
        env(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<AlertConfig>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(updatedConfig);
      expect(body.timestamp).toEqual(expect.any(String));
      expect(vi.mocked(setAlertConfig)).toHaveBeenCalledWith(kv, updatePayload);
    });

    it("filters out unknown keys from payload", async () => {
      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl: "https://example.com/new",
            unknownKey: "drop-me",
          }),
        },
        env(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<AlertConfig>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual(defaultAlertConfig);
      expect(vi.mocked(setAlertConfig)).toHaveBeenCalledWith(kv, {
        webhookUrl: "https://example.com/new",
      });
    });

    it("validates cooldownSeconds range", async () => {
      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cooldownSeconds: 59 }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("cooldownSeconds");
    });

    it("validates errorRateThresholdPercent range", async () => {
      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ errorRateThresholdPercent: 100.1 }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("errorRateThresholdPercent");
    });

    it("validates latencyThresholdMs range", async () => {
      const res = await app.request(
        "/admin/alerting/config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latencyThresholdMs: 90 }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("latencyThresholdMs");
    });
  });

  describe("POST /admin/alerting/test", () => {
    it("returns 503 when no webhook URL is configured", async () => {
      vi.mocked(getAlertConfig).mockResolvedValue({
        ...defaultAlertConfig,
        webhookUrl: "",
      });

      const res = await app.request(
        "/admin/alerting/test",
        { method: "POST" },
        env({ ALERT_WEBHOOK_URL: "" }),
      );

      expect(res.status).toBe(503);
      expect(vi.mocked(fireAlert)).not.toHaveBeenCalled();
    });

    it("returns 502 when webhook delivery fails", async () => {
      vi.mocked(fireAlert).mockResolvedValue(false);

      const res = await app.request(
        "/admin/alerting/test",
        { method: "POST" },
        env(),
      );

      expect(res.status).toBe(502);
    });

    it("fires test alert successfully", async () => {
      vi.mocked(getAlertConfig).mockResolvedValue({
        ...defaultAlertConfig,
        webhookUrl: "",
      });

      const res = await app.request(
        "/admin/alerting/test",
        { method: "POST" },
        env({ ALERT_WEBHOOK_URL: "https://fallback.example/webhook" }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<{
        delivered: boolean;
      }>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ delivered: true });

      expect(vi.mocked(fireAlert)).toHaveBeenCalledWith(
        kv,
        expect.objectContaining({
          type: "HIGH_ERROR_RATE",
          severity: "info",
          title: "Test Alert from 송도세브란스",
          metadata: expect.objectContaining({
            test: true,
            triggeredBy: "Test User",
          }),
        }),
        "https://fallback.example/webhook",
      );
    });

    it("returns 500 when fireAlert throws", async () => {
      vi.mocked(fireAlert).mockRejectedValue(new Error("webhook crashed"));

      const res = await app.request(
        "/admin/alerting/test",
        { method: "POST" },
        env(),
      );

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain("Internal Server Error");
    });
  });

  describe("GET /admin/maintenance", () => {
    it("returns active maintenance when message exists", async () => {
      await kv.put(
        "maintenance-message",
        JSON.stringify({ message: "점검 공지", severity: "warning" }),
      );

      const res = await app.request("/admin/maintenance", {}, env());

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<{
        active: boolean;
        message: string | null;
        severity: string | null;
      }>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        active: true,
        message: "점검 공지",
        severity: "warning",
      });
    });

    it("returns null message when no maintenance entry", async () => {
      const res = await app.request("/admin/maintenance", {}, env());

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<{
        active: boolean;
        message: string | null;
        severity: string | null;
      }>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        active: false,
        message: null,
        severity: null,
      });
    });
  });

  describe("PUT /admin/maintenance", () => {
    it("returns 400 for malformed JSON body", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "{invalid",
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("INVALID_JSON");
    });

    it("sets maintenance message successfully", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "시스템 점검 중입니다",
            severity: "critical",
            ttlSeconds: 3600,
          }),
        },
        env(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<{
        active: boolean;
        message: string;
        severity: string;
        ttlSeconds: number;
      }>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({
        active: true,
        message: "시스템 점검 중입니다",
        severity: "critical",
        ttlSeconds: 3600,
      });
      expect(kv.put).toHaveBeenCalledWith(
        "maintenance-message",
        JSON.stringify({
          message: "시스템 점검 중입니다",
          severity: "critical",
        }),
        { expirationTtl: 3600 },
      );
    });

    it("rejects missing message field", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ severity: "info" }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("message is required");
    });

    it("rejects message longer than 500 chars", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "m".repeat(501) }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("500 characters or less");
    });

    it("rejects invalid severity", async () => {
      const res = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "notice", severity: "urgent" }),
        },
        env(),
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("severity must be warning");
    });

    it("rejects ttlSeconds outside 60-604800", async () => {
      const lowRes = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "notice", ttlSeconds: 59 }),
        },
        env(),
      );

      expect(lowRes.status).toBe(400);
      const lowBody = (await lowRes.json()) as ErrorResponse;
      expect(lowBody.success).toBe(false);
      expect(lowBody.error.code).toBe("VALIDATION_ERROR");

      const highRes = await app.request(
        "/admin/maintenance",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "notice", ttlSeconds: 604801 }),
        },
        env(),
      );

      expect(highRes.status).toBe(400);
      const highBody = (await highRes.json()) as ErrorResponse;
      expect(highBody.success).toBe(false);
      expect(highBody.error.code).toBe("VALIDATION_ERROR");
      expect(highBody.error.message).toContain(
        "ttlSeconds must be between 60 and 604800",
      );
    });
  });

  describe("DELETE /admin/maintenance", () => {
    it("clears maintenance state", async () => {
      await kv.put("maintenance-message", "temporary notice");

      const res = await app.request(
        "/admin/maintenance",
        { method: "DELETE" },
        env(),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as SuccessResponse<{ active: boolean }>;
      expect(body.success).toBe(true);
      expect(body.data).toEqual({ active: false });
      expect(kv.delete).toHaveBeenCalledWith("maintenance-message");
    });
  });
});
