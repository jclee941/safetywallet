import { inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { pushSubscriptions } from "../../db/schema";
import {
  enqueueNotification,
  type NotificationQueueMessage,
} from "../../lib/notification-queue";
import type { Env } from "../../types";
import { log } from "../helpers";

type DbClient = DrizzleD1Database<Record<string, never>>;

export async function enqueueVoteRewardNotifications(params: {
  db: DbClient;
  notificationQueue: Env["NOTIFICATION_QUEUE"];
  rewardedUserIds: string[];
}): Promise<void> {
  const { db, notificationQueue, rewardedUserIds } = params;
  if (!notificationQueue || rewardedUserIds.length === 0) return;

  try {
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        userId: pushSubscriptions.userId,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failCount: pushSubscriptions.failCount,
      })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, rewardedUserIds))
      .all();

    if (subs.length === 0) return;

    const queueMsg: NotificationQueueMessage = {
      type: "push_bulk",
      subscriptions: subs.map((s) => ({
        id: s.id,
        userId: s.userId,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
        failCount: s.failCount,
      })),
      message: {
        title: "투표 보상 지급",
        body: "월간 안전스타 투표 보상 포인트가 지급되었습니다.",
        data: { type: "VOTE_REWARD", url: "/points" },
      },
      enqueuedAt: new Date().toISOString(),
    };

    await enqueueNotification(notificationQueue, queueMsg);
  } catch (notifErr) {
    const errObj =
      notifErr instanceof Error
        ? {
            name: notifErr.name,
            message: notifErr.message,
            stack: notifErr.stack,
          }
        : { name: "UnknownError", message: String(notifErr) };

    log.warn("Failed to send reward notifications", { error: errObj });
  }
}
