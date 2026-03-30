import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  userRoleEnum,
  membershipStatusEnum,
  membershipRoleEnum,
} from "./enums";

// Cross-domain imports for usersRelations and sitesRelations
import { posts, postImages, reviews, pointsLedger } from "./safety";
import {
  actions,
  actionImages,
  auditLogs,
  announcements,
  attendance,
  accessPolicies,
  manualApprovals,
} from "./safety-actions";
import { votes, voteCandidates, disputes } from "./safety-votes";
import { educationContents, quizzes, quizAttempts } from "./education";
import { statutoryTrainings, tbmRecords, tbmAttendees } from "./training";

// ============================================================================
// IDENTITY TABLES
// ============================================================================

export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    phoneEncrypted: text("phone_encrypted"),
    phoneHash: text("phone_hash"),
    name: text("name"),
    nameMasked: text("name_masked"),
    dobEncrypted: text("dob_encrypted"),
    dobHash: text("dob_hash"),
    externalSystem: text("external_system"),
    externalWorkerId: text("external_worker_id"),
    companyName: text("company_name"),
    tradeType: text("trade_type"),
    role: text("role", { enum: userRoleEnum }).default("WORKER").notNull(),
    piiViewFull: integer("pii_view_full", { mode: "boolean" })
      .default(false)
      .notNull(),
    canAwardPoints: integer("can_award_points", { mode: "boolean" })
      .default(false)
      .notNull(),
    canManageUsers: integer("can_manage_users", { mode: "boolean" })
      .default(false)
      .notNull(),
    canReview: integer("can_review", { mode: "boolean" })
      .default(false)
      .notNull(),
    canExportData: integer("can_export_data", { mode: "boolean" })
      .default(false)
      .notNull(),
    loginExempt: integer("login_exempt", { mode: "boolean" })
      .default(false)
      .notNull(),
    falseReportCount: integer("false_report_count").default(0).notNull(),
    restrictedUntil: integer("restricted_until", { mode: "timestamp" }),
    otpCode: text("otp_code"),
    otpExpiresAt: integer("otp_expires_at", { mode: "timestamp" }),
    otpAttemptCount: integer("otp_attempt_count").default(0).notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    deletionRequestedAt: integer("deletion_requested_at", {
      mode: "timestamp",
    }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    phoneHashDobHashIdx: uniqueIndex("users_phone_hash_dob_hash_idx").on(
      table.phoneHash,
      table.dobHash,
    ),
    externalIdx: index("users_external_idx").on(
      table.externalSystem,
      table.externalWorkerId,
    ),
    // Prevent duplicate users per external system (e.g. FAS/AceTime)
    // Must clean existing duplicates before pushing this migration
    externalUnique: unique("users_external_unique").on(
      table.externalSystem,
      table.externalWorkerId,
    ),
  }),
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    failCount: integer("fail_count").notNull().default(0),
    userAgent: text("user_agent"),
  },
  (table) => ({
    userIdx: index("push_sub_user_idx").on(table.userId),
    endpointUnique: uniqueIndex("push_sub_endpoint_idx").on(table.endpoint),
  }),
);

export const sites = sqliteTable("sites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").unique().notNull(),
  joinCode: text("join_code").unique().notNull(),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  joinEnabled: integer("join_enabled", { mode: "boolean" })
    .default(true)
    .notNull(),
  requiresApproval: integer("requires_approval", { mode: "boolean" })
    .default(false)
    .notNull(),
  leaderboardEnabled: integer("leaderboard_enabled", { mode: "boolean" })
    .default(true)
    .notNull(),
  autoNominationTopN: integer("auto_nomination_top_n").default(5).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  closedAt: integer("closed_at", { mode: "timestamp" }),
});

export const siteMemberships = sqliteTable(
  "site_memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    role: text("role", { enum: membershipRoleEnum })
      .default("WORKER")
      .notNull(),
    status: text("status", { enum: membershipStatusEnum })
      .default("PENDING")
      .notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    leftAt: integer("left_at", { mode: "timestamp" }),
    leftReason: text("left_reason"),
  },
  (table) => ({
    userSiteUnique: unique().on(table.userId, table.siteId),
    siteStatusIdx: index("site_memberships_site_status_idx").on(
      table.siteId,
      table.status,
    ),
    userIdx: index("site_memberships_user_idx").on(table.userId),
    roleIdx: index("site_memberships_role_idx").on(table.role),
  }),
);

// ============================================================================
// IDENTITY RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(siteMemberships),
  posts: many(posts),
  reviews: many(reviews),
  pointsGiven: many(pointsLedger, { relationName: "pointsAdmin" }),
  pointsReceived: many(pointsLedger, { relationName: "pointsUser" }),
  auditLogs: many(auditLogs),
  announcements: many(announcements),
  actions: many(actions),
  attendances: many(attendance),
  votesGiven: many(votes, { relationName: "voteVoter" }),
  votesReceived: many(votes, { relationName: "voteCandidate" }),
  votesCandidacy: many(voteCandidates),
  approvalsGiven: many(manualApprovals, { relationName: "approvalAdmin" }),
  approvalsReceived: many(manualApprovals, { relationName: "approvalUser" }),
  disputesFiled: many(disputes, { relationName: "disputeUser" }),
  disputesResolved: many(disputes, { relationName: "disputeResolver" }),
  quizAttempts: many(quizAttempts),
  statutoryTrainings: many(statutoryTrainings, {
    relationName: "trainingUser",
  }),
  statutoryTrainingsCreated: many(statutoryTrainings, {
    relationName: "trainingCreator",
  }),
  tbmRecordsLed: many(tbmRecords),
  tbmAttendances: many(tbmAttendees),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  memberships: many(siteMemberships),
  posts: many(posts),
  pointsLedger: many(pointsLedger),
  announcements: many(announcements),
  attendances: many(attendance),
  accessPolicy: one(accessPolicies),
  manualApprovals: many(manualApprovals),
  votes: many(votes),
  disputes: many(disputes),
  voteCandidates: many(voteCandidates),
  educationContents: many(educationContents),
  quizzes: many(quizzes),
  quizAttempts: many(quizAttempts),
  statutoryTrainings: many(statutoryTrainings),
  tbmRecords: many(tbmRecords),
}));

export const siteMembershipsRelations = relations(
  siteMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [siteMemberships.userId],
      references: [users.id],
    }),
    site: one(sites, {
      fields: [siteMemberships.siteId],
      references: [sites.id],
    }),
  }),
);
