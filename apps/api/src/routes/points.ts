import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { Env, AuthContext } from "../types";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { attendanceMiddleware } from "../middleware/attendance";
import {
  pointsLedger,
  pointPolicies,
  sites,
  siteMemberships,
  users,
} from "../db/schema";
import { success, error } from "../lib/response";
import { logAuditWithContext } from "../lib/audit";
import { AwardPointsSchema } from "../validators/schemas";
import {
  PointsSiteQuerySchema,
  PointsLeaderboardQuerySchema,
} from "../validators/query";

const POINT_HISTORY_LIMIT = 20;

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

interface AwardPointsBody {
  userId: string;
  siteId: string;
  amount: number;
  reasonCode: string;
  reasonText?: string;
}

app.use("*", authMiddleware);

const defaultRateLimit = rateLimitMiddleware();
app.use("*", defaultRateLimit);

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

app.get("/", zValidator("query", PointsSiteQuerySchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const { siteId } = c.req.valid("query");

  await attendanceMiddleware(c, async () => {}, siteId);

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

  const balanceResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
    })
    .from(pointsLedger)
    .where(
      and(eq(pointsLedger.userId, user.id), eq(pointsLedger.siteId, siteId)),
    )
    .get();

  const history = await db
    .select()
    .from(pointsLedger)
    .where(
      and(eq(pointsLedger.userId, user.id), eq(pointsLedger.siteId, siteId)),
    )
    .orderBy(desc(pointsLedger.createdAt))
    .limit(POINT_HISTORY_LIMIT)
    .all();

  return success(c, { balance: balanceResult?.total ?? 0, history });
});
app.get("/balance", zValidator("query", PointsSiteQuerySchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const { siteId } = c.req.valid("query");

  await attendanceMiddleware(c, async () => {}, siteId);

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

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
    })
    .from(pointsLedger)
    .where(
      and(eq(pointsLedger.userId, user.id), eq(pointsLedger.siteId, siteId)),
    )
    .get();

  return success(c, { userId: user.id, siteId, balance: result?.total ?? 0 });
});

