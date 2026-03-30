import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { educationContentTypeEnum, quizStatusEnum } from "./enums";
import { users, sites } from "./identity";

// ============================================================================
// EDUCATION TABLES
// ============================================================================

export const educationContents = sqliteTable(
  "education_contents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    contentType: text("content_type", {
      enum: educationContentTypeEnum,
    }).notNull(),
    contentUrl: text("content_url"),
    thumbnailUrl: text("thumbnail_url"),
    durationMinutes: integer("duration_minutes"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    externalSource: text("external_source").notNull().default("LOCAL"),
    externalId: text("external_id"),
    sourceUrl: text("source_url"),
    viewCount: integer("view_count").notNull().default(0),
    aiAnalysis: text("ai_analysis"),
    aiAnalyzedAt: text("ai_analyzed_at"),
  },
  (table) => ({
    siteIdx: index("education_contents_site_idx").on(table.siteId),
    siteActiveIdx: index("education_contents_site_active_idx").on(
      table.siteId,
      table.isActive,
    ),
  }),
);

export const quizzes = sqliteTable(
  "quizzes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    contentId: text("content_id").references(() => educationContents.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: quizStatusEnum }).default("DRAFT").notNull(),
    pointsReward: integer("points_reward").default(0).notNull(),
    passingScore: integer("passing_score").default(70).notNull(),
    timeLimitMinutes: integer("time_limit_minutes"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("quizzes_site_idx").on(table.siteId),
    siteStatusIdx: index("quizzes_site_status_idx").on(
      table.siteId,
      table.status,
    ),
    contentIdx: index("quizzes_content_idx").on(table.contentId),
  }),
);

export const quizQuestions = sqliteTable(
  "quiz_questions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: text("options", { mode: "json" }).notNull().$type<string[]>(),
    correctAnswer: integer("correct_answer").notNull(),
    explanation: text("explanation"),
    orderIndex: integer("order_index").default(0).notNull(),
    questionType: text("question_type").notNull().default("SINGLE_CHOICE"),
    correctAnswerText: text("correct_answer_text"),
    imageUrl: text("image_url"),
  },
  (table) => ({
    quizIdx: index("quiz_questions_quiz_idx").on(table.quizId),
    quizOrderIdx: index("quiz_questions_quiz_order_idx").on(
      table.quizId,
      table.orderIndex,
    ),
  }),
);

export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    answers: text("answers", { mode: "json" }).$type<
      (number | number[] | string)[]
    >(),
    score: integer("score").default(0).notNull(),
    passed: integer("passed", { mode: "boolean" }).default(false).notNull(),
    pointsAwarded: integer("points_awarded").default(0).notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => ({
    quizUserIdx: index("quiz_attempts_quiz_user_idx").on(
      table.quizId,
      table.userId,
    ),
    siteIdx: index("quiz_attempts_site_idx").on(table.siteId),
    userIdx: index("quiz_attempts_user_idx").on(table.userId),
  }),
);

export const educationCompletions = sqliteTable(
  "education_completions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contentId: text("content_id")
      .notNull()
      .references(() => educationContents.id, { onDelete: "cascade" }),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signatureData: text("signature_data"),
    signedAt: integer("signed_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    contentUserUnique: unique().on(table.contentId, table.userId),
    siteIdx: index("education_completions_site_idx").on(table.siteId),
    contentIdx: index("education_completions_content_idx").on(table.contentId),
  }),
);

// ============================================================================
// EDUCATION RELATIONS
// ============================================================================

export const educationContentsRelations = relations(
  educationContents,
  ({ one, many }) => ({
    site: one(sites, {
      fields: [educationContents.siteId],
      references: [sites.id],
    }),
    createdBy: one(users, {
      fields: [educationContents.createdById],
      references: [users.id],
    }),
    quizzes: many(quizzes),
    completions: many(educationCompletions),
  }),
);

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  site: one(sites, { fields: [quizzes.siteId], references: [sites.id] }),
  content: one(educationContents, {
    fields: [quizzes.contentId],
    references: [educationContents.id],
  }),
  createdBy: one(users, {
    fields: [quizzes.createdById],
    references: [users.id],
  }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  site: one(sites, {
    fields: [quizAttempts.siteId],
    references: [sites.id],
  }),
}));

export const educationCompletionsRelations = relations(
  educationCompletions,
  ({ one }) => ({
    content: one(educationContents, {
      fields: [educationCompletions.contentId],
      references: [educationContents.id],
    }),
    user: one(users, {
      fields: [educationCompletions.userId],
      references: [users.id],
    }),
    site: one(sites, {
      fields: [educationCompletions.siteId],
      references: [sites.id],
    }),
  }),
);
