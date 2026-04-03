import { Hono } from "hono";
import type { AppType } from "../helpers";
import crudRoutes from "./crud";
import questionRoutes from "./questions";

const app = new Hono<AppType>();

app.route("/", crudRoutes);
app.route("/", questionRoutes);

export default app;
