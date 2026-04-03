import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { siteMemberships, tbmRecords } from "../../../db/schema";
import { error } from "../../../lib/response";
import type { AppType } from "../helpers";

type Db = ReturnType<typeof drizzle>;
type AppContext = Context<AppType>;

export async function getTbmOrNotFound(c: AppContext, db: Db, id: string) {
  const tbm = await db
    .select()
    .from(tbmRecords)
    .where(eq(tbmRecords.id, id))
    .get();
  if (!tbm)
    return {
      tbm: null,
      response: error(c, "TBM_NOT_FOUND", "TBM record not found", 404),
    };
  return { tbm, response: null };
}

export async function requireSiteMembership(
  c: AppContext,
  db: Db,
  userId: string,
  siteId: string,
) {
  const membership = await db
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
  return membership
    ? null
    : error(c, "NOT_SITE_MEMBER", "Site membership required", 403);
}

export async function requireSiteAdmin(
  c: AppContext,
  db: Db,
  userId: string,
  siteId: string,
) {
  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, userId),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();
  return membership
    ? null
    : error(c, "SITE_ADMIN_REQUIRED", "관리자 권한이 필요합니다", 403);
}
