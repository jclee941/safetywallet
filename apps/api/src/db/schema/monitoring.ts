import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { posts, postImages } from "./safety";

// ============================================================================
// MONITORING TABLES
// ============================================================================

export const apiMetrics = sqliteTable(
  "api_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bucket: text("bucket").notNull(), // "2025-02-12T14:05" (5-min truncated ISO)
    endpoint: text("endpoint").notNull(), // "/api/posts/:id"
    method: text("method").notNull(), // "GET", "POST", etc.
    requestCount: integer("request_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0), // status >= 400
    totalDurationMs: integer("total_duration_ms").notNull().default(0),
    maxDurationMs: integer("max_duration_ms").notNull().default(0),
    status2xx: integer("status_2xx").notNull().default(0),
    status4xx: integer("status_4xx").notNull().default(0),
    status5xx: integer("status_5xx").notNull().default(0),
  },
  (table) => ({
    bucketEndpointMethodIdx: uniqueIndex(
      "api_metrics_bucket_endpoint_method_idx",
    ).on(table.bucket, table.endpoint, table.method),
    bucketIdx: index("api_metrics_bucket_idx").on(table.bucket),
  }),
);

export const imageAiAnalysis = sqliteTable(
  "image_ai_analysis",
  {
    id: text("id").primaryKey(),
    postImageId: text("post_image_id")
      .notNull()
      .references(() => postImages.id),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    hazardType: text("hazard_type").notNull(),
    severity: text("severity").notNull(),
    description: text("description").notNull(),
    recommendations: text("recommendations", { mode: "json" }).$type<
      string[]
    >(),
    detectedObjects: text("detected_objects", { mode: "json" }).$type<
      string[]
    >(),
    confidence: integer("confidence"), // stored as 0-100 integer
    relatedRegulations: text("related_regulations", { mode: "json" }).$type<
      string[]
    >(),
    rawResponse: text("raw_response", { mode: "json" }),
    modelVersion: text("model_version").notNull().default("gemini-2.0-flash"),
    analyzedAt: text("analyzed_at").notNull(),
  },
  (table) => ({
    postImageIdIdx: uniqueIndex("image_ai_analysis_post_image_id_idx").on(
      table.postImageId,
    ),
    postIdIdx: index("image_ai_analysis_post_id_idx").on(table.postId),
  }),
);
