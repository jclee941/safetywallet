import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import type { Env, AuthContext } from "../../types";
import crudRoutes from "./crud-routes";
import actionRoutes from "./action-routes";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", crudRoutes);
app.route("/", actionRoutes);

export default app;
