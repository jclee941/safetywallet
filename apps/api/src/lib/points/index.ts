export {
  calculateApprovalPoints,
  calculateFalseReportPenalty,
  awardApprovalPoints,
  applyFalseReportPenalty,
} from "./engine";

export type {
  Category,
  RiskLevel,
  PointCalculationInput,
  PointCalculationResult,
} from "./calculator";
