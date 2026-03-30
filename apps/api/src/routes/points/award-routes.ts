import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import {
  pointsLedger,
  pointPolicies,
  siteMemberships,
  users,
} from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { AwardPointsSchema } from "../../validators/schemas";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface AwardPointsBody {
  userId: string;
  siteId: string;
  amount: number;
  reasonCode: string;
  reasonText?: string;
}

app.post("/award", zValidator("json", AwardPointsSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const data = c.req.valid("json") as AwardPointsBody;

  if (!data.userId || !data.siteId) {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and amount are required",
      400,
    );
  }

  const adminMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.siteId, data.siteId),
        eq(siteMemberships.status, "ACTIVE"),
        eq(siteMemberships.role, "SITE_ADMIN"),
      ),
    )
    .get();

  if (!adminMembership && user.role !== "SUPER_ADMIN") {
    return error(c, "SITE_ADMIN_REQUIRED", "Site admin access required", 403);
  }

  const targetMembership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, data.userId),
        eq(siteMemberships.siteId, data.siteId),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!targetMembership) {
    return error(
      c,
      "USER_NOT_SITE_MEMBER",
      "Target user is not a member of this site",
      400,
    );
  }

  const manualAwardPolicy = await db
    .select({ defaultAmount: pointPolicies.defaultAmount })
    .from(pointPolicies)
    .where(
      and(
        eq(pointPolicies.siteId, data.siteId),
        eq(pointPolicies.reasonCode, "MANUAL_AWARD"),
        eq(pointPolicies.isActive, true),
      ),
    )
    .get();

  const resolvedAmount = manualAwardPolicy?.defaultAmount ?? data.amount;

  if (typeof resolvedAmount !== "number") {
    return error(
      c,
      "MISSING_REQUIRED_FIELDS",
      "userId, siteId, and amount are required",
      400,
    );
  }

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const entry = await db
    .insert(pointsLedger)
    .values({
      userId: data.userId,
      siteId: data.siteId,
      amount: resolvedAmount,
      reasonCode: "MANUAL_AWARD",
      reasonText: data.reasonText ?? null,
      settleMonth,
      adminId: user.id,
    })
    .returning()
    .get();

  await logAuditWithContext(c, db, "POINT_AWARD", user.id, "POINT", entry.id, {
    userId: data.userId,
    amount: resolvedAmount,
    reason: data.reasonText,
    reasonCode: "MANUAL_AWARD",
  });

  const targetUser = await db
    .select({ id: users.id, nameMasked: users.nameMasked })
    .from(users)
    .where(eq(users.id, data.userId))
    .get();

  return success(c, { ...entry, user: targetUser }, 201);
});

export default app;
