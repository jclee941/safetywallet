import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { users, auditLogs, deviceRegistrations } from "../../db/schema";
import { hmac, encrypt } from "../../lib/crypto";
import { success, error } from "../../lib/response";
import {
  checkDeviceRegistrationLimit,
  normalizeDeviceId,
  recordDeviceRegistration,
} from "../../lib/device-registrations";
import { authRateLimitMiddleware } from "../../middleware/rate-limit";
import { turnstileMiddleware } from "../../middleware/turnstile";
import { maskName } from "../../utils/common";
import { RegisterSchema } from "../../validators/schemas";
import type { Env, AuthContext } from "../../types";

function resolveDeviceId(c: Context, bodyDeviceId?: string): string | null {
  const headerDeviceId =
    c.req.header("device-id") ||
    c.req.header("x-device-id") ||
    c.req.header("deviceid") ||
    c.req.header("deviceId");
  return normalizeDeviceId(bodyDeviceId ?? headerDeviceId);
}

const registerRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

registerRoute.post(
  "/register",
  authRateLimitMiddleware(),
  turnstileMiddleware(),
  zValidator("json", RegisterSchema),
  async (c) => {
    const body = (() => {
      try {
        return c.req.valid("json");
      } catch {
        return null;
      }
    })();
    if (!body) {
      return error(c, "INVALID_JSON", "Invalid JSON", 400);
    }

    if (!body.name || !body.phone || !body.dob) {
      return error(
        c,
        "MISSING_FIELDS",
        "name, phone, and dob are required",
        400,
      );
    }

    const deviceId = resolveDeviceId(c, body.deviceId);
    const deviceCheck = deviceId
      ? await checkDeviceRegistrationLimit(c.env.KV, deviceId, Date.now())
      : null;
    if (deviceCheck && !deviceCheck.allowed) {
      return error(
        c,
        "DEVICE_LIMIT",
        "Too many accounts from this device",
        429,
      );
    }

    const db = drizzle(c.env.DB);
    const normalizedPhone = body.phone.replace(/[^0-9]/g, "");
    const normalizedDob = body.dob.replace(/[^0-9]/g, "");
    const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);
    const dobHash = await hmac(c.env.HMAC_SECRET, normalizedDob);

    const phoneEncrypted = await encrypt(c.env.ENCRYPTION_KEY, normalizedPhone);
    const dobEncrypted = await encrypt(c.env.ENCRYPTION_KEY, normalizedDob);
    const nameMasked = maskName(body.name);

    const existingUser = await db
      .select({
        id: users.id,
        phoneEncrypted: users.phoneEncrypted,
        dobEncrypted: users.dobEncrypted,
      })
      .from(users)
      .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
      .get();

    if (existingUser) {
      try {
        if (!existingUser.phoneEncrypted || !existingUser.dobEncrypted) {
          const encUpdates: Record<string, unknown> = {};
          if (!existingUser.phoneEncrypted) {
            encUpdates.phoneEncrypted = phoneEncrypted;
          }
          if (!existingUser.dobEncrypted) {
            encUpdates.dobEncrypted = dobEncrypted;
          }
          if (Object.keys(encUpdates).length > 0) {
            encUpdates.updatedAt = new Date();
            await db
              .update(users)
              .set(encUpdates)
              .where(eq(users.id, existingUser.id));
          }
        }
      } catch {
        // Non-blocking: migration failure must not prevent response
      }
      return error(c, "USER_EXISTS", "User already registered", 409);
    }

    const newUser = await db
      .insert(users)
      .values({
        name: body.name,
        nameMasked,
        phoneHash,
        phoneEncrypted,
        dobHash,
        dobEncrypted,
        role: "WORKER",
      })
      .returning()
      .get();

    if (deviceId) {
      await recordDeviceRegistration(
        c.env.KV,
        deviceId,
        newUser.id,
        Date.now(),
        deviceCheck?.recent,
      );

      const existingDevice = await db
        .select()
        .from(deviceRegistrations)
        .where(
          and(
            eq(deviceRegistrations.userId, newUser.id),
            eq(deviceRegistrations.deviceId, deviceId),
          ),
        )
        .get();

      if (!existingDevice) {
        await db.insert(deviceRegistrations).values({
          userId: newUser.id,
          deviceId,
          deviceInfo: c.req.header("User-Agent") || null,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          isTrusted: true,
          isBanned: false,
        });
      }

      await db.insert(auditLogs).values({
        action: "DEVICE_REGISTRATION",
        actorId: newUser.id,
        targetType: "DEVICE",
        targetId: deviceId,
        reason: "User registration",
        ip: c.req.header("CF-Connecting-IP") || undefined,
        userAgent: c.req.header("User-Agent") || undefined,
      });
    }

    return success(c, { userId: newUser.id }, 201);
  },
);

export default registerRoute;
