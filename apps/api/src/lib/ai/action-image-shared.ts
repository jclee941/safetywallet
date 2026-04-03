import { isStringArray } from "./hazard";

export interface ActionImageAnalysisResult {
  complianceStatus: string;
  ppeDetected: string[];
  ppeMissing: string[];
  safetyObservations: string[];
  improvementAreas: string[];
  beforeAfterComparison: string | null;
  overallAssessment: string;
  confidence: number;
  modelVersion: string;
}

export interface BeforeAfterComparisonResult {
  overallImprovement:
    | "SIGNIFICANT"
    | "MODERATE"
    | "MINIMAL"
    | "NONE"
    | "WORSENED";
  improvementScore: number;
  beforeCondition: string;
  afterCondition: string;
  changesIdentified: string[];
  remainingIssues: string[];
  complianceImprovement: boolean;
  safetyRating: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  recommendation: string;
  confidence: number;
  modelVersion: string;
}

export const OVERALL_IMPROVEMENTS = [
  "SIGNIFICANT",
  "MODERATE",
  "MINIMAL",
  "NONE",
  "WORSENED",
] as const;
export const SAFETY_RATINGS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;

export function isValidBeforeAfterComparisonShape(
  value: unknown,
): value is Omit<BeforeAfterComparisonResult, "modelVersion"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.overallImprovement === "string" &&
    OVERALL_IMPROVEMENTS.includes(
      v.overallImprovement as (typeof OVERALL_IMPROVEMENTS)[number],
    ) &&
    typeof v.improvementScore === "number" &&
    v.improvementScore >= 0 &&
    v.improvementScore <= 100 &&
    typeof v.beforeCondition === "string" &&
    typeof v.afterCondition === "string" &&
    isStringArray(v.changesIdentified) &&
    isStringArray(v.remainingIssues) &&
    typeof v.complianceImprovement === "boolean" &&
    typeof v.safetyRating === "string" &&
    SAFETY_RATINGS.includes(
      v.safetyRating as (typeof SAFETY_RATINGS)[number],
    ) &&
    typeof v.recommendation === "string" &&
    typeof v.confidence === "number" &&
    v.confidence >= 0 &&
    v.confidence <= 100
  );
}

export function isValidActionImageAnalysisShape(
  value: unknown,
): value is Omit<ActionImageAnalysisResult, "modelVersion"> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.complianceStatus === "string" &&
    isStringArray(v.ppeDetected) &&
    isStringArray(v.ppeMissing) &&
    isStringArray(v.safetyObservations) &&
    isStringArray(v.improvementAreas) &&
    (v.beforeAfterComparison === null ||
      typeof v.beforeAfterComparison === "string") &&
    typeof v.overallAssessment === "string" &&
    typeof v.confidence === "number" &&
    v.confidence >= 0 &&
    v.confidence <= 100
  );
}

export const ACTION_IMAGE_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    complianceStatus: {
      type: "STRING" as const,
      enum: ["compliant", "non_compliant", "partial", "not_applicable"],
    },
    ppeDetected: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    ppeMissing: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    safetyObservations: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    improvementAreas: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    beforeAfterComparison: { type: "STRING" as const, nullable: true },
    overallAssessment: { type: "STRING" as const },
    confidence: { type: "INTEGER" as const },
  },
  required: [
    "complianceStatus",
    "ppeDetected",
    "ppeMissing",
    "safetyObservations",
    "improvementAreas",
    "overallAssessment",
    "confidence",
  ],
};

export const BEFORE_AFTER_COMPARISON_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    overallImprovement: {
      type: "STRING" as const,
      enum: [...OVERALL_IMPROVEMENTS],
    },
    improvementScore: { type: "INTEGER" as const },
    beforeCondition: { type: "STRING" as const },
    afterCondition: { type: "STRING" as const },
    changesIdentified: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    remainingIssues: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    complianceImprovement: { type: "BOOLEAN" as const },
    safetyRating: { type: "STRING" as const, enum: [...SAFETY_RATINGS] },
    recommendation: { type: "STRING" as const },
    confidence: { type: "INTEGER" as const },
  },
  required: [
    "overallImprovement",
    "improvementScore",
    "beforeCondition",
    "afterCondition",
    "changesIdentified",
    "remainingIssues",
    "complianceImprovement",
    "safetyRating",
    "recommendation",
    "confidence",
  ],
};
