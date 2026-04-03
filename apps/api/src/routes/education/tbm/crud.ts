import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import {
  siteMemberships,
  tbmAttendees,
  tbmRecords,
  tbmTopicCategoryEnum,
  users,
} from "../../../db/schema";
import { logAuditWithContext } from "../../../lib/audit";
import { error, success } from "../../../lib/response";
import {
  CreateTbmInputSchema,
  TbmRecordFilterSchema,
  UpdateTbmInputSchema,
} from "../../../validators/schemas";
import type { AppType } from "../helpers";
import { enqueueTbmAiJobs } from "./ai-jobs";
import crudDetailRoutes from "./crud-detail";
import {
  getTbmOrNotFound,
  requireSiteAdmin,
  requireSiteMembership,
} from "./shared";

const app = new Hono<AppType>();

app.post("/", zValidator("json", CreateTbmInputSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const body = c.req.valid("json");
  if (!body.siteId || !body.date || !body.topic)
    return error(c, "MISSING_FIELDS", "siteId, date, topic are required", 400);
  if (user.role !== "SUPER_ADMIN") {
    const adminError = await requireSiteAdmin(c, db, user.id, body.siteId);
    if (adminError) return adminError;
  }
  if (body.leaderId) {
    const leaderMembership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, body.leaderId),
          eq(siteMemberships.siteId, body.siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();
    if (!leaderMembership)
      return error(
        c,
        "LEADER_NOT_SITE_MEMBER",
        "leaderId must be an active site member",
        400,
      );
  }
  const tbm = await db
    .insert(tbmRecords)
    .values({
      siteId: body.siteId,
      date: Math.floor(new Date(body.date).getTime() / 1000),
      topic: body.topic,
      topicCategory: body.topicCategory ?? null,
      content: body.content ?? null,
      leaderId: body.leaderId ?? user.id,
      weatherCondition: body.weatherCondition ?? null,
      specialNotes: body.specialNotes ?? null,
    })
    .returning()
    .get();
  await logAuditWithContext(
    c,
    db,
    "TBM_CREATED",
    user.id,
    "TBM_RECORD",
    tbm.id,
    { siteId: tbm.siteId, topic: tbm.topic, date: tbm.date },
  );
  enqueueTbmAiJobs(c, {
    id: tbm.id,
    topic: tbm.topic,
    content: tbm.content,
    weatherCondition: tbm.weatherCondition,
    specialNotes: tbm.specialNotes,
  });
  return success(c, tbm, 201);
});

app.get("/", zValidator("query", TbmRecordFilterSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const query = c.req.valid("query");
  const siteId = query?.siteId ?? c.req.query("siteId");
  const date = query?.date ?? c.req.query("date");
  const rawTopicCategory = query?.topicCategory ?? c.req.query("topicCategory");
  const topicCategory =
    rawTopicCategory &&
    tbmTopicCategoryEnum.includes(
      rawTopicCategory as (typeof tbmTopicCategoryEnum)[number],
    )
      ? (rawTopicCategory as (typeof tbmTopicCategoryEnum)[number])
      : undefined;
  const limit = Math.min(
    query?.limit ?? Number.parseInt(c.req.query("limit") || "20", 10),
    100,
  );
  const offset =
    query?.offset ?? Number.parseInt(c.req.query("offset") || "0", 10);
  if (!siteId) return error(c, "MISSING_SITE_ID", "siteId is required", 400);
  if (user.role !== "SUPER_ADMIN") {
    const membershipError = await requireSiteMembership(c, db, user.id, siteId);
    if (membershipError) return membershipError;
  }
  const whereConditions = [eq(tbmRecords.siteId, siteId)];
  if (date)
    whereConditions.push(
      eq(tbmRecords.date, Math.floor(new Date(date).getTime() / 1000)),
    );
  if (topicCategory)
    whereConditions.push(eq(tbmRecords.topicCategory, topicCategory));
  const whereClause = and(...whereConditions);
  const [records, countResult] = await Promise.all([
    db
      .select({
        tbm: tbmRecords,
        leaderName: users.name,
        attendeeCount: sql<number>`(SELECT COUNT(*) FROM ${tbmAttendees} WHERE ${tbmAttendees.tbmRecordId} = ${tbmRecords.id})`,
      })
      .from(tbmRecords)
      .innerJoin(users, eq(tbmRecords.leaderId, users.id))
      .where(whereClause)
      .orderBy(desc(tbmRecords.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tbmRecords)
      .where(whereClause)
      .get(),
  ]);
  return success(c, { records, total: countResult?.count ?? 0, limit, offset });
});

app.put("/:id", zValidator("json", UpdateTbmInputSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const found = await getTbmOrNotFound(c, db, id);
  if (found.response) return found.response;
  const existing = found.tbm;
  if (user.role !== "SUPER_ADMIN") {
    const adminError = await requireSiteAdmin(c, db, user.id, existing.siteId);
    if (adminError) return adminError;
  }
  const changedFields = Object.keys(body);
  const updated = await db
    .update(tbmRecords)
    .set({
      ...(body.date !== undefined && {
        date: Math.floor(new Date(body.date).getTime() / 1000),
      }),
      ...(body.topic !== undefined && { topic: body.topic }),
      ...(body.topicCategory !== undefined && {
        topicCategory: body.topicCategory,
      }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.weatherCondition !== undefined && {
        weatherCondition: body.weatherCondition,
      }),
      ...(body.specialNotes !== undefined && {
        specialNotes: body.specialNotes,
      }),
      updatedAt: new Date(new Date().toISOString()),
    })
    .where(and(eq(tbmRecords.id, id), eq(tbmRecords.siteId, existing.siteId)))
    .returning()
    .get();
  if (!updated) return error(c, "TBM_NOT_FOUND", "TBM record not found", 404);
  await logAuditWithContext(c, db, "TBM_UPDATED", user.id, "TBM_RECORD", id, {
    action: "UPDATED",
    siteId: existing.siteId,
    changedFields,
  });
  return success(c, updated);
});

app.route("/", crudDetailRoutes);

export default app;
