import { z } from "zod";
import { uuid, nonEmptyStr } from "./shared.js";

export const AwardPointsSchema = z.object({
  userId: uuid,
  siteId: uuid,
  postId: uuid.optional(),
  amount: z.number().int(),
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
});

export const AdminCorrectPointsSchema = z.object({
  ledgerId: uuid,
  reason: z.string().min(1).max(500),
  correctionType: z.enum(["CORRECTION", "REVOKE"]),
  correctedAmount: z.number().optional(),
});

export const CreatePolicySchema = z.object({
  siteId: uuid,
  reasonCode: z.string().min(1),
  name: nonEmptyStr,
  description: z.string().optional(),
  defaultAmount: z.number(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  dailyLimit: z.number().optional(),
  monthlyLimit: z.number().optional(),
});

export const UpdatePolicySchema = z.object({
  name: nonEmptyStr.optional(),
  description: z.string().optional(),
  defaultAmount: z.number().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  dailyLimit: z.number().optional(),
  monthlyLimit: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const CreateAnnouncementSchema = z.object({
  siteId: uuid,
  title: nonEmptyStr,
  content: nonEmptyStr,
  isPinned: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const UpdateAnnouncementSchema = z.object({
  title: nonEmptyStr.optional(),
  content: nonEmptyStr.optional(),
  isPinned: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const CastVoteSchema = z.object({
  siteId: uuid.optional(),
  candidateId: uuid,
});

export const SettlementSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const SettlementFinalizeSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  confirm: z.boolean(),
});

export const DistributionQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    reasonCode: z.string(),
    page: z.coerce.number().int().min(1),
    limit: z.coerce.number().int().min(1).max(100),
  })
  .partial();
