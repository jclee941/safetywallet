import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  calculateFalseReportPenaltyAmount,
  FALSE_REPORT_PENALTY_MULTIPLIER,
} from "./calculator";

export async function calculateFalseReportPenalty(
  db: ReturnType<typeof drizzle>,
  userId: string,
  _siteId: string,
  originalPostId: string,
): Promise<{ penaltyAmount: number; breakdown: string }> {
  const originalLedger = await db
    .select({ amount: schema.pointsLedger.amount })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.postId, originalPostId),
        eq(schema.pointsLedger.userId, userId),
        eq(schema.pointsLedger.reasonCode, "POST_APPROVED"),
      ),
    )
    .limit(1);

  const originalAmount = originalLedger[0]?.amount ?? 0;
  const penaltyAmount = calculateFalseReportPenaltyAmount(originalAmount);

  return {
    penaltyAmount,
    breakdown: `허위 신고 페널티: 원래 ${originalAmount}점 × ${FALSE_REPORT_PENALTY_MULTIPLIER}배 = ${Math.abs(penaltyAmount)}점 차감`,
  };
}

export async function applyFalseReportPenalty(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  postId: string,
  adminId: string,
): Promise<{ penaltyAmount: number; ledgerId: string }> {
  const existingPenaltyLedger = await db
    .select({
      id: schema.pointsLedger.id,
      amount: schema.pointsLedger.amount,
    })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.postId, postId),
        eq(schema.pointsLedger.reasonCode, "FALSE_REPORT_PENALTY"),
      ),
    )
    .limit(1);

  if (existingPenaltyLedger[0]) {
    return {
      penaltyAmount: existingPenaltyLedger[0].amount,
      ledgerId: existingPenaltyLedger[0].id,
    };
  }

  const { penaltyAmount, breakdown } = await calculateFalseReportPenalty(
    db,
    userId,
    siteId,
    postId,
  );

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ledgerId = crypto.randomUUID();

  await db.insert(schema.pointsLedger).values({
    id: ledgerId,
    userId,
    siteId,
    postId,
    amount: penaltyAmount,
    reasonCode: "FALSE_REPORT_PENALTY",
    reasonText: breakdown,
    adminId,
    settleMonth,
    occurredAt: now,
    createdAt: now,
  });

  return { penaltyAmount, ledgerId };
}
