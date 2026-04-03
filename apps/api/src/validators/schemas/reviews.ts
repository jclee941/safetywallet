import { z } from "zod";
import {
  ReviewAction,
  RejectReason,
  DisputeType,
  DisputeStatus,
  uuid,
  nonEmptyStr,
} from "./shared.js";

export const ReviewActionSchema = z.object({
  postId: uuid,
  action: z.enum(ReviewAction),
  comment: z.string().optional(),
  reasonCode: z.enum(RejectReason).optional(),
});

export const CreateDisputeSchema = z.object({
  siteId: uuid,
  type: z.enum(DisputeType),
  title: nonEmptyStr,
  description: nonEmptyStr,
  refReviewId: uuid.optional(),
  refPointsLedgerId: uuid.optional(),
  refAttendanceId: uuid.optional(),
});

export const ResolveDisputeSchema = z.object({
  status: z.enum(["RESOLVED", "REJECTED"] as const),
  resolutionNote: nonEmptyStr,
});

export const UpdateDisputeStatusSchema = z.object({
  status: z.enum(DisputeStatus),
});
