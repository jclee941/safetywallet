import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { syncTypeEnum, syncErrorStatusEnum } from "./enums";
import { users, sites } from "./identity";

// ============================================================================
// SYSTEM TABLES
// ============================================================================

export const joinCodeHistory = sqliteTable(
  "join_code_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    joinCode: text("join_code").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invalidatedAt: integer("invalidated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteIdx: index("join_code_history_site_idx").on(table.siteId),
    codeIdx: index("join_code_history_code_idx").on(table.joinCode),
  }),
);

export const deviceRegistrations = sqliteTable(
  "device_registrations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceInfo: text("device_info"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    isTrusted: integer("is_trusted", { mode: "boolean" })
      .default(true)
      .notNull(),
    isBanned: integer("is_banned", { mode: "boolean" })
      .default(false)
      .notNull(),
  },
  (table) => ({
    userDeviceUnique: unique().on(table.userId, table.deviceId),
    deviceIdx: index("device_registrations_device_idx").on(table.deviceId),
    userIdx: index("device_registrations_user_idx").on(table.userId),
  }),
);

export const pointPolicies = sqliteTable(
  "point_policies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    reasonCode: text("reason_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    defaultAmount: integer("default_amount").notNull(),
    minAmount: integer("min_amount"),
    maxAmount: integer("max_amount"),
    dailyLimit: integer("daily_limit"),
    monthlyLimit: integer("monthly_limit"),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    siteReasonUnique: unique().on(table.siteId, table.reasonCode),
    siteNameUnique: unique().on(table.siteId, table.name),
    siteIdx: index("point_policies_site_idx").on(table.siteId),
  }),
);

export const syncErrors = sqliteTable(
  "sync_errors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id").references(() => sites.id, { onDelete: "cascade" }),
    syncType: text("sync_type", { enum: syncTypeEnum }).notNull(),
    status: text("status", { enum: syncErrorStatusEnum })
      .notNull()
      .default("OPEN"),
    errorCode: text("error_code"),
    errorMessage: text("error_message").notNull(),
    payload: text("payload"), // JSON string of failed data
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: integer("last_retry_at", { mode: "timestamp" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    siteTypeIdx: index("sync_errors_site_type_idx").on(
      table.siteId,
      table.syncType,
    ),
    statusIdx: index("sync_errors_status_idx").on(table.status),
    createdAtIdx: index("sync_errors_created_at_idx").on(table.createdAt),
  }),
);

// ============================================================================
// SYSTEM RELATIONS
// ============================================================================

export const joinCodeHistoryRelations = relations(
  joinCodeHistory,
  ({ one }) => ({
    site: one(sites, {
      fields: [joinCodeHistory.siteId],
      references: [sites.id],
    }),
    createdBy: one(users, {
      fields: [joinCodeHistory.createdById],
      references: [users.id],
    }),
  }),
);

export const deviceRegistrationsRelations = relations(
  deviceRegistrations,
  ({ one }) => ({
    user: one(users, {
      fields: [deviceRegistrations.userId],
      references: [users.id],
    }),
  }),
);

export const pointPoliciesRelations = relations(pointPolicies, ({ one }) => ({
  site: one(sites, { fields: [pointPolicies.siteId], references: [sites.id] }),
}));

export const syncErrorsRelations = relations(syncErrors, ({ one }) => ({
  site: one(sites, {
    fields: [syncErrors.siteId],
    references: [sites.id],
  }),
}));
