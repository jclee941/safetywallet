import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../../db/schema";

const { siteMemberships } = schema;

export async function isSiteAdmin(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
) {
  const membership = await db
    .select({ id: siteMemberships.id })
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, userId),
        eq(siteMemberships.siteId, siteId),
        eq(siteMemberships.role, "SITE_ADMIN"),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  return !!membership;
}
