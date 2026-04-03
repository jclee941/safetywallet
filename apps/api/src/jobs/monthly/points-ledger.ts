import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { auditLogs, pointsLedger, siteMemberships } from "../../db/schema";
import { dbBatchChunked } from "../../db/helpers";
import { log } from "../helpers";

type DbClient = DrizzleD1Database<Record<string, never>>;

export async function executeMonthEndSnapshotLedger(params: {
  db: DbClient;
  kstNow: Date;
  start: Date;
  end: Date;
  settleMonth: string;
  systemUserId: string;
}): Promise<void> {
  const { db, kstNow, start, end, settleMonth, systemUserId } = params;

  const existingSnapshots = await db
    .select({ id: pointsLedger.id })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.reasonCode, "MONTHLY_SNAPSHOT"),
        eq(pointsLedger.settleMonth, settleMonth),
      ),
    )
    .limit(1)
    .all();

  if (existingSnapshots.length > 0) {
    log.warn("Month-end snapshot already exists, skipping", { settleMonth });
    return;
  }

  const memberships = await db
    .select({ userId: siteMemberships.userId, siteId: siteMemberships.siteId })
    .from(siteMemberships)
    .where(eq(siteMemberships.status, "ACTIVE"))
    .all();

  const balances: Array<{ userId: string; siteId: string; balance: number }> =
    [];

  for (const membership of memberships) {
    const result = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${pointsLedger.amount}), 0)`,
      })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.userId, membership.userId),
          eq(pointsLedger.siteId, membership.siteId),
          gte(pointsLedger.createdAt, start),
          lt(pointsLedger.createdAt, end),
        ),
      )
      .get();

    const monthlyBalance = result?.balance || 0;
    if (monthlyBalance !== 0) {
      balances.push({
        userId: membership.userId,
        siteId: membership.siteId,
        balance: monthlyBalance,
      });
    }
  }

  if (balances.length > 0) {
    const ops: Promise<unknown>[] = balances.map((b) =>
      db.insert(pointsLedger).values({
        userId: b.userId,
        siteId: b.siteId,
        amount: 0,
        reasonCode: "MONTHLY_SNAPSHOT",
        reasonText: `월간 정산 스냅샷 - ${kstNow.getFullYear()}년 ${kstNow.getMonth() + 1}월 (잔액: ${b.balance})`,
        settleMonth,
      }),
    );

    ops.push(
      db.insert(auditLogs).values({
        actorId: systemUserId,
        action: "MONTH_END_SNAPSHOT",
        targetType: "POINTS",
        targetId: settleMonth,
        reason: JSON.stringify({
          period: settleMonth,
          membershipCount: memberships.length,
          snapshotCount: balances.length,
        }),
        ip: "SYSTEM",
      }),
    );

    try {
      await dbBatchChunked(db, ops);
    } catch (err) {
      log.error("Month-end snapshot batch failed", {
        settleMonth,
        balanceCount: balances.length,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  log.info("Snapshot complete", { snapshotCount: balances.length });
}
