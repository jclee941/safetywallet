import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  voteCandidateSourceEnum,
  disputeStatusEnum,
  disputeTypeEnum,
} from "./enums";
import { users, sites } from "./identity";
import { posts, reviews, pointsLedger } from "./safety";
import { attendance } from "./safety-actions";

// ============================================================================
// SAFETY-VOTES TABLES
// ============================================================================

export const votes = sqliteTable(
  "votes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    votedAt: integer("voted_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthVoterUnique: unique().on(table.siteId, table.month, table.voterId),
    siteMonthIdx: index("votes_site_month_idx").on(table.siteId, table.month),
  }),
);

export const voteCandidates = sqliteTable(
  "vote_candidates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source", { enum: voteCandidateSourceEnum }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthUserUnique: unique().on(table.siteId, table.month, table.userId),
    siteMonthIdx: index("vote_candidates_site_month_idx").on(
      table.siteId,
      table.month,
    ),
  }),
);

export const votePeriods = sqliteTable(
  "vote_periods",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    startDate: integer("start_date").notNull(), // epoch seconds (intentional — date-only field)
    endDate: integer("end_date").notNull(), // epoch seconds (intentional — date-only field)
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteMonthUnique: unique().on(table.siteId, table.month),
  }),
);

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    recommenderId: text("recommender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recommendedName: text("recommended_name").notNull(),
    tradeType: text("trade_type").notNull(),
    reason: text("reason").notNull(),
    recommendationDate: text("recommendation_date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteRecommenderDateUnique: unique().on(
      table.siteId,
      table.recommenderId,
      table.recommendationDate,
    ),
    siteIdx: index("recommendations_site_idx").on(table.siteId),
    recommenderIdx: index("recommendations_recommender_idx").on(
      table.recommenderId,
    ),
  }),
);

export const disputes = sqliteTable(
  "disputes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: disputeTypeEnum }).notNull(),
    status: text("status", { enum: disputeStatusEnum })
      .default("OPEN")
      .notNull(),
    refReviewId: text("ref_review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    refPointsLedgerId: text("ref_points_ledger_id").references(
      () => pointsLedger.id,
      { onDelete: "set null" },
    ),
    refAttendanceId: text("ref_attendance_id").references(() => attendance.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    resolvedById: text("resolved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolutionNote: text("resolution_note"),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("disputes_site_idx").on(table.siteId),
    userIdx: index("disputes_user_idx").on(table.userId),
    statusIdx: index("disputes_status_idx").on(table.status),
  }),
);

// ============================================================================
// SAFETY-VOTES RELATIONS
// ============================================================================

export const votesRelations = relations(votes, ({ one }) => ({
  site: one(sites, { fields: [votes.siteId], references: [sites.id] }),
  voter: one(users, {
    fields: [votes.voterId],
    references: [users.id],
    relationName: "voteVoter",
  }),
  candidate: one(users, {
    fields: [votes.candidateId],
    references: [users.id],
    relationName: "voteCandidate",
  }),
}));

export const voteCandidatesRelations = relations(voteCandidates, ({ one }) => ({
  site: one(sites, { fields: [voteCandidates.siteId], references: [sites.id] }),
  user: one(users, { fields: [voteCandidates.userId], references: [users.id] }),
}));

export const votePeriodsRelations = relations(votePeriods, ({ one }) => ({
  site: one(sites, { fields: [votePeriods.siteId], references: [sites.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  site: one(sites, { fields: [disputes.siteId], references: [sites.id] }),
  user: one(users, {
    fields: [disputes.userId],
    references: [users.id],
    relationName: "disputeUser",
  }),
  resolvedBy: one(users, {
    fields: [disputes.resolvedById],
    references: [users.id],
    relationName: "disputeResolver",
  }),
  refReview: one(reviews, {
    fields: [disputes.refReviewId],
    references: [reviews.id],
  }),
  refPointsLedger: one(pointsLedger, {
    fields: [disputes.refPointsLedgerId],
    references: [pointsLedger.id],
  }),
  refAttendance: one(attendance, {
    fields: [disputes.refAttendanceId],
    references: [attendance.id],
  }),
}));
