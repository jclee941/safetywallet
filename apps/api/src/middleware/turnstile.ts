import type { Context, Next } from "hono";
import type { Env } from "../types";
import { createLogger } from "../lib/logger";

const logger = createLogger("turnstile");

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 10_000;

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

/**
 * Cloudflare Turnstile bot-protection middleware.
 * Validates the turnstileToken field from the request body against the
 * siteverify API. Skips verification in non-production environments or
 * when TURNSTILE_SECRET is not configured.
 */
export function turnstileMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const { ENVIRONMENT, TURNSTILE_SECRET } = c.env;

    // Fail-closed: require verification in production
    if (ENVIRONMENT !== "production") {
      return next();
    }

    if (!TURNSTILE_SECRET) {
      logger.error("TURNSTILE_SECRET not configured in production");
      return c.json(
        {
          success: false,
          error: {
            code: "TURNSTILE_NOT_CONFIGURED",
            message: "Bot protection is not properly configured",
          },
        },
        500,
      );
    }

    const token = await extractToken(c);

    if (!token) {
      logger.warn("Missing turnstile token", {
        endpoint: c.req.path,
        method: c.req.method,
      });
      return c.json(
        {
          success: false,
          error: {
            code: "TURNSTILE_TOKEN_MISSING",
            message: "Turnstile verification token is required",
          },
        },
        400,
      );
    }

    const clientIp = c.req.header("CF-Connecting-IP") ?? "";

    const body = new URLSearchParams();
    body.set("secret", TURNSTILE_SECRET);
    body.set("response", token);
    if (clientIp) {
      body.set("remoteip", clientIp);
    }

    let result: TurnstileVerifyResponse;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

      const response = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.error("Turnstile siteverify HTTP error", {
          statusCode: response.status,
          endpoint: c.req.path,
        });
        return c.json(
          {
            success: false,
            error: {
              code: "TURNSTILE_SERVICE_ERROR",
              message: "Turnstile verification service unavailable",
            },
          },
          403,
        );
      }

      result = (await response.json()) as TurnstileVerifyResponse;
    } catch (err) {
      logger.error("Turnstile verification request failed", {
        error: {
          name: err instanceof Error ? err.name : "Unknown",
          message: err instanceof Error ? err.message : String(err),
        },
        endpoint: c.req.path,
      });
      return c.json(
        {
          success: false,
          error: {
            code: "TURNSTILE_VERIFICATION_FAILED",
            message: "Turnstile verification failed",
          },
        },
        403,
      );
    }

    if (!result.success) {
      logger.warn("Turnstile verification rejected", {
        endpoint: c.req.path,
        method: c.req.method,
        metadata: {
          errorCodes: result["error-codes"],
          hostname: result.hostname,
        },
      });
      return c.json(
        {
          success: false,
          error: {
            code: "TURNSTILE_REJECTED",
            message: "Turnstile verification failed",
          },
        },
        403,
      );
    }

    return next();
  };
}

async function extractToken(c: Context): Promise<string | null> {
  const contentType = c.req.header("Content-Type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const body = await c.req.json();
      return (body as Record<string, unknown>).turnstileToken as string | null;
    }

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await c.req.formData();
      const value = formData.get("turnstileToken");
      return typeof value === "string" ? value : null;
    }
  } catch {
    return null;
  }

  return null;
}
