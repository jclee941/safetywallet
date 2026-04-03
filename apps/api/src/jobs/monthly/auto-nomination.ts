import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  auditLogs,
  pointsLedger,
  siteMemberships,
  sites,
  voteCandidates,
} from "../../db/schema";
import { dbBatchChunked } from "../../db/helpers";
import { log } from "../helpers";

type DbClient = DrizzleD1Database<Record<string, never>>;

export async function executeAutoNomination(params: {
  db: DbClient;
  prevMonth: string;
  monthStart: Date;
  monthEnd: Date;
  systemUserId: string;
}): Promise<void> {
  const { db, prevMonth, monthStart, monthEnd, systemUserId } = params;

  const activeSites = await db
    .select({ id: sites.id, name: sites.name, topN: sites.autoNominationTopN })
    .from(sites)
    .where(and(eq(sites.active, true), gte(sites.autoNominationTopN, 1)));

  if (activeSites.length === 0) {
    log.info("No sites with auto-nomination enabled");
    return;
  }

  let totalNominated = 0;

  for (const site of activeSites) {
    const topEarners = await db
      .select({
        userId: pointsLedger.userId,
        totalPoints: sql<number>`SUM(${pointsLedger.amount})`.as("totalPoints"),
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.siteId, site.id),
          gte(pointsLedger.createdAt, monthStart),
          lt(pointsLedger.createdAt, monthEnd),
        ),
      )
      .groupBy(pointsLedger.userId)
      .orderBy(desc(sql`SUM(${pointsLedger.amount})`))
      .limit(site.topN);

    if (topEarners.length === 0) {
      log.info("No point earners for site", {
        siteId: site.id,
        siteName: site.name,
      });
      continue;
    }

    const activeMembers = await db
      .select({ userId: siteMemberships.userId })
      .from(siteMemberships)
      .where(
        and(
          eq(siteMemberships.siteId, site.id),
          eq(siteMemberships.status, "ACTIVE"),
          inArray(
            siteMemberships.userId,
            topEarners.map((e) => e.userId),
          ),
        ),
      );

    const activeMemberIds = new Set(activeMembers.map((m) => m.userId));
    const eligibleEarners = topEarners.filter((e) =>
      activeMemberIds.has(e.userId),
    );

    if (eligibleEarners.length === 0) {
      log.info("No eligible earners for site", { siteId: site.id });
      continue;
    }

    await dbBatchChunked(
      db,
      eligibleEarners.map((earner) =>
        db
          .insert(voteCandidates)
          .values({
            id: crypto.randomUUID(),
            siteId: site.id,
            month: prevMonth,
            userId: earner.userId,
            source: "AUTO",
          })
          .onConflictDoNothing(),
      ),
    );

    totalNominated += eligibleEarners.length;
    log.info("Auto-nominated candidates for site", {
      siteId: site.id,
      siteName: site.name,
      count: eligibleEarners.length,
      topN: site.topN,
    });
  }

  await db.insert(auditLogs).values({
    action: "AUTO_NOMINATE_CANDIDATES",
    actorId: systemUserId,
    targetType: "VOTE_CANDIDATE",
    targetId: prevMonth,
    reason: JSON.stringify({
      month: prevMonth,
      sitesProcessed: activeSites.length,
      totalNominated,
    }),
    ip: "SYSTEM",
  });

  log.info("Auto-nomination complete", {
    month: prevMonth,
    sitesProcessed: activeSites.length,
    totalNominated,
  });
}
