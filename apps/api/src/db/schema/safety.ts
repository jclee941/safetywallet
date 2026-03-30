import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import {
  categoryEnum,
  hazardSubcategoryEnum,
  riskLevelEnum,
  visibilityEnum,
  reviewStatusEnum,
  actionStatusEnum,
  reviewActionEnum,
} from "./enums";
import { users, sites } from "./identity";
import { actions } from "./safety-actions";

// ============================================================================
// SAFETY TABLES
// ============================================================================

export const posts = sqliteTable(
  "posts",
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
    category: text("category", { enum: categoryEnum }).notNull(),
    hazardType: text("hazard_type"),
    hazardSubcategory: text("hazard_subcategory", {
      enum: hazardSubcategoryEnum,
    }),
    riskLevel: text("risk_level", { enum: riskLevelEnum }),
    locationFloor: text("location_floor"),
    locationZone: text("location_zone"),
    locationDetail: text("location_detail"),
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }),
    visibility: text("visibility", { enum: visibilityEnum })
      .default("WORKER_PUBLIC")
      .notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" })
      .default(false)
      .notNull(),
    isPotentialDuplicate: integer("is_potential_duplicate", { mode: "boolean" })
      .default(false)
      .notNull(),
    duplicateOfPostId: text("duplicate_of_post_id").references(
      (): AnySQLiteColumn => posts.id,
      { onDelete: "set null" },
    ),
    reviewStatus: text("review_status", { enum: reviewStatusEnum })
      .default("PENDING")
      .notNull(),
    actionStatus: text("action_status", { enum: actionStatusEnum })
      .default("NONE")
      .notNull(),
    isUrgent: integer("is_urgent", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    aiClassification: text("ai_classification"),
    aiClassifiedAt: text("ai_classified_at"),
    clientMutationId: text("client_mutation_id"),
  },
  (table) => ({
    siteReviewStatusIdx: index("posts_site_review_status_idx").on(
      table.siteId,
      table.reviewStatus,
    ),
    siteCreatedAtIdx: index("posts_site_created_at_idx").on(
      table.siteId,
      table.createdAt,
    ),
    userCreatedAtIdx: index("posts_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    duplicateOfPostIdIdx: index("posts_duplicate_of_post_id_idx").on(
      table.duplicateOfPostId,
    ),
    clientMutationIdIdx: uniqueIndex("posts_client_mutation_id_idx").on(
      table.clientMutationId,
    ),
  }),
);

export const postImages = sqliteTable(
  "post_images",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    mediaType: text("media_type").notNull().default("image"),
    thumbnailUrl: text("thumbnail_url"),
    imageHash: text("image_hash"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    postIdIdx: index("post_images_post_id_idx").on(table.postId),
    imageHashIdx: index("post_images_hash_idx").on(table.imageHash),
  }),
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    adminId: text("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action", { enum: reviewActionEnum }).notNull(),
    comment: text("comment"),
    reasonCode: text("reason_code"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    postCreatedAtIdx: index("reviews_post_created_at_idx").on(
      table.postId,
      table.createdAt,
    ),
  }),
);

export const pointsLedger = sqliteTable(
  "points_ledger",
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
    postId: text("post_id").references(() => posts.id, {
      onDelete: "set null",
    }),
    refLedgerId: text("ref_ledger_id").references(
      (): AnySQLiteColumn => pointsLedger.id,
      { onDelete: "set null" },
    ),
    amount: integer("amount").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    adminId: text("admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    settleMonth: text("settle_month").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    userSiteMonthIdx: index("points_ledger_user_site_month_idx").on(
      table.userId,
      table.siteId,
      table.settleMonth,
    ),
    siteMonthIdx: index("points_ledger_site_month_idx").on(
      table.siteId,
      table.settleMonth,
    ),
    refLedgerIdIdx: index("points_ledger_ref_ledger_id_idx").on(
      table.refLedgerId,
    ),
  }),
);

// ============================================================================
// SAFETY RELATIONS
// ============================================================================

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  site: one(sites, { fields: [posts.siteId], references: [sites.id] }),
  images: many(postImages),
  reviews: many(reviews),
  pointsLedger: many(pointsLedger),
  actions: many(actions),
}));

export const postImagesRelations = relations(postImages, ({ one }) => ({
  post: one(posts, { fields: [postImages.postId], references: [posts.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  post: one(posts, { fields: [reviews.postId], references: [posts.id] }),
  admin: one(users, { fields: [reviews.adminId], references: [users.id] }),
}));

export const pointsLedgerRelations = relations(
  pointsLedger,
  ({ one, many }) => ({
    user: one(users, {
      fields: [pointsLedger.userId],
      references: [users.id],
      relationName: "pointsUser",
    }),
    site: one(sites, { fields: [pointsLedger.siteId], references: [sites.id] }),
    post: one(posts, { fields: [pointsLedger.postId], references: [posts.id] }),
    admin: one(users, {
      fields: [pointsLedger.adminId],
      references: [users.id],
      relationName: "pointsAdmin",
    }),
    refLedger: one(pointsLedger, {
      fields: [pointsLedger.refLedgerId],
      references: [pointsLedger.id],
      relationName: "pointsAdjustment",
    }),
    adjustments: many(pointsLedger, { relationName: "pointsAdjustment" }),
  }),
);
