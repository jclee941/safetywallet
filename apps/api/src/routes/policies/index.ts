import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import crudRoutes from "./crud-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", crudRoutes);

export default app;
