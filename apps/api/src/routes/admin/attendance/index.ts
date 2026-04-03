import { Hono } from "hono";
import type { Env, AuthContext } from "../../../types";
import logsApp from "./logs";
import unmatchedApp from "./unmatched";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.route("/", logsApp);
app.route("/", unmatchedApp);

export * from "./helpers";
export { logsApp, unmatchedApp };
export default app;
