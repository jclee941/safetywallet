import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth";
import type { Env, AuthContext } from "../../types";
import uploadRoutes from "./upload-routes";
import infoRoutes from "./info-routes";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

app.route("/", uploadRoutes);
app.route("/", infoRoutes);

export default app;
