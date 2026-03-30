import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { pointPolicies, siteMemberships } from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import type { Env, AuthContext } from "../../types";
import {
  CreatePolicySchema,
  UpdatePolicySchema,
} from "../../validators/schemas";
import { requireSiteAdmin } from "./helpers";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/site/:siteId", async (c) => {
  const authContext = c.get("auth");
  if (!authContext) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const siteId = c.req.param("siteId");
  if (!siteId) {
    return error(c, "BAD_REQUEST", "Site ID is required", 400);
  }

  const db = drizzle(c.env.DB);

  if (authContext.user.role !== "SUPER_ADMIN") {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, authContext.user.id),
          eq(siteMemberships.siteId, siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "FORBIDDEN", "Site access denied", 403);
    }
  }

  const policyList = await db
    .select()
    .from(pointPolicies)
    .where(eq(pointPolicies.siteId, siteId));

  return success(c, { policies: policyList }, 200);
});

app.get("/:id", async (c) => {
  const authContext = c.get("auth");
  if (!authContext) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const policyId = c.req.param("id");
  if (!policyId) {
    return error(c, "BAD_REQUEST", "Policy ID is required", 400);
  }
  const db = drizzle(c.env.DB);

  const policy = await db
    .select()
    .from(pointPolicies)
    .where(eq(pointPolicies.id, policyId))
    .get();

  if (!policy) {
    return error(c, "NOT_FOUND", "Policy not found", 404);
  }

  return success(c, { policy }, 200);
});

app.post("/", zValidator("json", CreatePolicySchema as never), async (c) => {
  const authContext = c.get("auth");
  if (!authContext) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const body: z.infer<typeof CreatePolicySchema> = c.req.valid("json");

  if (
    !body.siteId ||
    !body.reasonCode ||
    !body.name ||
    body.defaultAmount === undefined
  ) {
    return error(
      c,
      "MISSING_FIELDS",
      "siteId, reasonCode, name, and defaultAmount are required",
      400,
    );
  }

  const db = drizzle(c.env.DB);

  await requireSiteAdmin(
    db,
    authContext.user.id,
    body.siteId,
    authContext.user.role,
  );

  const existing = await db
    .select()
    .from(pointPolicies)
    .where(
      and(
        eq(pointPolicies.siteId, body.siteId),
        eq(pointPolicies.reasonCode, body.reasonCode),
      ),
    )
    .get();

  if (existing) {
    return error(
      c,
      "DUPLICATE",
      "Policy with this reasonCode already exists for this site",
      409,
    );
  }

  const newPolicy = await db
    .insert(pointPolicies)
    .values({
      siteId: body.siteId,
      reasonCode: body.reasonCode,
      name: body.name,
      description: body.description || null,
      defaultAmount: body.defaultAmount,
      minAmount: body.minAmount ?? null,
      maxAmount: body.maxAmount ?? null,
      dailyLimit: body.dailyLimit ?? null,
      monthlyLimit: body.monthlyLimit ?? null,
      isActive: true,
    })
    .returning()
    .get();

  return success(c, { policy: newPolicy }, 201);
});

app.patch(
  "/:id",
  zValidator("json", UpdatePolicySchema as never),
  async (c) => {
    const authContext = c.get("auth");
    if (!authContext) {
      throw new HTTPException(401, { message: "Authentication required" });
    }

    const policyId = c.req.param("id");
    const db = drizzle(c.env.DB);

    const existingPolicy = await db
      .select()
      .from(pointPolicies)
      .where(eq(pointPolicies.id, policyId))
      .get();

    if (!existingPolicy) {
      return error(c, "NOT_FOUND", "Policy not found", 404);
    }

    await requireSiteAdmin(
      db,
      authContext.user.id,
      existingPolicy.siteId,
      authContext.user.role,
    );

    const body: z.infer<typeof UpdatePolicySchema> = c.req.valid("json");

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.defaultAmount !== undefined)
      updateData.defaultAmount = body.defaultAmount;
    if (body.minAmount !== undefined) updateData.minAmount = body.minAmount;
    if (body.maxAmount !== undefined) updateData.maxAmount = body.maxAmount;
    if (body.dailyLimit !== undefined) updateData.dailyLimit = body.dailyLimit;
    if (body.monthlyLimit !== undefined)
      updateData.monthlyLimit = body.monthlyLimit;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updated = await db
      .update(pointPolicies)
      .set(updateData)
      .where(eq(pointPolicies.id, policyId))
      .returning()
      .get();

    const changedFields: Record<string, { old: unknown; new: unknown }> = {};
    const keys = [
      "name",
      "description",
      "defaultAmount",
      "minAmount",
      "maxAmount",
      "dailyLimit",
      "monthlyLimit",
      "isActive",
    ] as const;
    for (const key of keys) {
      if (body[key] !== undefined && existingPolicy[key] !== body[key]) {
        changedFields[key] = { old: existingPolicy[key], new: body[key] };
      }
    }

    await logAuditWithContext(
      c,
      db,
      "POLICY_CHANGE",
      authContext.user.id,
      "POLICY",
      policyId,
      {
        policyKey: existingPolicy.reasonCode,
        oldValue: existingPolicy,
        newValue: updated,
        changedFields,
      },
    );

    return success(c, { policy: updated }, 200);
  },
);

app.delete("/:id", async (c) => {
  const authContext = c.get("auth");
  if (!authContext) {
    throw new HTTPException(401, { message: "Authentication required" });
  }

  const policyId = c.req.param("id");
  if (!policyId) {
    return error(c, "BAD_REQUEST", "Policy ID is required", 400);
  }
  const db = drizzle(c.env.DB);

  const existingPolicy = await db
    .select()
    .from(pointPolicies)
    .where(eq(pointPolicies.id, policyId))
    .get();

  if (!existingPolicy) {
    return error(c, "NOT_FOUND", "Policy not found", 404);
  }

  await requireSiteAdmin(
    db,
    authContext.user.id,
    existingPolicy.siteId,
    authContext.user.role,
  );

  await db.delete(pointPolicies).where(eq(pointPolicies.id, policyId));

  return success(c, { message: "Policy deleted" }, 200);
});

export default app;
