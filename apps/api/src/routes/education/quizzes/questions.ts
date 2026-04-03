import { Hono } from "hono";
import type { AppType } from "../helpers";
import questionCrudRoutes from "./questions-crud";
import questionReorderRoutes from "./questions-reorder";

const app = new Hono<AppType>();

app.route("/", questionCrudRoutes);
app.route("/", questionReorderRoutes);

export default app;
