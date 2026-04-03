import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  auditLogs,
  pointPolicies,
  pointsLedger,
  votePeriods,
  votes,
} from "../../db/schema";
import type { Env } from "../../types";
import { VOTE_REWARD_POINTS, VOTE_REWARD_POINT_CODES, log } from "../helpers";
import { enqueueVoteRewardNotifications } from "./notifications";
type DbClient = DrizzleD1Database<Record<string, never>>;
export async function executeVoteRewardDistribution(params: {
  db: DbClient;
  env: Env;
  nowEpoch: number;
  systemUserId: string;
}): Promise<void> {
  const { db, env, nowEpoch, systemUserId } = params;
  const completedPeriods = await db
    .select({
      siteId: votePeriods.siteId,
      month: votePeriods.month,
      endDate: votePeriods.endDate,
    })
    .from(votePeriods)
    .where(lt(votePeriods.endDate, nowEpoch))
    .all();

  if (completedPeriods.length === 0) {
    log.info("No completed vote periods for reward distribution");
    return;
  }
  let processedPeriods = 0;
  let skippedPeriods = 0;
  let rewardedUsers = 0;
  let awardedPoints = 0;

  for (const period of completedPeriods) {
    const existingReward = await db
      .select({ id: pointsLedger.id })
      .from(pointsLedger)
      .where(
        and(
          eq(pointsLedger.siteId, period.siteId),
          eq(pointsLedger.settleMonth, period.month),
          sql`${pointsLedger.reasonCode} IN (${VOTE_REWARD_POINT_CODES[0]}, ${VOTE_REWARD_POINT_CODES[1]}, ${VOTE_REWARD_POINT_CODES[2]})`,
        ),
      )
      .limit(1)
      .all();

    if (existingReward.length > 0) {
      skippedPeriods += 1;
      continue;
    }

    const winners = await db
      .select({
        candidateId: votes.candidateId,
        voteCount: sql<number>`COUNT(*)`.as("voteCount"),
      })
      .from(votes)
      .where(
        and(eq(votes.siteId, period.siteId), eq(votes.month, period.month)),
      )
      .groupBy(votes.candidateId)
      .orderBy(desc(sql`COUNT(*)`), sql`MIN(${votes.votedAt})`)
      .limit(3)
      .all();

    if (winners.length === 0) {
      skippedPeriods += 1;
      continue;
    }

    const rewardPolicies = await db
      .select({
        reasonCode: pointPolicies.reasonCode,
        defaultAmount: pointPolicies.defaultAmount,
      })
      .from(pointPolicies)
      .where(
        and(
          eq(pointPolicies.siteId, period.siteId),
          inArray(pointPolicies.reasonCode, [...VOTE_REWARD_POINT_CODES]),
          eq(pointPolicies.isActive, true),
        ),
      )
      .all();

    const rewardAmountMap = new Map<string, number>();
    for (const policy of rewardPolicies) {
      rewardAmountMap.set(policy.reasonCode, policy.defaultAmount);
    }

    const rewards = winners.map((winner, index) => {
      const reasonCode = VOTE_REWARD_POINT_CODES[index];
      const points =
        rewardAmountMap.get(reasonCode) ?? VOTE_REWARD_POINTS[index];
      return {
        userId: winner.candidateId,
        siteId: period.siteId,
        amount: points,
        reasonCode,
        reasonText: `월간 투표 ${index + 1}위 보상 (${winner.voteCount}표)`,
        settleMonth: period.month,
        adminId: systemUserId,
      };
    });

    await db.insert(pointsLedger).values(rewards);

    await enqueueVoteRewardNotifications({
      db,
      notificationQueue: env.NOTIFICATION_QUEUE,
      rewardedUserIds: rewards.map((r) => r.userId),
    });

    processedPeriods += 1;
    rewardedUsers += rewards.length;
    awardedPoints += rewards.reduce((sum, reward) => sum + reward.amount, 0);
  }

  if (processedPeriods > 0) {
    await db.insert(auditLogs).values({
      actorId: systemUserId,
      action: "VOTE_REWARD_DISTRIBUTED",
      targetType: "VOTE",
      targetId: new Date().toISOString(),
      reason: JSON.stringify({
        processedPeriods,
        skippedPeriods,
        rewardedUsers,
        awardedPoints,
      }),
      ip: "SYSTEM",
    });
  }

  log.info("Vote reward distribution completed", {
    totalCompletedPeriods: completedPeriods.length,
    processedPeriods,
    skippedPeriods,
    rewardedUsers,
    awardedPoints,
  });
}
