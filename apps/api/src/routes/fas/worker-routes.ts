import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import type { AuthContext, Env } from "../../types";
import { users } from "../../db/schema";
import { success, error } from "../../lib/response";

const FAS_EMPLOYEES_LIMIT = 1000;

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// FAS employee listing (admin-only, JWT auth)
app.get("/employees", async (c) => {
  const auth = c.get("auth");
  if (
    auth.user.role !== "SITE_ADMIN" &&
    auth.user.role !== "SITE_ADMIN" &&
    auth.user.role !== "SUPER_ADMIN"
  ) {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }

  const db = drizzle(c.env.DB);
  const employees = await db
    .select({
      id: users.id,
      name: users.name,
      nameMasked: users.nameMasked,
      externalWorkerId: users.externalWorkerId,
    })
    .from(users)
    .where(eq(users.externalSystem, "FAS"))
    .orderBy(desc(users.updatedAt))
    .limit(FAS_EMPLOYEES_LIMIT);

  return success(c, { employees });
});

export default app;
