import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { sites, siteMemberships, users, auditLogs } from "../../db/schema";
import { success, error } from "../../lib/response";
import { SiteMembersQuerySchema } from "../../validators/query";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get(
  "/:id/members",
  zValidator("query", SiteMembersQuerySchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const siteId = c.req.param("id");
    const { limit, offset } = c.req.valid("query");

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
      return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
    }

    if (
      membership?.role === "WORKER" &&
      user.role !== "SITE_ADMIN" &&
      user.role !== "SUPER_ADMIN"
    ) {
      return error(c, "NOT_AUTHORIZED", "Not authorized to view members", 403);
    }

    const members = await db
      .select({
        id: siteMemberships.id,
        role: siteMemberships.role,
        status: siteMemberships.status,
        joinedAt: siteMemberships.joinedAt,
        user: {
          id: users.id,
          name: users.nameMasked,
          loginExempt: users.loginExempt,
        },
      })
      .from(siteMemberships)
      .innerJoin(users, eq(siteMemberships.userId, users.id))
      .where(eq(siteMemberships.siteId, siteId))
      .limit(limit)
      .offset(offset)
      .all();

    return success(c, {
      data: members,
      pagination: { limit, offset, count: members.length },
    });
  },
);

app.get("/:id/members/:memberId", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const siteId = c.req.param("id");
  const memberId = c.req.param("memberId");

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
    return error(c, "NOT_AUTHORIZED", "Not authorized", 403);
  }

  if (
    membership?.role === "WORKER" &&
    user.role !== "SITE_ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    return error(c, "NOT_AUTHORIZED", "Not authorized to view members", 403);
  }

  const member = await db
    .select({
      id: siteMemberships.id,
      role: siteMemberships.role,
      status: siteMemberships.status,
      joinedAt: siteMemberships.joinedAt,
      user: {
        id: users.id,
        name: users.nameMasked,
      },
    })
    .from(siteMemberships)
    .innerJoin(users, eq(siteMemberships.userId, users.id))
    .where(
      and(eq(siteMemberships.id, memberId), eq(siteMemberships.siteId, siteId)),
    )
    .get();

  if (!member) {
    return error(c, "NOT_FOUND", "Member not found", 404);
  }

  return success(c, { member });
});

app.post(
  "/:id/leave",
  zValidator("json", z.object({ reason: z.string().max(500).optional() })),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const siteId = c.req.param("id");
    const { reason } = c.req.valid("json");

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
      return error(c, "NOT_MEMBER", "이 현장의 활성 멤버가 아닙니다", 404);
    }

    // Site admins cannot leave — must be demoted first
    if (membership.role === "SITE_ADMIN") {
      return error(
        c,
        "ADMIN_CANNOT_LEAVE",
        "현장 관리자는 탈퇴할 수 없습니다. 먼저 권한을 변경해주세요.",
        403,
      );
    }

    await db
      .update(siteMemberships)
      .set({
        status: "LEFT",
        leftAt: new Date(),
        leftReason: reason || null,
      })
      .where(eq(siteMemberships.id, membership.id))
      .run();

    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "LEAVE_SITE",
      targetType: "SITE_MEMBERSHIP",
      targetId: membership.id,
      reason: reason || "자발적 탈퇴",
      ip:
        c.req.header("CF-Connecting-IP") ||
        c.req.header("X-Forwarded-For") ||
        "unknown",
      userAgent: c.req.header("User-Agent"),
    });

    return success(c, { message: "현장에서 탈퇴했습니다" });
  },
);

export default app;
