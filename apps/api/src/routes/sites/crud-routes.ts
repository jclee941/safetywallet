import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { sites, siteMemberships } from "../../db/schema";
import { success, error } from "../../lib/response";
import { CreateSiteSchema, UpdateSiteSchema } from "../../validators/schemas";
import { SitesListQuerySchema } from "../../validators/query";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/", zValidator("query", SitesListQuerySchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const { limit, offset } = c.req.valid("query");

  if (user.role === "SITE_ADMIN" || user.role === "SUPER_ADMIN") {
    const allSites = await db
      .select()
      .from(sites)
      .limit(limit)
      .offset(offset)
      .all();
    return success(c, {
      data: allSites,
      pagination: { limit, offset, count: allSites.length },
    });
  }

  const mySites = await db
    .select({
      id: sites.id,
      name: sites.name,
      active: sites.active,
      membershipRole: siteMemberships.role,
    })
    .from(siteMemberships)
    .innerJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .limit(limit)
    .offset(offset)
    .all();

  return success(c, {
    data: mySites,
    pagination: { limit, offset, count: mySites.length },
  });
});

app.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");

  const site = await db.select().from(sites).where(eq(sites.id, siteId)).get();

  if (!site) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
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

    if (!membership) {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const memberCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  return success(c, {
    site: {
      ...site,
      memberCount: memberCount?.count || 0,
    },
  });
});

app.post("/", zValidator("json", CreateSiteSchema as never), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const data: z.infer<typeof CreateSiteSchema> = c.req.valid("json");

  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "ADMIN_ONLY", "Only admins can create sites", 403);
  }

  const newSite = await db
    .insert(sites)
    .values({
      name: data.name,
      joinCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      active: true,
    })
    .returning()
    .get();

  return success(c, { site: newSite }, 201);
});

app.patch("/:id", zValidator("json", UpdateSiteSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");
  const data = c.req.valid("json");

  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.role, "SITE_ADMIN"),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.leaderboardEnabled !== undefined)
    updateData.leaderboardEnabled = data.leaderboardEnabled;

  const updated = await db
    .update(sites)
    .set(updateData)
    .where(eq(sites.id, siteId))
    .returning()
    .get();

  if (!updated) {
    return error(c, "SITE_NOT_FOUND", "Site not found", 404);
  }

  return success(c, { site: updated });
});

export default app;
