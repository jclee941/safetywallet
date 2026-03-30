import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Env, AuthContext } from "../../types";
import { logAuditWithContext } from "../../lib/audit";
import { success, error } from "../../lib/response";
import {
  disputes,
  users,
  sites,
  siteMemberships,
  disputeStatusEnum,
  disputeTypeEnum,
} from "../../db/schema";
import { CreateDisputeSchema } from "../../validators/schemas";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.post("/", zValidator("json", CreateDisputeSchema as never), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const body: z.infer<typeof CreateDisputeSchema> = c.req.valid("json");

  if (!body.siteId || !body.type || !body.title || !body.description) {
    return error(c, "VALIDATION_ERROR", "Missing required fields", 400);
  }

  if (!disputeTypeEnum.includes(body.type)) {
    return error(c, "VALIDATION_ERROR", "Invalid dispute type", 400);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, body.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return error(c, "FORBIDDEN", "Not a member of this site", 403);
  }

  const [dispute] = await db
    .insert(disputes)
    .values({
      siteId: body.siteId,
      userId: user.id,
      type: body.type,
      title: body.title,
      description: body.description,
      refReviewId: body.refReviewId,
      refPointsLedgerId: body.refPointsLedgerId,
      refAttendanceId: body.refAttendanceId,
    })
    .returning();

  try {
    await logAuditWithContext(
      c,
      db,
      "DISPUTE_CREATED",
      user.id,
      "DISPUTE",
      dispute.id,
      {
        siteId: body.siteId,
        type: body.type,
      },
    );
  } catch {
    // Do not block successful dispute creation on audit failure.
  }

  return success(c, dispute, 201);
});

// GET / - List disputes for current user (alias for /my)
app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20") || 20, 100);
  const offset = parseInt(c.req.query("offset") || "0") || 0;
  const status = c.req.query("status") as
    | (typeof disputeStatusEnum)[number]
    | undefined;

  const conditions = [eq(disputes.userId, user.id)];
  if (status) {
    conditions.push(eq(disputes.status, status));
  }

  const records = await db
    .select()
    .from(disputes)
    .where(and(...conditions))
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset);

  return success(c, { disputes: records, limit, offset });
});

app.get("/my", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20") || 20, 100);
  const offset = parseInt(c.req.query("offset") || "0") || 0;
  const status = c.req.query("status") as
    | (typeof disputeStatusEnum)[number]
    | undefined;

  let whereCondition = eq(disputes.userId, user.id);
  if (status) {
    whereCondition = and(whereCondition, eq(disputes.status, status))!;
  }

  const results = await db
    .select({
      id: disputes.id,
      siteId: disputes.siteId,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      description: disputes.description,
      resolutionNote: disputes.resolutionNote,
      resolvedAt: disputes.resolvedAt,
      createdAt: disputes.createdAt,
      siteName: sites.name,
    })
    .from(disputes)
    .leftJoin(sites, eq(disputes.siteId, sites.id))
    .where(whereCondition)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: results,
    pagination: { limit, offset, count: results.length },
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const disputeId = c.req.param("id");

  const dispute = await db
    .select({
      id: disputes.id,
      siteId: disputes.siteId,
      userId: disputes.userId,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      description: disputes.description,
      refReviewId: disputes.refReviewId,
      refPointsLedgerId: disputes.refPointsLedgerId,
      refAttendanceId: disputes.refAttendanceId,
      resolutionNote: disputes.resolutionNote,
      resolvedAt: disputes.resolvedAt,
      resolvedById: disputes.resolvedById,
      createdAt: disputes.createdAt,
      siteName: sites.name,
      userName: users.name,
    })
    .from(disputes)
    .leftJoin(sites, eq(disputes.siteId, sites.id))
    .leftJoin(users, eq(disputes.userId, users.id))
    .where(eq(disputes.id, disputeId))
    .get();

  if (!dispute) {
    return error(c, "NOT_FOUND", "Dispute not found", 404);
  }

  const isOwner = dispute.userId === user.id;
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SITE_ADMIN";

  if (!isOwner && !isAdmin) {
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
      return error(c, "FORBIDDEN", "Not authorized to view this dispute", 403);
    }
  }

  return success(c, dispute);
});

app.get("/site/:siteId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20") || 20, 100);
  const offset = parseInt(c.req.query("offset") || "0") || 0;
  const status = c.req.query("status") as
    | (typeof disputeStatusEnum)[number]
    | undefined;

  if (user.role !== "SUPER_ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "Admin access required", 403);
    }
  }

  let whereCondition = eq(disputes.siteId, siteId);
  if (status) {
    whereCondition = and(whereCondition, eq(disputes.status, status))!;
  }

  const results = await db
    .select({
      id: disputes.id,
      type: disputes.type,
      status: disputes.status,
      title: disputes.title,
      createdAt: disputes.createdAt,
      userName: users.name,
    })
    .from(disputes)
    .leftJoin(users, eq(disputes.userId, users.id))
    .where(whereCondition)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: results,
    pagination: { limit, offset, count: results.length },
  });
});

export default app;
