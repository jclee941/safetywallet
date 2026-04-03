import { Hono } from "hono";
import type { AppType } from "../helpers";
import attendanceRoutes from "./attendance";
import aiAnalysisRoutes from "./ai-analysis";
import crudRoutes from "./crud";

const app = new Hono<AppType>();

app.route("/", crudRoutes);
app.route("/", attendanceRoutes);
app.route("/", aiAnalysisRoutes);

export default app;
