import { eq, and, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { PointCalculationInput } from "./calculator";

const DUPLICATE_WINDOW_HOURS = 24;

export async function checkDuplicate(
  db: ReturnType<typeof drizzle>,
  input: PointCalculationInput,
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const duplicates = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.userId, input.userId),
        eq(schema.posts.siteId, input.siteId),
        eq(schema.posts.category, input.category),
        eq(schema.posts.locationFloor, input.locationFloor ?? ""),
        eq(schema.posts.locationZone, input.locationZone ?? ""),
        gte(schema.posts.createdAt, windowStart),
        sql`${schema.posts.id} != ${input.postId}`,
      ),
    )
    .limit(1);

  return duplicates.length > 0;
}
