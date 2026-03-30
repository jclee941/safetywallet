import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import * as schema from "../../db/schema";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";

const { manualApprovals } = schema;

const APPROVAL_STATUSES = new Set(schema.approvalStatusEnum);

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// List approvals (pending by default, or filtered)
app.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");
  const status = c.req.query("status"); // PENDING, APPROVED, REJECTED
  const date = c.req.query("date");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  // Permission check: Site Admin or Super Admin
  if (user.role === "WORKER") {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  const conditions = [];
  if (siteId) conditions.push(eq(manualApprovals.siteId, siteId));
  if (status) {
    const normalizedStatus = status.toUpperCase();

    if (
      !APPROVAL_STATUSES.has(
        normalizedStatus as (typeof schema.approvalStatusEnum)[number],
      )
    ) {
      return error(c, "INVALID_STATUS", "Invalid status filter", 400);
    }

    conditions.push(
      eq(
        manualApprovals.status,
        normalizedStatus as (typeof schema.approvalStatusEnum)[number],
      ),
    );
  }

  if (date) {
    const targetDate = new Date(date);
    if (!isNaN(targetDate.getTime())) {
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      conditions.push(
        and(
          gte(manualApprovals.validDate, targetDate),
          lt(manualApprovals.validDate, nextDay),
        ),
      );
    }
  }

  const approvalList = await db.query.manualApprovals.findMany({
    limit,
    offset,
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: desc(manualApprovals.createdAt),
    with: {
      user: true,
      approvedBy: true,
      site: true,
    },
  });

  return success(c, {
    data: approvalList,
    pagination: {
      limit,
      offset,
      count: approvalList.length,
    },
  });
});

export default app;
