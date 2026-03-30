import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  actionStatusEnum,
  actionPriorityEnum,
  attendanceResultEnum,
  attendanceSourceEnum,
  approvalStatusEnum,
} from "./enums";
import { users, sites } from "./identity";
import { posts } from "./safety";

// ============================================================================
// SAFETY-ACTIONS TABLES
// ============================================================================

export const actions = sqliteTable(
  "actions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    assigneeType: text("assignee_type").notNull(),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: integer("due_date", { mode: "timestamp" }),
    priority: text("priority", { enum: actionPriorityEnum }),
    description: text("description"),
    actionStatus: text("action_status", { enum: actionStatusEnum })
      .default("NONE")
      .notNull(),
    aiComparison: text("ai_comparison"),
    aiComparedAt: text("ai_compared_at"),
    completionNote: text("completion_note"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    postIdx: index("actions_post_idx").on(table.postId),
    assigneeIdx: index("actions_assignee_idx").on(table.assigneeId),
    statusIdx: index("actions_status_idx").on(table.actionStatus),
  }),
);

export const actionImages = sqliteTable(
  "action_images",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actionId: text("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    imageType: text("image_type", { enum: ["BEFORE", "AFTER"] }),
    aiAnalysis: text("ai_analysis"),
    aiAnalyzedAt: text("ai_analyzed_at"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    actionIdIdx: index("action_images_action_id_idx").on(table.actionId),
  }),
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    actorCreatedAtIdx: index("audit_logs_actor_created_at_idx").on(
      table.actorId,
      table.createdAt,
    ),
    targetIdx: index("audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  }),
);

export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    isPinned: integer("is_pinned", { mode: "boolean" })
      .default(false)
      .notNull(),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    isPublished: integer("is_published", { mode: "boolean" })
      .default(true)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    sitePinnedCreatedAtIdx: index(
      "announcements_site_pinned_created_at_idx",
    ).on(table.siteId, table.isPinned, table.createdAt),
  }),
);

export const attendance = sqliteTable(
  "attendances",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    externalWorkerId: text("external_worker_id"),
    checkinAt: integer("checkin_at", { mode: "timestamp" }).notNull(),
    result: text("result", { enum: attendanceResultEnum }).notNull(),
    deviceId: text("device_id"),
    source: text("source", { enum: attendanceSourceEnum }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteCheckinIdx: index("attendance_site_checkin_idx").on(
      table.siteId,
      table.checkinAt,
    ),
    userCheckinIdx: index("attendance_user_checkin_idx").on(
      table.userId,
      table.checkinAt,
    ),
    externalCheckinIdx: index("attendance_external_checkin_idx").on(
      table.externalWorkerId,
      table.checkinAt,
    ),
    externalSiteCheckinUnique: unique(
      "attendance_external_site_checkin_unique",
    ).on(table.externalWorkerId, table.siteId, table.checkinAt),
  }),
);

export const accessPolicies = sqliteTable("access_policies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  siteId: text("site_id")
    .unique()
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  requireCheckin: integer("require_checkin", { mode: "boolean" })
    .default(true)
    .notNull(),
  dayCutoffHour: integer("day_cutoff_hour").default(5).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

export const manualApprovals = sqliteTable(
  "manual_approvals",
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
    approvedById: text("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    validDate: integer("valid_date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: approvalStatusEnum })
      .default("PENDING")
      .notNull(),
    rejectionReason: text("rejection_reason"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    userValidDateIdx: index("manual_approvals_user_valid_date_idx").on(
      table.userId,
      table.validDate,
    ),
    siteValidDateIdx: index("manual_approvals_site_valid_date_idx").on(
      table.siteId,
      table.validDate,
    ),
  }),
);

// ============================================================================
// SAFETY-ACTIONS RELATIONS
// ============================================================================

export const actionsRelations = relations(actions, ({ one, many }) => ({
  post: one(posts, { fields: [actions.postId], references: [posts.id] }),
  assignee: one(users, {
    fields: [actions.assigneeId],
    references: [users.id],
  }),
  images: many(actionImages),
}));

export const actionImagesRelations = relations(actionImages, ({ one }) => ({
  action: one(actions, {
    fields: [actionImages.actionId],
    references: [actions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  site: one(sites, { fields: [announcements.siteId], references: [sites.id] }),
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  site: one(sites, { fields: [attendance.siteId], references: [sites.id] }),
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
}));

export const accessPoliciesRelations = relations(accessPolicies, ({ one }) => ({
  site: one(sites, { fields: [accessPolicies.siteId], references: [sites.id] }),
}));

export const manualApprovalsRelations = relations(
  manualApprovals,
  ({ one }) => ({
    user: one(users, {
      fields: [manualApprovals.userId],
      references: [users.id],
      relationName: "approvalUser",
    }),
    approvedBy: one(users, {
      fields: [manualApprovals.approvedById],
      references: [users.id],
      relationName: "approvalAdmin",
    }),
    site: one(sites, {
      fields: [manualApprovals.siteId],
      references: [sites.id],
    }),
  }),
);
