import { Hono } from "hono";
import type { AppType } from "../helpers";
import crudReadRoutes from "./crud-read";
import crudWriteRoutes from "./crud-write";

const app = new Hono<AppType>();

app.route("/", crudReadRoutes);
app.route("/", crudWriteRoutes);

export default app;
