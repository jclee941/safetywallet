import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { votePeriods, auditLogs } from "../../db/schema";
import { AdminCreateVotePeriodSchema } from "../../validators/schemas";
import { success, error } from "../../lib/response";
import { requireAdmin } from "./helpers";
import { createLogger } from "../../lib/logger";

const logger = createLogger("admin/votes-periods");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/votes/period/:siteId/:month", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.param("siteId");
  const month = c.req.param("month");
  if (!siteId || !month) {
    return error(c, "BAD_REQUEST", "Site ID and month are required", 400);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
  }

  const period = await db
    .select()
    .from(votePeriods)
    .where(and(eq(votePeriods.siteId, siteId), eq(votePeriods.month, month)))
    .get();

  return success(c, { period: period || null });
});

app.put(
  "/votes/period/:siteId/:month",
  requireAdmin,
  zValidator("json", AdminCreateVotePeriodSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const siteId = c.req.param("siteId");
    const month = c.req.param("month");

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
    }

    const body: z.infer<typeof AdminCreateVotePeriodSchema> =
      c.req.valid("json");

    if (!body.startDate || !body.endDate) {
      return error(
        c,
        "MISSING_FIELDS",
        "startDate and endDate are required",
        400,
      );
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return error(c, "INVALID_DATE", "Invalid date format", 400);
    }
    if (start >= end) {
      return error(c, "INVALID_RANGE", "startDate must be before endDate", 400);
    }

    const existing = await db
      .select()
      .from(votePeriods)
      .where(and(eq(votePeriods.siteId, siteId), eq(votePeriods.month, month)))
      .get();

    let period: typeof votePeriods.$inferSelect | undefined;
    if (existing) {
      period = await db
        .update(votePeriods)
        .set({
          startDate: Math.floor(new Date(body.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(body.endDate).getTime() / 1000),
        })
        .where(eq(votePeriods.id, existing.id))
        .returning()
        .get();
    } else {
      period = await db
        .insert(votePeriods)
        .values({
          siteId,
          month,
          startDate: Math.floor(new Date(body.startDate).getTime() / 1000),
          endDate: Math.floor(new Date(body.endDate).getTime() / 1000),
        })
        .returning()
        .get();
    }

    if (!period) {
      return error(
        c,
        "VOTE_PERIOD_UPDATE_FAILED",
        "Failed to update vote period",
        500,
      );
    }

    try {
      await db.insert(auditLogs).values({
        action: "VOTE_PERIOD_UPDATED",
        actorId: currentUser.id,
        targetType: "VOTE_PERIOD",
        targetId: period.id,
        reason: `Set vote period for ${month}: ${body.startDate} ~ ${body.endDate}`,
      });
    } catch (error) {
      logger.error("Failed to write vote-period audit log", error);
    }

    return success(c, { period });
  },
);

export default app;
