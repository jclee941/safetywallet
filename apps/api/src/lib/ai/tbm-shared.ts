import { isStringArray } from "./hazard";

export const TBM_RISK_LEVELS = ["high", "medium", "low"] as const;

export interface TbmAnalysisResult {
  riskLevel: string;
  summary: string;
  identifiedRisks: string[];
  safetyChecklist: string[];
  precautions: string[];
  relatedRegulations: string[];
  confidence: number;
  modelVersion: string;
}

export interface TbmMeetingMinutesResult {
  title: string;
  date: string;
  location: string;
  leader: string;
  attendeeCount: number;
  weatherCondition: string;
  agenda: string[];
  discussionPoints: string[];
  safetyInstructions: string[];
  riskAssessment: { level: string; keyRisks: string[] };
  actionItems: string[];
  conclusion: string;
  modelVersion: string;
}

export function isValidTbmAnalysisShape(
  value: unknown,
): value is Omit<TbmAnalysisResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.riskLevel === "string" &&
    TBM_RISK_LEVELS.includes(c.riskLevel as (typeof TBM_RISK_LEVELS)[number]) &&
    typeof c.summary === "string" &&
    isStringArray(c.identifiedRisks) &&
    isStringArray(c.safetyChecklist) &&
    isStringArray(c.precautions) &&
    isStringArray(c.relatedRegulations) &&
    typeof c.confidence === "number" &&
    c.confidence >= 0 &&
    c.confidence <= 1
  );
}

export function isValidTbmMeetingMinutesShape(
  value: unknown,
): value is Omit<TbmMeetingMinutesResult, "modelVersion"> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  const riskAssessment = c.riskAssessment;
  if (typeof riskAssessment !== "object" || riskAssessment === null)
    return false;
  const risk = riskAssessment as Record<string, unknown>;
  const riskLevel = risk.level;
  return (
    typeof c.title === "string" &&
    typeof c.date === "string" &&
    typeof c.location === "string" &&
    typeof c.leader === "string" &&
    typeof c.attendeeCount === "number" &&
    Number.isInteger(c.attendeeCount) &&
    c.attendeeCount >= 0 &&
    typeof c.weatherCondition === "string" &&
    isStringArray(c.agenda) &&
    isStringArray(c.discussionPoints) &&
    isStringArray(c.safetyInstructions) &&
    typeof riskLevel === "string" &&
    ["high", "medium", "low"].includes(riskLevel) &&
    isStringArray(risk.keyRisks) &&
    isStringArray(c.actionItems) &&
    typeof c.conclusion === "string"
  );
}

export const TBM_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    riskLevel: { type: "STRING" as const, enum: [...TBM_RISK_LEVELS] },
    summary: { type: "STRING" as const },
    identifiedRisks: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    safetyChecklist: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    precautions: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    relatedRegulations: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    confidence: { type: "NUMBER" as const },
  },
  required: [
    "riskLevel",
    "summary",
    "identifiedRisks",
    "safetyChecklist",
    "precautions",
    "relatedRegulations",
    "confidence",
  ],
};

export const TBM_MEETING_MINUTES_RESPONSE_SCHEMA = {
  type: "OBJECT" as const,
  properties: {
    title: { type: "STRING" as const },
    date: { type: "STRING" as const },
    location: { type: "STRING" as const },
    leader: { type: "STRING" as const },
    attendeeCount: { type: "INTEGER" as const },
    weatherCondition: { type: "STRING" as const },
    agenda: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    discussionPoints: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    safetyInstructions: {
      type: "ARRAY" as const,
      items: { type: "STRING" as const },
    },
    riskAssessment: {
      type: "OBJECT" as const,
      properties: {
        level: { type: "STRING" as const, enum: ["high", "medium", "low"] },
        keyRisks: {
          type: "ARRAY" as const,
          items: { type: "STRING" as const },
        },
      },
      required: ["level", "keyRisks"],
    },
    actionItems: { type: "ARRAY" as const, items: { type: "STRING" as const } },
    conclusion: { type: "STRING" as const },
  },
  required: [
    "title",
    "date",
    "location",
    "leader",
    "attendeeCount",
    "weatherCondition",
    "agenda",
    "discussionPoints",
    "safetyInstructions",
    "riskAssessment",
    "actionItems",
    "conclusion",
  ],
};
