import { eq, and, gte, count, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

export const DAILY_POINT_LIMIT = 30;
export const DAILY_POST_LIMIT = 3;

export function getKSTToday(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const cutoffHour = 5;
  if (kst.getUTCHours() < cutoffHour) {
    kst.setUTCDate(kst.getUTCDate() - 1);
  }
  kst.setUTCHours(cutoffHour, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000);
}

export function isDailyPostLimitExceeded(postCount: number): boolean {
  return postCount >= DAILY_POST_LIMIT;
}

export function getRemainingDailyPoints(totalPoints: number): number {
  return DAILY_POINT_LIMIT - totalPoints;
}

export function capToRemainingDailyPoints(
  totalPoints: number,
  remainingDaily: number,
): number {
  if (totalPoints > remainingDaily) {
    return remainingDaily;
  }

  return totalPoints;
}

export async function getDailyStats(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  todayStart: Date,
): Promise<{ postCount: number; totalPoints: number }> {
  const result = await db
    .select({
      postCount: count(),
      totalPoints: sum(schema.pointsLedger.amount),
    })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.siteId, siteId),
        eq(schema.pointsLedger.reasonCode, "POST_APPROVED"),
        gte(schema.pointsLedger.createdAt, todayStart),
      ),
    );

  return {
    postCount: result[0]?.postCount ?? 0,
    totalPoints: Number(result[0]?.totalPoints ?? 0),
  };
}
