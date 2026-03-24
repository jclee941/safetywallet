import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, or } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { attendanceMiddleware } from "../middleware/attendance";
import { announcements, siteMemberships, users } from "../db/schema";
import { success, error } from "../lib/response";
import { generateAnnouncementDraft, getAiCredentials } from "../lib/gemini-ai";
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
} from "../validators/schemas";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.use("*", authMiddleware);

const defaultRateLimit = rateLimitMiddleware();
app.use("*", defaultRateLimit);

async function getActiveMembership(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
) {
  return db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, userId),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();
}

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

app.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");
  const limit = Math.min(parseInt(c.req.query("limit") || "20") || 20, 100);
  const offset = parseInt(c.req.query("offset") || "0") || 0;

  // Admin users are exempt from attendance checks
  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    await attendanceMiddleware(c, async () => {}, siteId);
  }

  if (siteId) {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (
      !membership &&
      user.role !== "SITE_ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const conditions: ReturnType<typeof eq>[] = [];

  if (siteId) {
    conditions.push(
      or(eq(announcements.siteId, siteId), eq(announcements.siteId, ""))!,
    );
  }

  // Non-admin users only see published announcements
  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    conditions.push(eq(announcements.isPublished, true));
  }

  const result = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const data = result.map((row) => ({
    ...row.announcement,
    author: row.author,
  }));

  return success(c, {
    data,
    pagination: { limit, offset, count: data.length },
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const announcementId = c.req.param("id");

  const result = await db
    .select({
      announcement: announcements,
      author: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(announcements)
    .leftJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.id, announcementId))
    .get();

  if (!result) {
    return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
  }

  return success(c, {
    announcement: {
      ...result.announcement,
      author: result.author,
    },
  });
});

app.post(
  "/",
  zValidator("json", CreateAnnouncementSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const body: z.infer<typeof CreateAnnouncementSchema> = c.req.valid("json");

    if (!body.title || !body.content) {
      return error(
        c,
        "MISSING_REQUIRED_FIELDS",
        "title and content are required",
        400,
      );
    }

    if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
      if (!body.siteId) {
        return error(
          c,
          "ADMIN_ONLY",
          "Only admins can create global announcements",
          403,
        );
      }

      const membership = await getActiveMembership(db, user.id, body.siteId);

      if (!membership || membership.role === "WORKER") {
        return error(
          c,
          "NOT_AUTHORIZED",
          "Not authorized to create announcements",
          403,
        );
      }
    }

    const isScheduled = !!body.scheduledAt;
    const newAnnouncement = await db
      .insert(announcements)
      .values({
        siteId: body.siteId || "",
        authorId: user.id,
        title: body.title,
        content: body.content,
        isPinned: body.isPinned ?? false,
        scheduledAt: isScheduled ? new Date(body.scheduledAt!) : null,
        isPublished: !isScheduled,
      })
      .returning()
      .get();

    return success(c, { announcement: newAnnouncement }, 201);
  },
);

app.patch(
  "/:id",
  zValidator("json", UpdateAnnouncementSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const announcementId = c.req.param("id");
    const body: z.infer<typeof UpdateAnnouncementSchema> = c.req.valid("json");

    const announcement = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, announcementId))
      .get();

    if (!announcement) {
      return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
    }

    if (
      user.role !== "SITE_ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      announcement.authorId !== user.id
    ) {
      return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
    }

    if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
      const membership = await getActiveMembership(
        db,
        user.id,
        announcement.siteId,
      );

      if (!membership) {
        return error(c, "NOT_AUTHORIZED", "No access to this site", 403);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;
    if (body.scheduledAt !== undefined) {
      if (body.scheduledAt === null) {
        // Clear schedule, publish immediately
        updateData.scheduledAt = null;
        updateData.isPublished = true;
      } else {
        updateData.scheduledAt = new Date(body.scheduledAt);
        updateData.isPublished = false;
      }
    }

    const updated = await db
      .update(announcements)
      .set(updateData)
      .where(eq(announcements.id, announcementId))
      .returning()
      .get();

    return success(c, { announcement: updated });
  },
);

app.delete("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const announcementId = c.req.param("id");

  const announcement = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .get();

  if (!announcement) {
    return error(c, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found", 404);
  }

  if (
    user.role !== "SITE_ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    announcement.authorId !== user.id
  ) {
    return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
  }

  await db.delete(announcements).where(eq(announcements.id, announcementId));

  return success(c, null);
});

export default app;
