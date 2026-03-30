import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authRateLimitMiddleware } from "../../middleware/rate-limit";
import { turnstileMiddleware } from "../../middleware/turnstile";
import { AdminLoginSchema, LoginSchema } from "../../validators/schemas";
import type { AuthContext, Env } from "../../types";
import { handleAdminLogin } from "./login-admin";
import { handleWorkerLogin } from "./login-worker";

const loginRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

loginRoute.post(
  "/login",
  authRateLimitMiddleware(),
  turnstileMiddleware(),
  zValidator("json", LoginSchema),
  async (c) => {
    const body = (() => {
      try {
        return c.req.valid("json");
      } catch {
        return null;
      }
    })();
    return handleWorkerLogin(c, body);
  },
);

loginRoute.post(
  "/admin/login",
  authRateLimitMiddleware(),
  zValidator("json", AdminLoginSchema),
  async (c) => {
    const body = (() => {
      try {
        return c.req.valid("json");
      } catch {
        return null;
      }
    })();
    return handleAdminLogin(c, body);
  },
);

export default loginRoute;
