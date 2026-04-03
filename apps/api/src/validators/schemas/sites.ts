import { z } from "zod";
import {
  MembershipStatus,
  VoteCandidateSource,
  UserRole,
  monthPattern,
  isoDateStr,
  uuid,
  nonEmptyStr,
} from "./shared.js";

export const CreateSiteSchema = z.object({
  name: nonEmptyStr,
  requiresApproval: z.boolean().optional(),
});

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(MembershipStatus),
  reason: z.string().optional(),
});

export const UpdateSiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
  leaderboardEnabled: z.boolean().optional(),
});

export const AdminChangeRoleSchema = z.object({
  role: z.enum(UserRole),
});

export const AdminSyncWorkersSchema = z.object({
  siteId: uuid,
  workers: z
    .array(
      z.object({
        externalWorkerId: z.string().min(1),
        name: nonEmptyStr,
        nationality: z.string().optional(),
        trade: z.string().optional(),
        company: z.string().optional(),
      }),
    )
    .min(1),
});

export const AdminManualApprovalSchema = z.object({
  userId: uuid,
  siteId: uuid,
  reason: nonEmptyStr,
});

export const AdminCreateVoteCandidateSchema = z.object({
  userId: uuid,
  siteId: uuid,
  month: monthPattern,
  source: z.enum(VoteCandidateSource).optional(),
});

export const AdminCreateVotePeriodSchema = z.object({
  startDate: isoDateStr,
  endDate: isoDateStr,
});

export const AdminResolveSyncErrorSchema = z.object({
  status: z.enum(["RESOLVED", "IGNORED"] as const),
});

export const AdminEmergencyUserPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmUserId: z.string().min(1),
});

export const ManualCheckinSchema = z.object({
  siteId: uuid,
  userId: uuid.optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

export const FasSyncRequestSchema = z.object({
  siteId: uuid,
  workers: z
    .array(
      z.object({
        externalWorkerId: z.string().optional(),
        name: z.string().optional(),
        phone: z.string().optional(),
        dob: z.string().optional(),
        companyName: z.string().optional(),
        tradeType: z.string().optional(),
      }),
    )
    .optional(),
});

export const AlimtalkSendSchema = z.object({
  siteId: uuid,
  userIds: z.array(uuid).min(1).max(100),
  templateCode: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  button: z
    .array(
      z.object({
        name: z.string().min(1).max(28),
        linkType: z.enum(["WL", "AL", "DS", "BK", "MD", "BC"]),
        linkTypeName: z.string().min(1),
      }),
    )
    .max(5)
    .optional(),
  fallbackSms: z.boolean().optional(),
});

export const SmartNotificationSendSchema = z.object({
  siteId: uuid,
  userIds: z.array(uuid).min(1).max(100),
  templateCode: z.string().min(1).max(50),
  message: z.string().min(1).max(1000),
  smsTitle: z.string().max(40).optional(),
  button: z
    .array(
      z.object({
        name: z.string().min(1).max(28),
        linkType: z.enum(["WL", "AL", "DS", "BK", "MD", "BC"]),
        linkTypeName: z.string().min(1),
      }),
    )
    .max(5)
    .optional(),
});
