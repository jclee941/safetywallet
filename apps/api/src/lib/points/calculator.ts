import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

export type Category =
  | "HAZARD"
  | "UNSAFE_BEHAVIOR"
  | "INCONVENIENCE"
  | "SUGGESTION"
  | "BEST_PRACTICE";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface PointCalculationInput {
  postId: string;
  userId: string;
  siteId: string;
  category: Category;
  riskLevel: RiskLevel | null;
  locationFloor: string | null;
  locationZone: string | null;
}

export interface PointCalculationResult {
  totalPoints: number;
  basePoints: number;
  riskBonus: number;
  breakdown: string;
  blocked: boolean;
  blockReason: string | null;
}

const DEFAULT_BASE_POINTS: Record<Category, number> = {
  HAZARD: 10,
  UNSAFE_BEHAVIOR: 8,
  INCONVENIENCE: 5,
  SUGGESTION: 7,
  BEST_PRACTICE: 10,
};

export const FALSE_REPORT_PENALTY_MULTIPLIER = 2;

export function calculateBasePoints(
  category: Category,
  policyDefaultAmount: number | null | undefined,
): number {
  return policyDefaultAmount ?? DEFAULT_BASE_POINTS[category];
}

export function calculateFalseReportPenaltyAmount(
  originalAmount: number,
): number {
  return -(originalAmount * FALSE_REPORT_PENALTY_MULTIPLIER);
}

export function buildApprovalBreakdown(
  basePoints: number,
  riskBonus: number,
  totalPoints: number,
): string {
  const parts: string[] = [];
  parts.push(`기본 ${basePoints}점`);
  if (riskBonus > 0) {
    parts.push(`위험도 보너스 ${riskBonus}점`);
  }
  if (totalPoints < basePoints + riskBonus) {
    parts.push(`일일 한도로 ${totalPoints}점 조정`);
  }

  return parts.join(" + ");
}

export async function getSitePolicy(
  db: ReturnType<typeof drizzle>,
  siteId: string,
  category: Category,
): Promise<{ defaultAmount: number } | null> {
  const reasonCode = `POST_${category}`;

  const policy = await db
    .select({ defaultAmount: schema.pointPolicies.defaultAmount })
    .from(schema.pointPolicies)
    .where(
      and(
        eq(schema.pointPolicies.siteId, siteId),
        eq(schema.pointPolicies.reasonCode, reasonCode),
        eq(schema.pointPolicies.isActive, true),
      ),
    )
    .limit(1);

  return policy[0] ?? null;
}
