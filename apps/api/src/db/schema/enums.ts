// ============================================================================
// ENUMS - Aligned with Prisma schema.prisma
// ============================================================================

export const userRoleEnum = [
  "WORKER",
  "SITE_ADMIN",
  "SUPER_ADMIN",
  "SYSTEM",
] as const;
export const membershipStatusEnum = [
  "PENDING",
  "ACTIVE",
  "LEFT",
  "REMOVED",
] as const;
export const membershipRoleEnum = ["WORKER", "SITE_ADMIN"] as const;
export const categoryEnum = [
  "HAZARD",
  "UNSAFE_BEHAVIOR",
  "INCONVENIENCE",
  "SUGGESTION",
  "BEST_PRACTICE",
] as const;
export const riskLevelEnum = ["HIGH", "MEDIUM", "LOW"] as const;
export const visibilityEnum = ["WORKER_PUBLIC", "ADMIN_ONLY"] as const;
export const reviewStatusEnum = [
  "PENDING",
  "IN_REVIEW",
  "NEED_INFO",
  "APPROVED",
  "REJECTED",
  "URGENT",
] as const;
export const actionStatusEnum = [
  "NONE",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
  "OVERDUE",
] as const;
export const actionPriorityEnum = ["HIGH", "MEDIUM", "LOW"] as const;
export const reviewActionEnum = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
] as const;
export const attendanceResultEnum = ["SUCCESS", "FAIL"] as const;
export const attendanceSourceEnum = ["FAS", "MANUAL"] as const;
export const voteCandidateSourceEnum = ["ADMIN", "AUTO"] as const;
export const disputeStatusEnum = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;
export const disputeTypeEnum = [
  "REVIEW_APPEAL",
  "POINT_DISPUTE",
  "ATTENDANCE_DISPUTE",
  "OTHER",
] as const;
export const approvalStatusEnum = ["PENDING", "APPROVED", "REJECTED"] as const;
export const hazardSubcategoryEnum = [
  "FALL",
  "COLLAPSE",
  "STRUCK_BY",
  "CAUGHT_IN",
  "ELECTROCUTION",
  "FIRE",
  "CHEMICAL",
  "OTHER",
] as const;
export const tbmTopicCategoryEnum = [
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

// Safety Education enums
export const educationContentTypeEnum = [
  "VIDEO",
  "IMAGE",
  "TEXT",
  "DOCUMENT",
] as const;
export const quizStatusEnum = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const statutoryTrainingTypeEnum = [
  "NEW_WORKER",
  "SPECIAL",
  "REGULAR",
  "CHANGE_OF_WORK",
] as const;
export const trainingCompletionStatusEnum = [
  "SCHEDULED",
  "COMPLETED",
  "EXPIRED",
] as const;

// Sync error enums
export const syncTypeEnum = [
  "FAS_ATTENDANCE",
  "FAS_WORKER",
  "ATTENDANCE_MANUAL",
] as const;
export const syncErrorStatusEnum = ["OPEN", "RESOLVED", "IGNORED"] as const;
