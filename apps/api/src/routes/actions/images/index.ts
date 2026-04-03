import { Hono } from "hono";
import type { Env, AuthContext } from "../../../types";
import { registerUploadRoutes } from "./upload";
import { registerAnalysisRoutes } from "./analysis";
import { registerComparisonRoutes } from "./comparison";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

registerUploadRoutes(app);
registerAnalysisRoutes(app);
registerComparisonRoutes(app);

export default app;
