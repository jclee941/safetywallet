import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { pushSubscriptions } from "../../db/schema";
import { success, error } from "../../lib/response";
import { createLogger } from "../../lib/logger";

const log = createLogger("notifications");

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

app.post("/subscribe", zValidator("json", SubscribeSchema), async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const body = c.req.valid("json");

  if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "푸시 알림이 설정되지 않았습니다.",
      503,
    );
  }

  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, body.endpoint))
    .get();

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId: user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        lastUsedAt: new Date(),
        failCount: 0,
        userAgent: body.userAgent ?? null,
      })
      .where(eq(pushSubscriptions.id, existing.id));

    return success(c, { id: existing.id, updated: true });
  }

  const id = crypto.randomUUID();
  await db.insert(pushSubscriptions).values({
    id,
    userId: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    createdAt: new Date(),
    failCount: 0,
    userAgent: body.userAgent ?? null,
  });

  log.info("Push subscription created", { userId: user.id });
  return success(c, { id, updated: false }, 201);
});

app.delete("/unsubscribe", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const endpoint = c.req.query("endpoint");

  if (!endpoint) {
    return error(c, "MISSING_ENDPOINT", "endpoint 파라미터가 필요합니다.");
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return success(c, { deleted: true });
});

app.get("/subscriptions", async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
      userAgent: pushSubscriptions.userAgent,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id))
    .all();

  return success(c, subs);
});

app.get("/vapid-key", async (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) {
    return error(
      c,
      "PUSH_NOT_CONFIGURED",
      "푸시 알림이 설정되지 않았습니다.",
      503,
    );
  }
  return success(c, { publicKey: c.env.VAPID_PUBLIC_KEY });
});

export default app;
