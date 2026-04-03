import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { tbmAttendees, users } from "../../../db/schema";
import { success, error } from "../../../lib/response";
import { AttendTbmSchema } from "../../../validators/schemas";
import type { AppType } from "../helpers";
import { getTbmOrNotFound, requireSiteMembership } from "./shared";

const app = new Hono<AppType>();

app.post("/:tbmId/attend", zValidator("json", AttendTbmSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const tbmId = c.req.param("tbmId");
  const found = await getTbmOrNotFound(c, db, tbmId);
  if (found.response) return found.response;
  const tbm = found.tbm;
  if (user.role !== "SUPER_ADMIN") {
    const membershipError = await requireSiteMembership(
      c,
      db,
      user.id,
      tbm.siteId,
    );
    if (membershipError) return membershipError;
  }
  c.req.valid("json");
  const existing = await db
    .select()
    .from(tbmAttendees)
    .where(
      and(
        eq(tbmAttendees.tbmRecordId, tbmId),
        eq(tbmAttendees.userId, user.id),
      ),
    )
    .get();
  if (existing) return error(c, "ALREADY_ATTENDED", "Already attended", 400);
  const attendee = await db
    .insert(tbmAttendees)
    .values({ tbmRecordId: tbmId, userId: user.id })
    .returning()
    .get();
  return success(c, attendee, 201);
});

app.get("/:tbmId/attendees", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const tbmId = c.req.param("tbmId");
  const found = await getTbmOrNotFound(c, db, tbmId);
  if (found.response) return found.response;
  const tbm = found.tbm;
  if (user.role !== "SUPER_ADMIN") {
    const membershipError = await requireSiteMembership(
      c,
      db,
      user.id,
      tbm.siteId,
    );
    if (membershipError) return membershipError;
  }
  const attendees = await db
    .select({ attendee: tbmAttendees, userName: users.name })
    .from(tbmAttendees)
    .innerJoin(users, eq(tbmAttendees.userId, users.id))
    .where(eq(tbmAttendees.tbmRecordId, tbmId))
    .orderBy(desc(tbmAttendees.attendedAt))
    .all();
  return success(c, { attendees });
});

export default app;
