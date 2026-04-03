import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { tbmAttendees, tbmRecords, users } from "../../../db/schema";
import { getAiCredentials } from "../../../lib/ai/base";
import {
  analyzeTbmRecord,
  generateTbmMeetingMinutes,
} from "../../../lib/ai/tbm";
import { error, success } from "../../../lib/response";
import type { AppType } from "../helpers";
import {
  getTbmOrNotFound,
  requireSiteAdmin,
  requireSiteMembership,
} from "./shared";

const app = new Hono<AppType>();

app.post("/:id/analyze", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig)
    return error(c, "AI_NOT_CONFIGURED", "AI 분석이 설정되지 않았습니다", 503);
  const found = await getTbmOrNotFound(c, db, id);
  if (found.response) return found.response;
  const tbm = found.tbm;
  if (user.role !== "SUPER_ADMIN") {
    const adminError = await requireSiteAdmin(c, db, user.id, tbm.siteId);
    if (adminError) return adminError;
  }
  const result = await analyzeTbmRecord(aiConfig, {
    topic: tbm.topic,
    content: tbm.content,
    weatherCondition: tbm.weatherCondition,
    specialNotes: tbm.specialNotes,
  });
  if (!result)
    return error(c, "AI_ANALYSIS_FAILED", "AI 분석에 실패했습니다", 500);
  const analyzedAt = new Date().toISOString();
  await db
    .update(tbmRecords)
    .set({ aiAnalysis: JSON.stringify(result), aiAnalyzedAt: analyzedAt })
    .where(eq(tbmRecords.id, id));
  return success(c, { analysis: result, analyzedAt });
});

app.get("/:id/ai-analysis", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const found = await getTbmOrNotFound(c, db, id);
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
  return success(c, {
    analysis: tbm.aiAnalysis ? JSON.parse(tbm.aiAnalysis) : null,
    analyzedAt: tbm.aiAnalyzedAt ?? null,
  });
});

app.post("/:id/generate-minutes", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig)
    return error(c, "AI_NOT_CONFIGURED", "AI 분석이 설정되지 않았습니다", 503);
  const tbm = await db
    .select({
      record: tbmRecords,
      leaderName: users.name,
      attendeeCount: sql<number>`(SELECT COUNT(*) FROM ${tbmAttendees} WHERE ${tbmAttendees.tbmRecordId} = ${tbmRecords.id})`,
    })
    .from(tbmRecords)
    .innerJoin(users, eq(tbmRecords.leaderId, users.id))
    .where(eq(tbmRecords.id, id))
    .get();
  if (!tbm) return error(c, "TBM_NOT_FOUND", "TBM record not found", 404);
  if (user.role !== "SUPER_ADMIN") {
    const adminError = await requireSiteAdmin(
      c,
      db,
      user.id,
      tbm.record.siteId,
    );
    if (adminError) return adminError;
  }
  const result = await generateTbmMeetingMinutes(aiConfig, {
    topic: tbm.record.topic,
    content: tbm.record.content,
    weatherCondition: tbm.record.weatherCondition,
    specialNotes: tbm.record.specialNotes,
    leaderName: tbm.leaderName,
    attendeeCount: tbm.attendeeCount,
    date: new Date(tbm.record.date * 1000).toLocaleString("ko-KR"),
  });
  if (!result)
    return error(c, "AI_MINUTES_FAILED", "AI 회의록 생성에 실패했습니다", 500);
  await db
    .update(tbmRecords)
    .set({
      aiMeetingMinutes: JSON.stringify(result),
      aiMinutesGeneratedAt: new Date().toISOString(),
    })
    .where(eq(tbmRecords.id, id));
  return success(c, { success: true, minutes: result });
});

app.get("/:id/meeting-minutes", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");
  const found = await getTbmOrNotFound(c, db, id);
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
  return success(c, {
    minutes: tbm.aiMeetingMinutes ? JSON.parse(tbm.aiMeetingMinutes) : null,
    generatedAt: tbm.aiMinutesGeneratedAt ?? null,
  });
});

export default app;
