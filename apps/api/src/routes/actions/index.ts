import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { attendanceMiddleware } from "../../middleware/attendance";
import crudRoutes from "./crud-routes";
import imageRoutes from "./images";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);
app.use("*", attendanceMiddleware);

app.route("/", crudRoutes);
app.route("/", imageRoutes);

export const actions = app;

export default actions;
