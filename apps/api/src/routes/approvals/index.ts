import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import type { Env, AuthContext } from "../../types";
import listRoutes from "./list-routes";
import actionRoutes from "./action-routes";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", listRoutes);
app.route("/", actionRoutes);

export default app;
