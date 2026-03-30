import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { CreateCourseSchema } from "../../validators/schemas";
import { educationContents, siteMemberships } from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { getAiCredentials, analyzeEducationContent } from "../../lib/gemini-ai";
import type { AppType, CreateContentBody } from "./helpers";

export const contentsCrud = new Hono<AppType>();

const UpdateEducationContentSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    contentType: z.enum(["VIDEO", "IMAGE", "TEXT", "DOCUMENT"]).optional(),
    contentUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    externalSource: z.enum(["LOCAL", "YOUTUBE", "KOSHA"]).optional(),
    externalId: z.string().optional(),
    sourceUrl: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

contentsCrud.post("/", zValidator("json", CreateCourseSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const body = c.req.valid("json") as CreateContentBody;

  if (!body.siteId || !body.title || !body.contentType) {
    return error(
      c,
      "MISSING_FIELDS",
      "siteId, title, contentType are required",
      400,
    );
  }

  if (!["VIDEO", "IMAGE", "TEXT", "DOCUMENT"].includes(body.contentType)) {
    return error(c, "INVALID_CONTENT_TYPE", "Invalid contentType", 400);
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

  const content = await db
    .insert(educationContents)
    .values({
      siteId: body.siteId,
      title: body.title,
      description: body.description ?? null,
      contentType: body.contentType,
      contentUrl: body.contentUrl ?? null,
      thumbnailUrl: body.thumbnailUrl ?? null,
      durationMinutes: body.durationMinutes ?? null,
      externalSource: body.externalSource ?? "LOCAL",
      externalId: body.externalId ?? null,
      sourceUrl: body.sourceUrl ?? null,
      isActive: body.isActive ?? true,
      createdById: user.id,
    })
    .returning()
    .get();

  await logAuditWithContext(
    c,
    db,
    "EDUCATION_CONTENT_CREATED",
    user.id,
    "EDUCATION_CONTENT",
    content.id,
    {
      siteId: content.siteId,
      title: content.title,
      contentType: content.contentType,
    },
  );

  // Fire-and-forget AI analysis for non-VIDEO content
  const aiConfig = getAiCredentials(c.env);
  if (content.contentType !== "VIDEO" && aiConfig) {
    const analyzePromise = (async () => {
      try {
        let imageData: ArrayBuffer | undefined;
        let mimeType: string | undefined;
        let textContent: string | undefined;

        if (content.contentType === "IMAGE" && content.contentUrl) {
          const obj = await c.env.R2.get(content.contentUrl);
          if (obj) {
            imageData = await obj.arrayBuffer();
            mimeType = obj.httpMetadata?.contentType ?? "image/jpeg";
          }
        } else if (content.contentType === "DOCUMENT" && content.contentUrl) {
          const obj = await c.env.R2.get(content.contentUrl);
          if (obj) {
            imageData = await obj.arrayBuffer();
            mimeType = obj.httpMetadata?.contentType ?? "application/pdf";
          }
        } else if (content.contentType === "TEXT") {
          textContent = [content.title, content.description]
            .filter(Boolean)
            .join("\n\n");
        }

        const result = await analyzeEducationContent(
          aiConfig,
          content.contentType as "IMAGE" | "TEXT" | "DOCUMENT",
          { imageData, mimeType, textContent },
        );

        if (result) {
          const bgDb = drizzle(c.env.DB);
          await bgDb
            .update(educationContents)
            .set({
              aiAnalysis: JSON.stringify(result),
              aiAnalyzedAt: new Date().toISOString(),
            })
            .where(eq(educationContents.id, content.id))
            .run();
        }
      } catch {
        // AI analysis is best-effort; silently ignore failures
      }
    })();
    try {
      c.executionCtx.waitUntil(analyzePromise);
    } catch {
      void analyzePromise;
    }
  }

  return success(c, content, 201);
});

contentsCrud.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.query("siteId");

  if (!siteId) {
    return error(c, "MISSING_SITE_ID", "siteId is required", 400);
  }

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
  if (!membership && user.role !== "SUPER_ADMIN") {
    return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
  }

  const includeInactive = c.req.query("includeInactive") === "true";
  const limit = Math.min(
    Number.parseInt(c.req.query("limit") || "20", 10),
    100,
  );
  const offset = Number.parseInt(c.req.query("offset") || "0", 10);

  const whereClause = includeInactive
    ? eq(educationContents.siteId, siteId)
    : and(
        eq(educationContents.siteId, siteId),
        eq(educationContents.isActive, true),
      );

  const [contents, countResult] = await Promise.all([
    db
      .select({
        id: educationContents.id,
        title: educationContents.title,
        contentType: educationContents.contentType,
        isActive: educationContents.isActive,
        viewCount: educationContents.viewCount,
        createdAt: educationContents.createdAt,
        completionCount: sql<number>`(SELECT COUNT(*) FROM education_completions WHERE content_id = education_contents.id)`,
        quizCount: sql<number>`(SELECT COUNT(*) FROM quizzes WHERE content_id = education_contents.id)`,
      })
      .from(educationContents)
      .where(whereClause)
      .orderBy(desc(educationContents.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(educationContents)
      .where(whereClause)
      .get(),
  ]);

  return success(c, {
    contents,
    total: countResult?.count ?? 0,
    limit,
    offset,
  });
});

contentsCrud.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const id = c.req.param("id");

  const content = await db
    .select()
    .from(educationContents)
    .where(eq(educationContents.id, id))
    .get();

  if (!content) {
    return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, content.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();
  if (!membership && user.role !== "SUPER_ADMIN") {
    return error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
  }

  // Increment view count (fire-and-forget, don't block response)
  const incrementViewCount = db
    .update(educationContents)
    .set({ viewCount: sql`${educationContents.viewCount} + 1` })
    .where(eq(educationContents.id, id))
    .run();
  try {
    c.executionCtx.waitUntil(incrementViewCount);
  } catch {
    void incrementViewCount;
  }

  return success(c, content);
});

