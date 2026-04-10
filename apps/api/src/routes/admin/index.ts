import { Hono } from "hono";
import type { Env } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/permission";
import usersApp from "./users";
import exportApp from "./export";
import fasApp from "./fas";
import postsApp from "./posts";
import auditApp from "./audit";
import attendanceApp from "./attendance/index";
import statsApp from "./stats";
import trendsApp from "./trends";
import votesApp from "./votes";
import accessPoliciesApp from "./access-policies";
import syncErrorsApp from "./sync-errors";
import recommendationsApp from "./recommendations";
import monitoringApp from "./monitoring";
import imagesApp from "./images";
import alertingApp from "./alerting";
import settlementsApp from "./settlements";
import distributionsApp from "./distributions";
import educationApp from "./education";
import pointsApp from "./points";

const app = new Hono<{ Bindings: Env }>();

// Auth + role middleware for all admin routes
app.use("*", authMiddleware);
app.use("*", requireRole("SITE_ADMIN", "SUPER_ADMIN"));

// Mount sub-routers
app.route("/", usersApp);
app.route("/", exportApp);
app.route("/", fasApp);
app.route("/", postsApp);
app.route("/", auditApp);
app.route("/", attendanceApp);
app.route("/", statsApp);
app.route("/", trendsApp);
app.route("/", votesApp);
app.route("/", accessPoliciesApp);
app.route("/", syncErrorsApp);
app.route("/", recommendationsApp);
app.route("/", monitoringApp);
app.route("/", imagesApp);
app.route("/", alertingApp);
app.route("/", settlementsApp);
app.route("/", distributionsApp);
app.route("/", educationApp);
app.route("/", pointsApp);

export default app;
