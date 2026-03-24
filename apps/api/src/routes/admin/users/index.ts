import { Hono } from "hono";
import type { Env, AuthContext } from "../../../types";
import { router } from "./routes";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// Mount all user management routes
app.route("/", router);

export default app;
