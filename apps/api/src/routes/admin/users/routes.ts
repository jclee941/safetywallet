import { Hono } from "hono";
import type { Env, AuthContext } from "../../../types";
import { userManagementRouter } from "./user-management";
import { userLockRouter } from "./user-lock";
import { userPurgeRouter } from "./user-purge";

export const router = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// Mount all user management sub-routers
router.route("/", userManagementRouter);
router.route("/", userLockRouter);
router.route("/", userPurgeRouter);
