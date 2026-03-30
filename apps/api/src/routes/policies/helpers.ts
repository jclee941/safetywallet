import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { siteMemberships } from "../../db/schema";

export async function requireSiteAdmin(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  userRole: string,
): Promise<void> {
  if (userRole === "SUPER_ADMIN") return;

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

  if (!membership || membership.role !== "SITE_ADMIN") {
    throw new HTTPException(403, { message: "Site admin access required" });
  }
}
