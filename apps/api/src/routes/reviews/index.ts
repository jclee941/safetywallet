import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import type { Env, AuthContext } from "../../types";
import actionRoutes from "./action-routes";
import queryRoutes from "./query-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", actionRoutes);
app.route("/", queryRoutes);

export default app;
