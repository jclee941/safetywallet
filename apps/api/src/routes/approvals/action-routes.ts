import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lt } from "drizzle-orm";
import * as schema from "../../db/schema";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";
import { logAuditWithContext } from "../../lib/audit";
import { isSiteAdmin } from "./helpers";

const { manualApprovals, attendance } = schema;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

// Approve request
app.post("/:id/approve", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { user: approver } = c.get("auth");
  const id = c.req.param("id");

  if (approver.role === "WORKER") {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  const approval = await db.query.manualApprovals.findFirst({
    where: eq(manualApprovals.id, id),
  });

  if (!approval) {
    return error(c, "NOT_FOUND", "Approval request not found", 404);
  }

  if (
    approval.siteId &&
    !(await isSiteAdmin(db, approver.id, approval.siteId))
  ) {
    return error(c, "FORBIDDEN", "Forbidden", 403);
  }

  if (approval.status !== "PENDING") {
    return error(c, "INVALID_STATUS", "Request is not pending", 400);
  }

  const updatedApproval = await db
    .update(manualApprovals)
    .set({
      status: "APPROVED",
      approvedById: approver.id,
      approvedAt: new Date(),
    })
    .where(
      and(eq(manualApprovals.id, id), eq(manualApprovals.status, "PENDING")),
    )
    .returning({ id: manualApprovals.id })
    .get();

  if (!updatedApproval) {
    return error(c, "CONFLICT", "Approval request was already processed", 409);
  }

  const existingAttendance = await db.query.attendance.findFirst({
    where: and(
      eq(attendance.userId, approval.userId),
      eq(attendance.siteId, approval.siteId),
      gte(attendance.checkinAt, approval.validDate),
      lt(
        attendance.checkinAt,
        new Date(approval.validDate.getTime() + 24 * 60 * 60 * 1000),
      ),
    ),
  });

  if (!existingAttendance) {
    try {
      await db.insert(attendance).values({
        userId: approval.userId,
        siteId: approval.siteId,
        checkinAt: approval.validDate,
        result: "SUCCESS",
        source: "MANUAL",
      });
    } catch {
      // Race condition: another request already inserted attendance
      // This is safe to ignore — the record exists either way
    }
  }

  await logAuditWithContext(
    c,
    db,
    "MANUAL_APPROVAL_APPROVED",
    approver.id,
    "MANUAL_APPROVAL",
    id,
    { reason: "Approved via UI" },
  );

  return success(c, { success: true });
});

// Reject request
app.post(
  "/:id/reject",
  zValidator(
    "json",
    z.object({
      reason: z.string().min(1, "Rejection reason is required"),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const { user: approver } = c.get("auth");
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");

    if (approver.role === "WORKER") {
      return error(c, "FORBIDDEN", "Forbidden", 403);
    }

    const approval = await db.query.manualApprovals.findFirst({
      where: eq(manualApprovals.id, id),
    });

    if (!approval) {
      return error(c, "NOT_FOUND", "Approval request not found", 404);
    }

    if (
      approval.siteId &&
      !(await isSiteAdmin(db, approver.id, approval.siteId))
    ) {
      return error(c, "FORBIDDEN", "Forbidden", 403);
    }

    if (approval.status !== "PENDING") {
      return error(c, "INVALID_STATUS", "Request is not pending", 400);
    }

    const updatedApproval = await db
      .update(manualApprovals)
      .set({
        status: "REJECTED",
        approvedById: approver.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(
        and(eq(manualApprovals.id, id), eq(manualApprovals.status, "PENDING")),
      )
      .returning({ id: manualApprovals.id })
      .get();

    if (!updatedApproval) {
      return error(
        c,
        "CONFLICT",
        "Approval request was already processed",
        409,
      );
    }

    await logAuditWithContext(
      c,
      db,
      "MANUAL_APPROVAL_REJECTED",
      approver.id,
      "MANUAL_APPROVAL",
      id,
      { reason },
    );

    return success(c, { success: true });
  },
);

export default app;
