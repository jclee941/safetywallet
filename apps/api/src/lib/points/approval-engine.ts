import { drizzle } from "drizzle-orm/d1";
import {
  calculateBasePoints,
  buildApprovalBreakdown,
  getSitePolicy,
  type PointCalculationInput,
  type PointCalculationResult,
} from "./calculator";
import { calculateRiskBonus } from "./risk-bonus";
import {
  DAILY_POINT_LIMIT,
  DAILY_POST_LIMIT,
  getKSTToday,
  isDailyPostLimitExceeded,
  getRemainingDailyPoints,
  capToRemainingDailyPoints,
  getDailyStats,
} from "./limits";
import { checkDuplicate } from "./duplicate-check";

export async function calculateApprovalPoints(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
): Promise<PointCalculationResult> {
  const todayStart = getKSTToday();

  const [dailyStats, sitePolicy, duplicateExists] = await Promise.all([
    getDailyStats(db, input.userId, input.siteId, todayStart),
    getSitePolicy(db, input.siteId, input.category),
    checkDuplicate(db, input),
  ]);

  if (duplicateExists) {
    return {
      totalPoints: 0,
      basePoints: 0,
      riskBonus: 0,
      breakdown: "중복 게시물 (24시간 내 동일 위치+카테고리)",
      blocked: true,
      blockReason: "DUPLICATE_WITHIN_24H",
    };
  }

  if (isDailyPostLimitExceeded(dailyStats.postCount)) {
    return {
      totalPoints: 0,
      basePoints: 0,
      riskBonus: 0,
      breakdown: `일일 게시물 한도 초과 (${DAILY_POST_LIMIT}건)`,
      blocked: true,
      blockReason: "DAILY_POST_LIMIT",
    };
  }

  const basePoints = calculateBasePoints(
    input.category,
    sitePolicy?.defaultAmount,
  );
  const riskBonus = calculateRiskBonus(input.riskLevel);
  let totalPoints = basePoints + riskBonus;

  const remainingDaily = getRemainingDailyPoints(dailyStats.totalPoints);
  if (remainingDaily <= 0) {
    return {
      totalPoints: 0,
      basePoints,
      riskBonus,
      breakdown: `일일 포인트 한도 초과 (${DAILY_POINT_LIMIT}점)`,
      blocked: true,
      blockReason: "DAILY_POINT_LIMIT",
    };
  }

  totalPoints = capToRemainingDailyPoints(totalPoints, remainingDaily);

  return {
    totalPoints,
    basePoints,
    riskBonus,
    breakdown: buildApprovalBreakdown(basePoints, riskBonus, totalPoints),
    blocked: false,
    blockReason: null,
  };
}
