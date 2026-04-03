import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { siteMemberships } from "../../db/schema";
import { success, error } from "../../lib/response";
import { generateAnnouncementDraft, getAiCredentials } from "../../lib/ai";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.post("/generate-draft", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const body = await c.req.json<{ keywords: string; siteId: string }>();

  if (!body.keywords || !body.siteId) {
    return error(c, "INVALID_INPUT", "키워드와 사이트 ID가 필요합니다", 400);
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, body.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();

  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
  }

  const aiConfig = getAiCredentials(c.env);
  if (!aiConfig) {
    return error(c, "AI_UNAVAILABLE", "AI not configured", 503);
  }

  const result = await generateAnnouncementDraft(aiConfig, body.keywords);
  if (!result) {
    return error(c, "AI_FAILED", "초안 생성에 실패했습니다", 500);
  }

  return success(c, { title: result.title, content: result.content });
});

export default app;
