import { z } from "zod";
import {
  Category,
  HazardSubcategory,
  RiskLevel,
  Visibility,
  uuid,
  nonEmptyStr,
} from "./shared.js";

export const CreatePostSchema = z.object({
  siteId: uuid,
  category: z.enum(Category),
  content: nonEmptyStr,
  hazardType: z.string().optional(),
  hazardSubcategory: z.enum(HazardSubcategory).optional(),
  riskLevel: z.enum(RiskLevel).optional(),
  locationFloor: z.string().optional(),
  locationZone: z.string().optional(),
  locationDetail: z.string().optional(),
  visibility: z.enum(Visibility).optional(),
  isAnonymous: z.boolean().optional(),
  imageUrls: z.array(z.string()).optional(),
  imageHashes: z.array(z.string().nullable()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  clientMutationId: z.string().uuid().optional(),
});

export const PostFilterSchema = z.object({
  siteId: uuid.optional(),
  category: z.enum(Category).optional(),
  hazardSubcategory: z.enum(HazardSubcategory).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const ResubmitPostSchema = z.object({
  supplementaryContent: z.string().min(1).max(2000),
});

export const AdminReviewPostSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_MORE"] as const),
  comment: z.string().optional(),
  reasonCode: z.string().optional(),
  pointsToAward: z.number().optional(),
});

export const AdminEmergencyDeleteSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmPostId: z.string().min(1),
});

export const AdminDeletePostSchema = z.object({
  reason: z.string().min(1),
});