app.get("/history", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const querySchema = z.object({
    siteId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    limit: z.coerce.number().min(0).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  });

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return error(c, "INVALID_QUERY_PARAMS", parsed.error.message);
  }
  const query = parsed.data;

  if (query.siteId) {
    await attendanceMiddleware(c, async () => {}, query.siteId);
  }

  const limit = Math.min(query.limit, 100);
  const offset = query.offset;

  const targetUserId = query.userId || user.id;
  const isViewingAnotherUser = targetUserId !== user.id;

  if (isViewingAnotherUser) {
    if (user.role !== "SUPER_ADMIN") {
      if (!query.siteId) {
        return error(
          c,
          "SITE_ID_REQUIRED",
          "siteId is required when viewing another user's history",
          400,
        );
      }

      const adminMembership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, query.siteId),
            eq(siteMemberships.status, "ACTIVE"),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      if (!adminMembership) {
        return error(
          c,
          "ADMIN_REQUIRED",
          "Admin access required to view another user's point history",
          403,
        );
      }
    }
  }

  let showAllSiteEntries = false;
  if (query.siteId && !query.userId) {
    if (user.role === "SUPER_ADMIN") {
      showAllSiteEntries = true;
    } else {
      const adminMembership = await db
        .select()
        .from(siteMemberships)
        .where(
          and(
            eq(siteMemberships.userId, user.id),
            eq(siteMemberships.siteId, query.siteId),
            eq(siteMemberships.status, "ACTIVE"),
            eq(siteMemberships.role, "SITE_ADMIN"),
          ),
        )
        .get();

      showAllSiteEntries = !!adminMembership;
    }
  }

  if (query.siteId) {
    const membership = await db
      .select()
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.userId, user.id),
          eq(siteMemberships.siteId, query.siteId),
          eq(siteMemberships.status, "ACTIVE"),
        ),
      )
      .get();

    if (!membership) {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }
  }

  const conditions = [];

  if (!showAllSiteEntries) {
    conditions.push(eq(pointsLedger.userId, targetUserId));
  }

  if (query.siteId) {
    conditions.push(eq(pointsLedger.siteId, query.siteId));
  }

  const entries = await db
    .select({
      id: pointsLedger.id,
      userId: pointsLedger.userId,
      siteId: pointsLedger.siteId,
      amount: pointsLedger.amount,
      reasonCode: pointsLedger.reasonCode,
      reasonText: pointsLedger.reasonText,
      createdAt: pointsLedger.createdAt,
      userName: users.name,
    })
    .from(pointsLedger)
    .leftJoin(users, eq(pointsLedger.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(pointsLedger.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(pointsLedger)
    .where(and(...conditions))
    .get();

  return success(c, { entries, total: countResult?.count ?? 0, limit, offset });
});

app.get(
  "/leaderboard/:siteId",
  zValidator("query", PointsLeaderboardQuerySchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user } = c.get("auth");
    const siteId = c.req.param("siteId");

    const { limit, type } = c.req.valid("query");

    await attendanceMiddleware(c, async () => {}, siteId);

    const site = await db
      .select({ leaderboardEnabled: sites.leaderboardEnabled })
      .from(sites)
      .where(eq(sites.id, siteId))
      .get();

    if (!site) {
      return error(c, "SITE_NOT_FOUND", "Site not found", 404);
    }

    if (!site.leaderboardEnabled && user.role !== "SUPER_ADMIN") {
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

      if (!adminMembership) {
        return error(
          c,
          "LEADERBOARD_DISABLED",
          "Leaderboard is disabled for this site",
          403,
        );
      }
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

    if (!membership) {
      return error(c, "NOT_SITE_MEMBER", "Not a member of this site", 403);
    }

    const conditions = [eq(pointsLedger.siteId, siteId)];
    if (type === "monthly") {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      conditions.push(eq(pointsLedger.settleMonth, currentMonth));
    }

    const results = await db
      .select({
        userId: pointsLedger.userId,
        total: sql<number>`SUM(${pointsLedger.amount})`.as("total"),
      })
      .from(pointsLedger)
      .where(and(...conditions))
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`total`))
      .limit(limit)
      .all();

    const userIds = results.map((r) => r.userId);
    const usersData =
      userIds.length > 0
        ? await db
            .select({ id: users.id, nameMasked: users.nameMasked })
            .from(users)
            .where(inArray(users.id, userIds))
            .all()
        : [];

    const userMap = new Map(usersData.map((u) => [u.id, u]));

    const leaderboard = results.map((r, index) => {
      const userData = userMap.get(r.userId);
      return {
        rank: index + 1,
        userId: r.userId,
        nameMasked: userData?.nameMasked ?? null,
        totalPoints: r.total ?? 0,
        isCurrentUser: r.userId === user.id,
      };
    });

    let myRank: number | null = null;
    const myEntry = leaderboard.find((e) => e.isCurrentUser);
    if (myEntry) {
      myRank = myEntry.rank;
    } else {
      const myTotal = await db
        .select({
          total: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
        })
        .from(pointsLedger)
        .where(and(eq(pointsLedger.userId, user.id), ...conditions))
        .get();

      if (myTotal && myTotal.total > 0) {
        const countAbove = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(
            db
              .select({
                userId: pointsLedger.userId,
                total: sql<number>`SUM(${pointsLedger.amount})`.as("total"),
              })
              .from(pointsLedger)
              .where(and(...conditions))
              .groupBy(pointsLedger.userId)
              .having(sql`SUM(${pointsLedger.amount}) > ${myTotal.total}`)
              .as("above"),
          )
          .get();

        myRank = (countAbove?.count ?? 0) + 1;
      }
    }

    return success(c, { leaderboard, myRank });
  },
);

// GET /ranking/:siteId - Alias for /leaderboard/:siteId
app.get("/ranking/:siteId", (c) => {
  const siteId = c.req.param("siteId");
  const query = new URL(c.req.url).search;
  return c.redirect(`/api/points/leaderboard/${siteId}${query}`, 307);
});

export default app;
