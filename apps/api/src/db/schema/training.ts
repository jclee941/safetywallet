import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  statutoryTrainingTypeEnum,
  trainingCompletionStatusEnum,
  tbmTopicCategoryEnum,
} from "./enums";
import { users, sites } from "./identity";

// ============================================================================
// TRAINING TABLES
// ============================================================================

export const statutoryTrainings = sqliteTable(
  "statutory_trainings",
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
    trainingType: text("training_type", {
      enum: statutoryTrainingTypeEnum,
    }).notNull(),
    trainingName: text("training_name").notNull(),
    trainingDate: integer("training_date").notNull(), // epoch seconds (intentional — date-only field)
    expirationDate: integer("expiration_date"), // epoch seconds (intentional — date-only field)
    provider: text("provider"),
    certificateUrl: text("certificate_url"),
    hoursCompleted: integer("hours_completed").default(0).notNull(),
    status: text("status", { enum: trainingCompletionStatusEnum })
      .default("SCHEDULED")
      .notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteUserIdx: index("statutory_trainings_site_user_idx").on(
      table.siteId,
      table.userId,
    ),
    siteTypeIdx: index("statutory_trainings_site_type_idx").on(
      table.siteId,
      table.trainingType,
    ),
    userIdx: index("statutory_trainings_user_idx").on(table.userId),
    statusIdx: index("statutory_trainings_status_idx").on(table.status),
    expirationIdx: index("statutory_trainings_expiration_idx").on(
      table.expirationDate,
    ),
  }),
);

export const tbmRecords = sqliteTable(
  "tbm_records",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    date: integer("date").notNull(), // epoch seconds (intentional — date-only field)
    topic: text("topic").notNull(),
    topicCategory: text("topic_category", { enum: tbmTopicCategoryEnum }),
    content: text("content"),
    leaderId: text("leader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weatherCondition: text("weather_condition"),
    specialNotes: text("special_notes"),
    aiAnalysis: text("ai_analysis"),
    aiAnalyzedAt: text("ai_analyzed_at"),
    aiMeetingMinutes: text("ai_meeting_minutes"),
    aiMinutesGeneratedAt: text("ai_minutes_generated_at"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteDateIdx: index("tbm_records_site_date_idx").on(
      table.siteId,
      table.date,
    ),
    siteIdx: index("tbm_records_site_idx").on(table.siteId),
    leaderIdx: index("tbm_records_leader_idx").on(table.leaderId),
  }),
);

export const tbmAttendees = sqliteTable(
  "tbm_attendees",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tbmRecordId: text("tbm_record_id")
      .notNull()
      .references(() => tbmRecords.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attendedAt: integer("attended_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    tbmUserUnique: unique().on(table.tbmRecordId, table.userId),
    tbmRecordIdx: index("tbm_attendees_tbm_record_idx").on(table.tbmRecordId),
    userIdx: index("tbm_attendees_user_idx").on(table.userId),
  }),
);

// ============================================================================
// TRAINING RELATIONS
// ============================================================================

export const statutoryTrainingsRelations = relations(
  statutoryTrainings,
  ({ one }) => ({
    site: one(sites, {
      fields: [statutoryTrainings.siteId],
      references: [sites.id],
    }),
    user: one(users, {
      fields: [statutoryTrainings.userId],
      references: [users.id],
      relationName: "trainingUser",
    }),
    createdBy: one(users, {
      fields: [statutoryTrainings.createdById],
      references: [users.id],
      relationName: "trainingCreator",
    }),
  }),
);

export const tbmRecordsRelations = relations(tbmRecords, ({ one, many }) => ({
  site: one(sites, {
    fields: [tbmRecords.siteId],
    references: [sites.id],
  }),
  leader: one(users, {
    fields: [tbmRecords.leaderId],
    references: [users.id],
  }),
  attendees: many(tbmAttendees),
}));

export const tbmAttendeesRelations = relations(tbmAttendees, ({ one }) => ({
  tbmRecord: one(tbmRecords, {
    fields: [tbmAttendees.tbmRecordId],
    references: [tbmRecords.id],
  }),
  user: one(users, {
    fields: [tbmAttendees.userId],
    references: [users.id],
  }),
}));
