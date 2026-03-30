export type ReviewAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_MORE"
  | "MARK_URGENT"
  | "ASSIGN"
  | "CLOSE";

export type ReviewStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "NEED_INFO"
  | "APPROVED"
  | "REJECTED"
  | "URGENT";

export type ActionStatus =
  | "NONE"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "OVERDUE";

export const validActions: ReviewAction[] = [
  "APPROVE",
  "REJECT",
  "REQUEST_MORE",
  "MARK_URGENT",
  "ASSIGN",
  "CLOSE",
];

export const VALID_TRANSITIONS: Record<ReviewStatus, ReviewAction[]> = {
  PENDING: ["APPROVE", "REJECT", "REQUEST_MORE", "MARK_URGENT", "ASSIGN"],
  IN_REVIEW: ["APPROVE", "REJECT", "REQUEST_MORE", "ASSIGN", "CLOSE"],
  NEED_INFO: ["APPROVE", "REJECT", "MARK_URGENT", "ASSIGN"],
  APPROVED: ["CLOSE"],
  REJECTED: [],
  URGENT: ["APPROVE", "REJECT", "REQUEST_MORE", "ASSIGN", "CLOSE"],
};

export const DEFAULT_APPROVAL_POINTS = 100;

export function isValidTransition(
  currentStatus: ReviewStatus,
  action: ReviewAction,
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(action) : false;
}

export function determineNewStatuses(
  action: ReviewAction,
  currentActionStatus: ActionStatus,
): {
  newReviewStatus: ReviewStatus;
  newActionStatus?: ActionStatus;
} {
  switch (action) {
    case "APPROVE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus:
          currentActionStatus === "NONE" ? "COMPLETED" : "VERIFIED",
      };
    case "REJECT":
      return { newReviewStatus: "REJECTED" };
    case "REQUEST_MORE":
      return { newReviewStatus: "NEED_INFO" };
    case "MARK_URGENT":
      return { newReviewStatus: "URGENT" };
    case "ASSIGN":
      return {
        newReviewStatus: "IN_REVIEW",
        newActionStatus: "ASSIGNED",
      };
    case "CLOSE":
      return {
        newReviewStatus: "APPROVED",
        newActionStatus: "VERIFIED",
      };
    default:
      return { newReviewStatus: "IN_REVIEW" };
  }
}