contentsCrud.patch(
  "/:id",
  zValidator("json", UpdateEducationContentSchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const id = c.req.param("id");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(educationContents)
      .where(eq(educationContents.id, id))
      .get();

    if (!existing) {
      return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
    }

    const siteId = existing.siteId;

    const adminMembership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
          eq(siteMemberships.role, "SITE_ADMIN"),
        ),
      )
      .get();
    if (!adminMembership && user.role !== "SUPER_ADMIN") {
      return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
    }

    const changedFields = Object.keys(body);

    const updated = await db
      .update(educationContents)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.contentType !== undefined && {
          contentType: body.contentType,
        }),
        ...(body.contentUrl !== undefined && { contentUrl: body.contentUrl }),
        ...(body.thumbnailUrl !== undefined && {
          thumbnailUrl: body.thumbnailUrl,
        }),
        ...(body.durationMinutes !== undefined && {
          durationMinutes: body.durationMinutes,
        }),
        ...(body.externalSource !== undefined && {
          externalSource: body.externalSource,
        }),
        ...(body.externalId !== undefined && { externalId: body.externalId }),
        ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl }),
        updatedAt: new Date(new Date().toISOString()),
      })
      .where(
        and(eq(educationContents.id, id), eq(educationContents.siteId, siteId)),
      )
      .returning()
      .get();

    if (!updated) {
      return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
    }

    await logAuditWithContext(
      c,
      db,
      "EDUCATION_CONTENT_UPDATED",
      user.id,
      "EDUCATION_CONTENT",
      id,
      {
        action: "UPDATED",
        siteId,
        changedFields,
      },
    );

    return success(c, updated);
  },
);

contentsCrud.delete(
  "/:id",
  zValidator("param", z.object({ id: z.string().min(1) })),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const id = c.req.valid("param").id;

    const content = await db
      .select()
      .from(educationContents)
      .where(eq(educationContents.id, id))
      .get();

    if (!content) {
      return error(c, "CONTENT_NOT_FOUND", "Education content not found", 404);
    }

    const adminMembership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, content.siteId),
          eq(siteMemberships.status, "ACTIVE"),
          eq(siteMemberships.role, "SITE_ADMIN"),
        ),
      )
      .get();
    if (!adminMembership && user.role !== "SUPER_ADMIN") {
      return error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
    }

    await db
      .update(educationContents)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(educationContents.id, id));

    await logAuditWithContext(
      c,
      db,
      "EDUCATION_CONTENT_DELETED",
      user.id,
      "EDUCATION_CONTENT",
      id,
      {
        siteId: content.siteId,
        title: content.title,
      },
    );

    return success(c, { deleted: true });
  },
);
