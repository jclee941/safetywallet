import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../types";
import { logAuditWithContext } from "../../lib/audit";
import { success, error } from "../../lib/response";
import { disputes, siteMemberships, disputeStatusEnum } from "../../db/schema";
import {
  ResolveDisputeSchema,
  UpdateDisputeStatusSchema,
} from "../../validators/schemas";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.patch(
  "/:id/resolve",
  zValidator("json", ResolveDisputeSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const disputeId = c.req.param("id");

    const body: z.infer<typeof ResolveDisputeSchema> = c.req.valid("json");

    if (!body.status || !body.resolutionNote) {
      return error(
        c,
        "VALIDATION_ERROR",
        "Status and resolution note required",
        400,
      );
    }

    if (body.status !== "RESOLVED" && body.status !== "REJECTED") {
      return error(
        c,
        "VALIDATION_ERROR",
        "Status must be RESOLVED or REJECTED",
        400,
      );
    }

    const dispute = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .get();

    if (!dispute) {
      return error(c, "NOT_FOUND", "Dispute not found", 404);
    }

    if (dispute.status !== "OPEN" && dispute.status !== "IN_REVIEW") {
      return error(c, "INVALID_STATE", "Dispute is already resolved", 400);
    }

    if (user.role !== "SUPER_ADMIN") {
      const membership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, dispute.siteId),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      if (!membership) {
        return error(c, "FORBIDDEN", "Admin access required", 403);
      }
    }

    const [updated] = await db
      .update(disputes)
      .set({
        status: body.status,
        resolutionNote: body.resolutionNote,
        resolvedById: user.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId))
      .returning();

    try {
      await logAuditWithContext(
        c,
        db,
        "DISPUTE_RESOLVED",
        user.id,
        "DISPUTE",
        disputeId,
        {
          status: body.status,
          resolutionNote: body.resolutionNote,
        },
      );
    } catch {
      // Do not block successful dispute resolution on audit failure.
    }

    return success(c, updated);
  },
);

app.patch(
  "/:id/status",
  zValidator("json", UpdateDisputeStatusSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const disputeId = c.req.param("id");

    const body: z.infer<typeof UpdateDisputeStatusSchema> = c.req.valid("json");

    if (!body.status || !disputeStatusEnum.includes(body.status)) {
      return error(c, "VALIDATION_ERROR", "Invalid status", 400);
    }

    const dispute = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .get();

    if (!dispute) {
      return error(c, "NOT_FOUND", "Dispute not found", 404);
    }

    if (user.role !== "SUPER_ADMIN") {
      const membership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, dispute.siteId),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      if (!membership) {
        return error(c, "FORBIDDEN", "Admin access required", 403);
      }
    }

    const [updated] = await db
      .update(disputes)
      .set({
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, disputeId))
      .returning();

    await logAuditWithContext(
      c,
      db,
      "DISPUTE_STATUS_CHANGED",
      user.id,
      "DISPUTE",
      disputeId,
      { previousStatus: dispute.status, newStatus: body.status },
    );

    return success(c, updated);
  },
);

export default app;
