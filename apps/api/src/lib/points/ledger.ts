import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  type PointCalculationInput,
  type PointCalculationResult,
} from "./calculator";
import { calculateApprovalPoints } from "./approval-engine";

export async function awardApprovalPoints(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
  adminId: string,
): Promise<{
  awarded: boolean;
  result: PointCalculationResult;
  ledgerId?: string;
}> {
  const existingLedger = await db
    .select({
      id: schema.pointsLedger.id,
      amount: schema.pointsLedger.amount,
      reasonText: schema.pointsLedger.reasonText,
    })
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.postId, input.postId),
        eq(schema.pointsLedger.reasonCode, "POST_APPROVED"),
      ),
    )
    .limit(1);

  if (existingLedger[0]) {
    return {
      awarded: true,
      result: {
        totalPoints: existingLedger[0].amount,
        basePoints: existingLedger[0].amount,
        riskBonus: 0,
        breakdown: existingLedger[0].reasonText ?? "기존 승인 포인트",
        blocked: false,
        blockReason: null,
      },
      ledgerId: existingLedger[0].id,
    };
  }

  const result = await calculateApprovalPoints(db, input);

  if (result.blocked || result.totalPoints <= 0) {
    return { awarded: false, result };
  }

  const now = new Date();
  const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const insertResult = await db
    .insert(schema.pointsLedger)
    .values({
      userId: input.userId,
      siteId: input.siteId,
      postId: input.postId,
      amount: result.totalPoints,
      reasonCode: "POST_APPROVED",
      reasonText: result.breakdown,
      adminId,
      settleMonth,
      occurredAt: now,
      createdAt: now,
    })
    .returning({ id: schema.pointsLedger.id });

  const ledgerId = insertResult[0]?.id ?? "";

  return { awarded: true, result, ledgerId };
}
