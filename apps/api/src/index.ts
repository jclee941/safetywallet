import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { drizzle } from "drizzle-orm/d1";
import { fasGetAllEmployeesPaginated, initFasConfig } from "./lib/fas";
import {
  syncFasEmployeesToD1,
  deactivateRetiredEmployees,
} from "./lib/fas-sync";
import type { Env } from "./types";
import { success, error } from "./lib/response";
import { buildHtmlCsp, generateNonce } from "./lib/csp";

import auth from "./routes/auth";
import attendanceRoute from "./routes/attendance";
import votesRoute from "./routes/votes";
import postsRoute from "./routes/posts";
import actionsRoute from "./routes/actions";
import usersRoute from "./routes/users";
import sitesRoute from "./routes/sites";
import announcementsRoute from "./routes/announcements";
import adminRoute from "./routes/admin";
import pointsRoute from "./routes/points";
import reviewsRoute from "./routes/reviews";
import fasRoute from "./routes/fas";
import disputesRoute from "./routes/disputes";

import policiesRoute from "./routes/policies";
import approvalsRoute from "./routes/approvals";
import educationRoute from "./routes/education";
import recommendationsRoute from "./routes/recommendations";
import imagesRoute from "./routes/images";
import notificationsRoute from "./routes/notifications";
import { securityHeaders } from "./middleware/security-headers";
import { analyticsMiddleware } from "./middleware/analytics";
import { requestLoggerMiddleware } from "./middleware/request-logger";

import { createLogger } from "./lib/logger";
import { createErrorIssue } from "./lib/auto-issue";
import { authMiddleware } from "./middleware/auth";

