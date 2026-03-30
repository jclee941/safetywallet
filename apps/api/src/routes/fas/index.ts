import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import type { AuthContext, Env } from "../../types";
import syncRoutes from "./sync-routes";
import workerRoutes from "./worker-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);

app.route("/", syncRoutes);
app.route("/", workerRoutes);

export default app;
