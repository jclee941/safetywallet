import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import awardRoutes from "./award-routes";
import queryRoutes from "./query-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", awardRoutes);
app.route("/", queryRoutes);

export default app;