const logger = createLogger("index");
const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  initFasConfig(c.env);
  await next();
});
app.use("*", securityHeaders);
app.use("*", requestLoggerMiddleware);
app.use("*", analyticsMiddleware);
app.use("*", honoLogger());
app.use("*", async (c, next) => {
  const allowedCsv = c.env.ALLOWED_ORIGINS ?? "";
  const allowedOrigins = allowedCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const corsMiddleware = cors({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) return origin;
      // Only allow localhost in non-production environments
      if (c.env.ENVIRONMENT !== "production") {
        if (
          origin.startsWith("http://localhost:") ||
          origin.startsWith("http://127.0.0.1:")
        ) {
          return origin;
        }
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Device-Id", "X-Device-Id"],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

const api = new Hono<{ Bindings: Env }>();
const schedulerAdmin = new Hono<{ Bindings: Env }>();

api.get("/health", (c) => {
  return success(c, { status: "healthy" });
});

// Public system status endpoint for Worker App outage/maintenance banner
api.get("/system/status", async (c) => {
  const notices: Array<{
    type: "fas_down" | "maintenance" | "info";
    message: string;
    severity: "warning" | "critical" | "info";
  }> = [];

  try {
    const [fasStatus, maintenanceMessage] = await Promise.all([
      c.env.KV.get("fas-status"),
      c.env.KV.get("maintenance-message"),
    ]);

    if (fasStatus === "down") {
      notices.push({
        type: "fas_down",
        message:
          "출퇴근 시스템(FAS)에 일시적인 장애가 발생했습니다. 출근 확인 없이 일부 기능을 이용하실 수 있습니다.",
        severity: "warning",
      });
    }

    if (maintenanceMessage) {
      try {
        const parsed = JSON.parse(maintenanceMessage) as {
          message: string;
          severity?: "warning" | "critical" | "info";
        };
        notices.push({
          type: "maintenance",
          message: parsed.message,
          severity: parsed.severity ?? "info",
        });
      } catch {
        notices.push({
          type: "maintenance",
          message: maintenanceMessage,
          severity: "info",
        });
      }
    }
  } catch (err) {
    logger.warn("KV notices read failed, returning empty notices", {
      error: { name: "KVError", message: String(err) },
    });
  }

  return c.json({
    success: true,
    data: { notices, hasIssues: notices.length > 0 },
    timestamp: new Date().toISOString(),
  });
});

// Admin-only: Bulk sync FAS employees to D1 (paginated to avoid Workers CPU limit)
api.post("/fas-sync", async (c) => {
  const body = await c.req.json<{
    secret?: string;
    offset?: number;
    limit?: number;
  }>();
  if (!c.env.FAS_SYNC_SECRET || body.secret !== c.env.FAS_SYNC_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!c.env.FAS_HYPERDRIVE) {
    return error(c, "SERVICE_UNAVAILABLE", "FAS_HYPERDRIVE not available", 503);
  }

  const batchSize = body.limit ?? 100;
  const offset = body.offset ?? 0;

  try {
    const db = drizzle(c.env.DB);
    const { employees: batch, total: totalFas } =
      await fasGetAllEmployeesPaginated(
        c.env.FAS_HYPERDRIVE,
        offset,
        batchSize,
      );

    const activeEmployees = batch.filter((e) => e.stateFlag === "W");
    const retiredEmplCds = batch
      .filter((e) => e.stateFlag !== "W")
      .map((e) => e.emplCd);

    const syncResult = await syncFasEmployeesToD1(activeEmployees, db, {
      HMAC_SECRET: c.env.HMAC_SECRET,
      ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
    });

    let deactivated = 0;
    if (retiredEmplCds.length > 0) {
      deactivated = await deactivateRetiredEmployees(retiredEmplCds, db);
    }

    const hasMore = batch.length === batchSize;
    return c.json({
      success: true,
      totalFas,
      batch: { offset, limit: batchSize, processed: batch.length },
      active: activeEmployees.length,
      retired: retiredEmplCds.length,
      sync: syncResult,
      deactivated,
      hasMore,
      nextOffset: hasMore ? offset + batchSize : null,
    });
  } catch (err: unknown) {
    return error(c, "INTERNAL_ERROR", "FAS sync failed", 500);
  }
});

schedulerAdmin.use("*", authMiddleware);
schedulerAdmin.post("/", async (c) => {
  const schedulerBinding = c.env.JOB_SCHEDULER;
  if (!schedulerBinding) {
    return c.json(
      { success: false, error: "JOB_SCHEDULER not configured" },
      503,
    );
  }

  const id = schedulerBinding.idFromName("global");
  const stub = schedulerBinding.get(id);
  const rawBody = await c.req.text();
  const response = await stub.fetch("https://job-scheduler/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody.length > 0 ? rawBody : JSON.stringify({ action: "status" }),
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

api.route("/admin/scheduler", schedulerAdmin);

api.route("/auth", auth);
api.route("/attendance", attendanceRoute);
api.route("/votes", votesRoute);
api.route("/recommendations", recommendationsRoute);
api.route("/posts", postsRoute);
api.route("/actions", actionsRoute);
api.route("/users", usersRoute);
api.route("/sites", sitesRoute);
api.route("/announcements", announcementsRoute);
api.route("/admin", adminRoute);
api.route("/points", pointsRoute);
api.route("/reviews", reviewsRoute);
api.route("/fas", fasRoute);
api.route("/disputes", disputesRoute);

api.route("/policies", policiesRoute);
api.route("/approvals", approvalsRoute);
api.route("/education", educationRoute);
api.route("/images", imagesRoute);
api.route("/notifications", notificationsRoute);

// Catch-all for unmatched API routes — return 404 JSON instead of SPA HTML
api.all("*", (c) => {
  return error(
    c,
    "NOT_FOUND",
    `Route not found: ${c.req.method} ${c.req.path}`,
    404,
  );
});

app.route("/api", api);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const getMimeType = (path: string): string => {
  const ext = path.substring(path.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
};

const isHtmlResponse = (response: Response): boolean => {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
};

const applyHtmlNonce = (response: Response): Response => {
  const nonce = generateNonce();
  const rewriter = new HTMLRewriter()
    .on("script:not([src])", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    })
    .on("style", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    });
  const rewritten = rewriter.transform(response);
  const headers = new Headers(rewritten.headers);

  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Security-Policy", buildHtmlCsp(nonce));

  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  });
};

// R2 image/video serving — public, no auth required
app.get("/r2/*", async (c) => {
  const key = c.req.path.replace(/^\/r2\//, "");
  if (!key) {
    return error(c, "NOT_FOUND", "Missing R2 key", 404);
  }

  const object = await c.env.R2.get(key);
  if (!object) {
    return error(c, "NOT_FOUND", "File not found", 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType || getMimeType(key),
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);

  // Support conditional requests (304 Not Modified)
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { status: 200, headers });
});

// Static SPA serving — hostname-based routing:
//   admin.safetywallet.jclee.me → serves /admin/index.html on 404
//   safetywallet.jclee.me       → serves /index.html on 404
// Note: with Workers Static Assets and run_worker_first = true,
// missing assets are intercepted here instead of returning 404
app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const isAdmin = url.hostname.startsWith("admin.");

  // Redirect /admin/* on non-admin hostname to admin subdomain
  if (!isAdmin && url.pathname.startsWith("/admin")) {
    const adminUrl = new URL(
      url.pathname.replace(/^\/admin/, "") || "/",
      `${url.protocol}//admin.${url.hostname}`,
    );
    adminUrl.search = url.search;
    return c.redirect(adminUrl.toString(), 301);
  }

  // Clean up path logic for SPA routing
  let path = url.pathname;
  if (path.endsWith("/")) {
    path += "index.html";
  } else if (!path.includes(".")) {
    path += "/index.html";
  }

  // Prepend admin/ if it's the admin hostname
  const targetPath = isAdmin ? `/admin${path}` : path;
  const targetUrl = new URL(targetPath, c.req.url);

  try {
    // Try to fetch the requested asset
    let response = await c.env.ASSETS.fetch(targetUrl);

    if (response.status === 200 && isHtmlResponse(response)) {
      return applyHtmlNonce(response);
    }

    // SPA Fallback: If not found, serve the index.html for that specific app
    if (response.status === 404) {
      const fallbackPath = isAdmin ? "/admin/index.html" : "/index.html";
      const fallbackUrl = new URL(fallbackPath, c.req.url);
      response = await c.env.ASSETS.fetch(fallbackUrl);

      // Override headers for SPA entry points to prevent caching
      if (response.status === 200) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Content-Type", "text/html");
        return applyHtmlNonce(newResponse);
      }
    }

    // Add aggressive caching for immutable static assets (JS/CSS)
    if (
      response.status === 200 &&
      path.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|gif|ico)$/)
    ) {
      const newResponse = new Response(response.body, response);
      newResponse.headers.set(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
      return newResponse;
    }

    return response;
  } catch (err) {
    logger.error("Static serve error", {
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : { name: "UnknownError", message: String(err) },
      hostname: url.hostname,
    });
    return error(c, "INTERNAL_ERROR", "Internal Server Error", 500);
  }
});

app.onError((err, c) => {
  const log = createLogger("onError", {
    elasticsearchUrl: c.env.ELASTICSEARCH_URL,
    elasticsearchIndexPrefix: c.env.ELASTICSEARCH_INDEX_PREFIX,
    elasticsearchApiKey: c.env.ELASTICSEARCH_API_KEY,
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  });

  log.error(err.message, err, {
    endpoint: c.req.path,
    method: c.req.method,
  });

  // Auto-create GitLab issue for unhandled (non-HTTP) errors
  if (!(err instanceof Error && "getResponse" in err) && c.env.GITLAB_TOKEN) {
    c.executionCtx.waitUntil(
      createErrorIssue({
        error: err instanceof Error ? err : new Error(String(err)),
        endpoint: c.req.path,
        method: c.req.method,
        gitlabToken: c.env.GITLAB_TOKEN,
        kv: c.env.KV,
      }),
    );
  }
  // Handle HTTPException properly (auth errors, validation errors, etc.)
  if (err instanceof Error && "getResponse" in err) {
    const httpErr = err as { status?: number; message: string };
    const status = (httpErr.status || 500) as 401 | 403 | 500;
    return c.json(
      {
        success: false,
        error: {
          code:
            status === 401
              ? "UNAUTHORIZED"
              : status === 403
                ? "FORBIDDEN"
                : "ERROR",
          message: httpErr.message,
        },
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          c.env.ENVIRONMENT === "development"
            ? err.message
            : "An error occurred",
      },
      timestamp: new Date().toISOString(),
    },
    500,
  );
});

import {
  processNotificationBatch,
  type NotificationQueueMessage,
} from "./lib/notification-queue";

export { RateLimiter } from "./durable-objects/RateLimiter";
export { JobScheduler } from "./durable-objects/JobScheduler";
export { app };

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<NotificationQueueMessage>,
    env: Env,
  ): Promise<void> {
    await processNotificationBatch(batch, env);
  },
};
