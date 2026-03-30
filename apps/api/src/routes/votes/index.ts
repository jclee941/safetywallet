import { Hono } from "hono";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import type { Env, AuthContext } from "../../types";
import queryRoutes from "./query-routes";
import castRoutes from "./cast-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", rateLimitMiddleware());

app.route("/", queryRoutes);
app.route("/", castRoutes);

export default app;
