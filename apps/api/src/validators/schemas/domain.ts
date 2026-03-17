import { z } from "zod";
import {
  Category,
  HazardSubcategory,
  RiskLevel,
  Visibility,
  ReviewAction,
  RejectReason,
  ActionStatusUpdate,
  MembershipStatus,
  DisputeType,
  DisputeStatus,
  VoteCandidateSource,
  EducationContentType,
  QuizStatus,
  StatutoryTrainingType,
  TrainingCompletionStatus,
  TbmTopicCategory,
  UserRole,
  uuid,
  monthPattern,
  isoDateStr,
  nonEmptyStr,
} from "./shared.js";

// ─── Posts Schemas ───────────────────────────────────────────────────────────

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
  metadata: z.record(z.unknown()).optional(),
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

// ─── Reviews Schemas ─────────────────────────────────────────────────────────

export const ReviewActionSchema = z.object({
  postId: uuid,
  action: z.enum(ReviewAction),
  comment: z.string().optional(),
  reasonCode: z.enum(RejectReason).optional(),
});

// ─── Actions Schemas ─────────────────────────────────────────────────────────

export const CreateActionSchema = z.object({
  postId: uuid,
  assigneeType: z.string().min(1),
  assigneeId: uuid.optional(),
  dueDate: isoDateStr.optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  description: z.string().optional(),
});

export const UpdateActionStatusSchema = z.object({
  actionStatus: z.enum(ActionStatusUpdate),
  completionNote: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

// ─── Sites Schemas ───────────────────────────────────────────────────────────

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

// ─── Points Schemas ──────────────────────────────────────────────────────────

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

// ─── Policies Schemas ────────────────────────────────────────────────────────

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

// ─── Disputes Schemas ────────────────────────────────────────────────────────

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

// ─── Announcements Schemas ───────────────────────────────────────────────────

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

// ─── Votes Schemas ───────────────────────────────────────────────────────────

export const CastVoteSchema = z.object({
  siteId: uuid.optional(),
  candidateId: uuid,
});

// ─── Admin Schemas ───────────────────────────────────────────────────────────

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

export const AdminReviewPostSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_MORE"] as const),
  comment: z.string().optional(),
  reasonCode: z.string().optional(),
  pointsToAward: z.number().optional(),
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

export const AdminEmergencyDeleteSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmPostId: z.string().min(1),
});

export const AdminEmergencyUserPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmUserId: z.string().min(1),
});

export const AdminEmergencyActionPurgeSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  confirmActionId: z.string().min(1),
});

export const SettlementSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const SettlementFinalizeSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  confirm: z.boolean(),
});

export const AdminDeletePostSchema = z.object({
  reason: z.string().min(1),
});

export const DistributionQuerySchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    reasonCode: z.string(),
    page: z.coerce.number().int().min(1),
    limit: z.coerce.number().int().min(1).max(100),
  })
  .partial();

// ─── Education Schemas ───────────────────────────────────────────────────────

export const CreateCourseSchema = z.object({
  siteId: uuid,
  title: nonEmptyStr,
  description: z.string().optional(),
  contentType: z.enum(EducationContentType),
  contentUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  externalSource: z.enum(["LOCAL", "YOUTUBE", "KOSHA"] as const).optional(),
  externalId: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export const SubmitQuizSchema = z.object({
  quizId: uuid,
  siteId: uuid,
  answers: z.array(
    z.union([z.number().int(), z.array(z.number().int()), z.string()]),
  ),
  startedAt: isoDateStr,
  clientAttemptId: z.string().uuid().optional(),
});

export const UpdateStatutoryTrainingSchema = z.object({
  trainingType: z.enum(StatutoryTrainingType).optional(),
  trainingName: nonEmptyStr.optional(),
  trainingDate: isoDateStr.optional(),
  expirationDate: isoDateStr.optional(),
  provider: z.string().optional(),
  certificateUrl: z.string().optional(),
  hoursCompleted: z.number().nonnegative().optional(),
  status: z.enum(TrainingCompletionStatus).optional(),
  notes: z.string().optional(),
});

export const AttendTbmSchema = z.object({
  tbmRecordId: uuid,
});

// ─── Education Input Schemas (match frontend interfaces) ─────────────────────

export const CreateQuizInputSchema = z.object({
  siteId: uuid,
  contentId: uuid.optional(),
  title: nonEmptyStr,
  description: z.string().optional(),
  status: z.enum(QuizStatus).optional(),
  pointsReward: z.number().int().optional(),
  timeLimitMinutes: z.number().int().optional(),
});

export const CreateStatutoryTrainingInputSchema = z.object({
  siteId: uuid,
  userId: uuid,
  trainingType: z.enum(StatutoryTrainingType),
  trainingName: nonEmptyStr,
  trainingDate: isoDateStr,
  expirationDate: isoDateStr.optional(),
  provider: z.string().optional(),
  certificateUrl: z.string().optional(),
  hoursCompleted: z.number().nonnegative().optional(),
  status: z.enum(TrainingCompletionStatus).optional(),
  notes: z.string().optional(),
});

export const CreateTbmInputSchema = z.object({
  siteId: uuid,
  date: isoDateStr,
  topic: nonEmptyStr,
  topicCategory: z.enum(TbmTopicCategory).optional(),
  content: z.string().optional(),
  leaderId: uuid.optional(),
  weatherCondition: z.string().optional(),
  specialNotes: z.string().optional(),
});

export const UpdateTbmInputSchema = z
  .object({
    date: isoDateStr.optional(),
    topic: nonEmptyStr.optional(),
    topicCategory: z.enum(TbmTopicCategory).optional(),
    content: z.string().optional(),
    weatherCondition: z.string().optional(),
    specialNotes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const TbmRecordFilterSchema = z.object({
  siteId: uuid,
  date: isoDateStr.optional(),
  topicCategory: z.enum(TbmTopicCategory).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ─── Attendance Schemas ──────────────────────────────────────────────────────

export const ManualCheckinSchema = z.object({
  siteId: uuid,
  userId: uuid.optional(),
});

// ─── Users Schemas ───────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

// ─── FAS Schemas ─────────────────────────────────────────────────────────────

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

// ─── Alimtalk (알림톡) Schemas ────────────────────────────────────────────────

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
