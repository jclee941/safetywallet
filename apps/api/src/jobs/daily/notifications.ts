import type { Env } from "../../types";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lt } from "drizzle-orm";
import { announcements } from "../../db/schema";
import { log } from "../helpers";

export async function cleanupOldNotifications(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const now = new Date();

  const result = await db
    .update(announcements)
    .set({ isPublished: true })
    .where(
      and(
        eq(announcements.isPublished, false),
        lt(announcements.scheduledAt, now),
      ),
    );

  const count = result.meta?.changes ?? 0;
  if (count > 0) {
    log.info("Published scheduled announcements", { count });
  }
}

export const publishScheduledAnnouncements = cleanupOldNotifications;
