import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { tbmAttendees, tbmRecords, users } from "../../../db/schema";
import { logAuditWithContext } from "../../../lib/audit";
import { error, success } from "../../../lib/response";
import type { AppType } from "../helpers";
import {
  getTbmOrNotFound,
  requireSiteAdmin,
  requireSiteMembership,
} from "./shared";

const app = new Hono<AppType>();

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const tbm = await db
    .select({ record: tbmRecords, leaderName: users.name })
    .from(tbmRecords)
    .innerJoin(users, eq(tbmRecords.leaderId, users.id))
    .where(eq(tbmRecords.id, id))
    .get();
  if (!tbm) return error(c, "TBM_NOT_FOUND", "TBM record not found", 404);
  if (user.role !== "SUPER_ADMIN") {
    const membershipError = await requireSiteMembership(
      c,
      db,
      user.id,
      tbm.record.siteId,
    );
    if (membershipError) return membershipError;
  }
  const attendees = await db
    .select({ attendee: tbmAttendees, userName: users.name })
    .from(tbmAttendees)
    .innerJoin(users, eq(tbmAttendees.userId, users.id))
    .where(eq(tbmAttendees.tbmRecordId, id))
    .orderBy(desc(tbmAttendees.attendedAt))
    .all();
  return success(c, {
    ...tbm.record,
    leaderName: tbm.leaderName,
    attendees,
    attendeeCount: attendees.length,
  });
});

app.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const found = await getTbmOrNotFound(c, db, id);
  if (found.response) return found.response;
  const existing = found.tbm;
  if (user.role !== "SUPER_ADMIN") {
    const adminError = await requireSiteAdmin(c, db, user.id, existing.siteId);
    if (adminError) return adminError;
  }
  await db.delete(tbmAttendees).where(eq(tbmAttendees.tbmRecordId, id));
  await db
    .delete(tbmRecords)
    .where(and(eq(tbmRecords.id, id), eq(tbmRecords.siteId, existing.siteId)));
  await logAuditWithContext(c, db, "TBM_DELETED", user.id, "TBM_RECORD", id, {
    action: "DELETED",
    siteId: existing.siteId,
    topic: existing.topic,
  });
  return success(c, { deleted: true });
});

export default app;
