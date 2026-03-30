import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { rateLimitMiddleware } from "../../middleware/rate-limit";
import subscriptionRoutes from "./subscription-routes";
import sendRoutes from "./send-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);
app.use("*", rateLimitMiddleware());

app.route("/", subscriptionRoutes);
app.route("/", sendRoutes);

export default app;
