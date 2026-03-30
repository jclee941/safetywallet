import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { pushSubscriptions } from "../../db/schema";
import { success, error } from "../../lib/response";
import {
  sendPushBulk,
  shouldRemoveSubscription,
  type VapidKeys,
} from "../../lib/web-push";
import { createLogger } from "../../lib/logger";
import {
  enqueueNotification,
  type NotificationQueueMessage,
} from "../../lib/notification-queue";
import { chunkArray, sendSmsFallback, IN_QUERY_CHUNK_SIZE } from "./helpers";

const log = createLogger("notifications");

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const SendPushSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  message: z.object({
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(500),
    icon: z.string().optional(),
    badge: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    actions: z
      .array(z.object({ action: z.string(), title: z.string() }))
      .optional(),
  }),
});

app.post("/send", zValidator("json", SendPushSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  if (user.role !== "SITE_ADMIN" && user.role !== "SUPER_ADMIN") {
    return error(c, "FORBIDDEN", "관리자만 푸시 알림을 보낼 수 있습니다.", 403);
  }

  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "VAPID 키가 설정되지 않았습니다.",
      503,
    );
  }

  const body = c.req.valid("json");
  const userIds = [...new Set(body.userIds)];
  const vapidKeys: VapidKeys = {
    publicKey: c.env.VAPID_PUBLIC_KEY,
    privateKey: c.env.VAPID_PRIVATE_KEY,
  };

  const allSubs = [];
  for (const userIdChunk of chunkArray(userIds, IN_QUERY_CHUNK_SIZE)) {
    const chunkSubs = await db
      .select({
        id: pushSubscriptions.id,
        userId: pushSubscriptions.userId,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failCount: pushSubscriptions.failCount,
      })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIdChunk))
      .all();

    allSubs.push(...chunkSubs);
  }

  const usersWithSubs = new Set(allSubs.map((s) => s.userId));
  const usersWithNoSubs = new Set<string>();
  for (const userId of userIds) {
    if (!usersWithSubs.has(userId)) {
      usersWithNoSubs.add(userId);
    }
  }

  if (allSubs.length === 0) {
    const smsFallbackCount = await sendSmsFallback(
      c.env,
      db,
      userIds,
      body.message,
    );

    return success(c, {
      sent: 0,
      failed: 0,
      removed: 0,
      smsFallback: smsFallbackCount,
      noSubscriptions: true,
    });
  }

  if (c.env.NOTIFICATION_QUEUE) {
    const queueMsg: NotificationQueueMessage = {
      type: "push_bulk",
      subscriptions: allSubs.map((s) => ({
        id: s.id,
        userId: s.userId,
        endpoint: s.endpoint,
        p256dh: s.p256dh,
        auth: s.auth,
        failCount: s.failCount,
      })),
      message: body.message,
      enqueuedAt: new Date().toISOString(),
    };

    await enqueueNotification(c.env.NOTIFICATION_QUEUE, queueMsg);

    let smsFallbackCount = 0;
    if (usersWithNoSubs.size > 0) {
      smsFallbackCount = await sendSmsFallback(
        c.env,
        db,
        [...usersWithNoSubs],
        body.message,
      );
    }

    log.info("Push notifications enqueued", {
      metadata: {
        queued: allSubs.length,
        smsFallback: smsFallbackCount,
      },
    });

    return success(c, {
      queued: allSubs.length,
      smsFallback: smsFallbackCount,
      async: true,
    });
  }

  const pushSubs = allSubs.map((s) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  const results = await sendPushBulk(
    pushSubs,
    body.message,
    vapidKeys,
    c.env.VAPID_SUBJECT,
  );

  let sent = 0;
  let failed = 0;
  let removed = 0;

  const userPushSuccess = new Map<string, boolean>();

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sub = allSubs[i];

    if (result.success) {
      sent++;
      userPushSuccess.set(sub.userId, true);
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date(), failCount: 0 })
        .where(eq(pushSubscriptions.id, sub.id));
    } else if (shouldRemoveSubscription(result)) {
      removed++;
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id));
    } else {
      failed++;
      await db
        .update(pushSubscriptions)
        .set({ failCount: sub.failCount + 1 })
        .where(eq(pushSubscriptions.id, sub.id));
    }
  }

  const smsFallbackUserIds: string[] = [...usersWithNoSubs];
  for (const userId of userIds) {
    if (!usersWithNoSubs.has(userId) && !userPushSuccess.get(userId)) {
      smsFallbackUserIds.push(userId);
    }
  }

  let smsFallbackCount = 0;
  if (smsFallbackUserIds.length > 0) {
    smsFallbackCount = await sendSmsFallback(
      c.env,
      db,
      smsFallbackUserIds,
      body.message,
    );
  }

  log.info("Push bulk send completed", {
    metadata: {
      sent,
      failed,
      removed,
      smsFallback: smsFallbackCount,
      total: allSubs.length,
    },
  });

  return success(c, { sent, failed, removed, smsFallback: smsFallbackCount });
});

export default app;
