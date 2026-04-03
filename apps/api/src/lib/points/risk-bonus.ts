import type { RiskLevel } from "./calculator";

const DEFAULT_RISK_BONUS: Record<RiskLevel, number> = {
  HIGH: 5,
  MEDIUM: 3,
  LOW: 0,
};

export function calculateRiskBonus(riskLevel: RiskLevel | null): number {
  return riskLevel ? DEFAULT_RISK_BONUS[riskLevel] : 0;
}
