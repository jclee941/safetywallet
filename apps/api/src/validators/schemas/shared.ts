import { z } from "zod";

// ─── Shared Enum Values (must match Drizzle schema enums) ────────────────────

export const UserRole = [
  "WORKER",
  "SITE_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM",
] as const;
export const Category = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
] as const;
export const RiskLevel = ["HIGH", "MEDIUM", "LOW"] as const;
export const HazardSubcategory = [
  "FALL",
  "COLLAPSE",
  "STRUCK_BY",
  "CAUGHT_IN",
  "ELECTROCUTION",
  "FIRE",
  "CHEMICAL",
  "OTHER",
] as const;
export const Visibility = ["WORKER_PUBLIC", "ADMIN_ONLY"] as const;
export const ReviewAction = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
] as const;
export const RejectReason = [
  "DUPLICATE",
  "UNCLEAR_PHOTO",
  "INSUFFICIENT",
  "FALSE",
  "IRRELEVANT",
  "OTHER",
] as const;
export const ActionStatusUpdate = [
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;
export const ApprovalStatus = ["PENDING", "APPROVED", "REJECTED"] as const;
export const MembershipStatus = [
  "PENDING",
  "ACTIVE",
  "LEFT",
  "REMOVED",
] as const;
export const EducationContentType = [
  "VIDEO",
  "IMAGE",
  "TEXT",
  "DOCUMENT",
] as const;
export const QuizStatus = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const StatutoryTrainingType = [
  "NEW_WORKER",
  "SPECIAL",
  "REGULAR",
  "CHANGE_OF_WORK",
] as const;
export const TrainingCompletionStatus = [
  "SCHEDULED",
  "COMPLETED",
  "EXPIRED",
] as const;
export const TbmTopicCategory = [
  "FALL_PREVENTION",
  "SCAFFOLD_SAFETY",
  "EXCAVATION",
  "CRANE_OPERATION",
  "ELECTRICAL",
  "FIRE_PREVENTION",
  "PPE",
  "CHEMICAL_HANDLING",
  "CONFINED_SPACE",
  "TRAFFIC",
  "WEATHER",
  "GENERAL",
] as const;

// Schema-only enums (not in packages/types)
export const DisputeType = [
  "REVIEW_APPEAL",
  "POINT_DISPUTE",
  "ATTENDANCE_DISPUTE",
  "OTHER",
] as const;
export const DisputeStatus = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;
export const VoteCandidateSource = ["ADMIN", "AUTO"] as const;

// ─── Reusable Primitives ─────────────────────────────────────────────────────

export const uuid = z.string().min(1).max(100);
export const monthPattern = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format");
export const isoDateStr = z.string().min(1);
export const nonEmptyStr = z.string().min(1).max(5000);
