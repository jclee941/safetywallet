import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import type { Env, AuthContext } from "../../types";
import profileRoutes from "./profile-routes";
import privacyRoutes from "./privacy-routes";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.use("*", authMiddleware);

app.route("/", profileRoutes);
app.route("/", privacyRoutes);

export default app;
