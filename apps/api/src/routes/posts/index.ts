import { Hono } from "hono";
import type { Env, AuthContext } from "../../types";
import { authMiddleware } from "../../middleware/auth";
import { registerCrudRoutes } from "./crud-routes";
import { registerMediaRoutes } from "./media-routes";
import { registerDeleteRoutes } from "./post-delete";
import { registerAiRoutes } from "./post-ai";

const posts = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

posts.use("*", authMiddleware);

registerCrudRoutes(posts);
registerMediaRoutes(posts);
registerDeleteRoutes(posts);
registerAiRoutes(posts);

export { posts };
export default posts;
