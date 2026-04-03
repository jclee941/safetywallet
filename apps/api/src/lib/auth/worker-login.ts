import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { attendance, deviceRegistrations, users } from "../../db/schema";
import { decrypt, encrypt, hmac } from "../crypto";
import { signJwt } from "../jwt";
import { logAuditWithContext } from "../audit";
import { error, success } from "../response";
import { createLogger } from "../logger";
import { fasCheckWorkerAttendance, fasSearchEmployeeByPhone } from "../fas";
import { socialNoToDob, syncSingleFasEmployee } from "../fas-sync";
import { normalizeDeviceId } from "../device-registrations";
import { checkRateLimit } from "../rate-limit";
import { getTodayRange } from "../../utils/common";
import type { AuthContext, Env } from "../../types";
import {
  accountLockedResponse,
  clearLockout,
  getLoginLockoutKey,
  getLockoutStatus,
  logLoginLockoutEvent,
  recordFailedAttempt,
  resolveLockoutActorId,
} from "../../routes/auth/lockout";

const ACCESS_TOKEN_EXPIRY_SECONDS = 86400;
const LOGIN_MIN_RESPONSE_MS = 350;
const logger = createLogger("auth");

type AuthBindings = { Bindings: Env; Variables: { auth: AuthContext } };
export interface WorkerLoginBody {
  name?: string;
  phone?: string;
  dob?: string;
  deviceId?: string;
}

function resolveDeviceId(
  c: Context<AuthBindings>,
  bodyDeviceId?: string,
): string | null {
  const headerDeviceId =
    c.req.header("device-id") ||
    c.req.header("x-device-id") ||
    c.req.header("deviceid") ||
    c.req.header("deviceId");
  return normalizeDeviceId(bodyDeviceId ?? headerDeviceId);
}

async function enforceMinimumResponseTime(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  const remaining = LOGIN_MIN_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

type LoginFailureResult = { response: Response };
type LoginSuccessResult = {
  user: typeof users.$inferSelect;
  attemptKey: string;
};

export async function checkLoginLockout(
  c: Context<AuthBindings>,
  phoneHash: string,
  nowMs: number,
): Promise<
  | {
      attemptKey: string;
      currentAttempt: Awaited<ReturnType<typeof getLockoutStatus>>;
    }
  | LoginFailureResult
> {
  const attemptKey = getLoginLockoutKey(phoneHash);
  const currentAttempt = await getLockoutStatus(c.env.KV, attemptKey, nowMs);
  if (
    typeof currentAttempt?.lockedUntil === "number" &&
    currentAttempt.lockedUntil > nowMs
  ) {
    return {
      response: accountLockedResponse(c, currentAttempt.lockedUntil, nowMs),
    };
  }

  return { attemptKey, currentAttempt };
}

export async function syncWorkerFromFAS(
  c: Context<AuthBindings>,
  db: ReturnType<typeof drizzle>,
  normalizedPhone: string,
  normalizedDob: string,
): Promise<typeof users.$inferSelect | null> {
  if (!c.env.FAS_HYPERDRIVE) {
    return null;
  }

  try {
    const fasEmployee = await fasSearchEmployeeByPhone(
      c.env.FAS_HYPERDRIVE,
      normalizedPhone,
    );
    if (!fasEmployee || !fasEmployee.socialNo) {
      return null;
    }

    const fasDob = socialNoToDob(fasEmployee.socialNo);
    const dobMatch =
      fasDob !== null &&
      (fasDob === normalizedDob ||
        (normalizedDob.length === 6 && fasDob.slice(2) === normalizedDob));
    if (!dobMatch) {
      return null;
    }

    const syncedUser = await syncSingleFasEmployee(
      fasEmployee,
      db as unknown as Parameters<typeof syncSingleFasEmployee>[1],
      {
        HMAC_SECRET: c.env.HMAC_SECRET,
        ENCRYPTION_KEY: c.env.ENCRYPTION_KEY,
      },
    );

    return syncedUser ?? null;
  } catch (fasError) {
    logger.error("FAS MariaDB lookup failed", {
      error: fasError instanceof Error ? fasError.message : String(fasError),
    });
    return null;
  }
}

export async function validateWorkerCredentials(
  c: Context<AuthBindings>,
  db: ReturnType<typeof drizzle>,
  body: WorkerLoginBody,
  normalizedPhone: string,
  normalizedDob: string,
  phoneHash: string,
  dobHash: string,
  attemptKey: string,
  currentAttempt: Awaited<ReturnType<typeof getLockoutStatus>>,
): Promise<LoginFailureResult | { user: typeof users.$inferSelect }> {
  let userResults: (typeof users.$inferSelect)[] = [];

  const syncedUser = await syncWorkerFromFAS(
    c,
    db,
    normalizedPhone,
    normalizedDob,
  );
  if (syncedUser) {
    userResults = [syncedUser];
  }

  if (userResults.length === 0) {
    userResults = await db
      .select()
      .from(users)
      .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
      .limit(1);
  }

  if (userResults.length === 0) {
    const updatedAttempt = await recordFailedAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    try {
      await logAuditWithContext(
        c,
        db,
        "LOGIN_FAILED",
        phoneHash,
        "LOGIN_LOCKOUT",
        attemptKey,
        {
          reason: "USER_NOT_FOUND",
          attempts: updatedAttempt.attempts,
        },
      );
    } catch {
      // Do not block failed login response on audit failure.
    }

    if (typeof updatedAttempt.lockedUntil === "number") {
      const actorId = await resolveLockoutActorId(db, phoneHash);
      if (actorId) {
        await logLoginLockoutEvent(
          db,
          c,
          actorId,
          phoneHash,
          updatedAttempt.attempts,
          updatedAttempt.lockedUntil,
        );
      }
      return {
        response: accountLockedResponse(
          c,
          updatedAttempt.lockedUntil,
          Date.now(),
        ),
      };
    }

    return {
      response: error(
        c,
        "USER_NOT_FOUND",
        "등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.",
        401,
      ),
    };
  }

  const user = userResults[0];
  if (
    (user.name || "").trim().toLowerCase() !== body.name!.trim().toLowerCase()
  ) {
    const updatedAttempt = await recordFailedAttempt(
      c.env.KV,
      attemptKey,
      currentAttempt,
      Date.now(),
    );
    try {
      await logAuditWithContext(
        c,
        db,
        "LOGIN_FAILED",
        user.id,
        "USER",
        user.id,
        {
          reason: "NAME_MISMATCH",
          attempts: updatedAttempt.attempts,
        },
      );
    } catch {
      // Do not block failed login response on audit failure.
    }

    if (typeof updatedAttempt.lockedUntil === "number") {
      await logLoginLockoutEvent(
        db,
        c,
        user.id,
        phoneHash,
        updatedAttempt.attempts,
        updatedAttempt.lockedUntil,
      );
      return {
        response: accountLockedResponse(
          c,
          updatedAttempt.lockedUntil,
          Date.now(),
        ),
      };
    }

    return {
      response: error(c, "NAME_MISMATCH", "이름이 일치하지 않습니다.", 401),
    };
  }

  if (!user.phoneEncrypted || !user.dobEncrypted) {
    try {
      const encUpdates: Record<string, unknown> = {};
      if (!user.phoneEncrypted) {
        encUpdates.phoneEncrypted = await encrypt(
          c.env.ENCRYPTION_KEY,
          normalizedPhone,
        );
      }
      if (!user.dobEncrypted) {
        encUpdates.dobEncrypted = await encrypt(
          c.env.ENCRYPTION_KEY,
          normalizedDob,
        );
      }
      if (Object.keys(encUpdates).length > 0) {
        encUpdates.updatedAt = new Date();
        await db.update(users).set(encUpdates).where(eq(users.id, user.id));
      }
    } catch {
      // Non-blocking: migration failure must not prevent login
    }
  }

  return { user };
}

export async function registerWorkerDevice(
  c: Context<AuthBindings>,
  db: ReturnType<typeof drizzle>,
  userId: string,
  bodyDeviceId?: string,
) {
  const loginDeviceId = resolveDeviceId(c, bodyDeviceId);
  if (!loginDeviceId) {
    return;
  }

  const existingDevice = await db
    .select()
    .from(deviceRegistrations)
    .where(
      and(
        eq(deviceRegistrations.userId, userId),
        eq(deviceRegistrations.deviceId, loginDeviceId),
      ),
    )
    .get();

  if (existingDevice) {
    await db
      .update(deviceRegistrations)
      .set({ lastSeenAt: new Date() })
      .where(eq(deviceRegistrations.id, existingDevice.id));
    return;
  }

  await db.insert(deviceRegistrations).values({
    userId,
    deviceId: loginDeviceId,
    deviceInfo: c.req.header("User-Agent") || null,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    isTrusted: true,
    isBanned: false,
  });
}

export async function handleWorkerLogin(
  c: Context<AuthBindings>,
  body: WorkerLoginBody | null,
) {
  const startedAt = Date.now();
  const respondWithDelay = async (response: Response) => {
    await enforceMinimumResponseTime(startedAt);
    return response;
  };

  if (!body) {
    return respondWithDelay(error(c, "INVALID_JSON", "Invalid JSON", 400));
  }

  if (!body.name || !body.phone || !body.dob) {
    return respondWithDelay(
      error(c, "MISSING_FIELDS", "name, phone, and dob are required", 400),
    );
  }

  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const rateLimit = await checkRateLimit(
    c.env,
    `auth:login:ip:${clientIp}`,
    5,
    60 * 1000,
  );
  if (!rateLimit.allowed) {
    return respondWithDelay(
      error(
        c,
        "RATE_LIMIT_EXCEEDED",
        "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
        429,
      ),
    );
  }

  const db = drizzle(c.env.DB);
  const normalizedPhone = body.phone.replace(/[^0-9]/g, "");
  const phoneHash = await hmac(c.env.HMAC_SECRET, normalizedPhone);

  const lockoutCheck = await checkLoginLockout(c, phoneHash, Date.now());
  if ("response" in lockoutCheck) {
    return respondWithDelay(lockoutCheck.response);
  }

  const normalizedDob = body.dob.replace(/[^0-9]/g, "");
  const dobHash = await hmac(c.env.HMAC_SECRET, normalizedDob);
  const credentialCheck = await validateWorkerCredentials(
    c,
    db,
    body,
    normalizedPhone,
    normalizedDob,
    phoneHash,
    dobHash,
    lockoutCheck.attemptKey,
    lockoutCheck.currentAttempt,
  );

  if ("response" in credentialCheck) {
    return respondWithDelay(credentialCheck.response);
  }

  const loginData: LoginSuccessResult = {
    user: credentialCheck.user,
    attemptKey: lockoutCheck.attemptKey,
  };

  if (
    c.env.REQUIRE_ATTENDANCE_FOR_LOGIN !== "false" &&
    !loginData.user.loginExempt
  ) {
    let attended = false;
    if (c.env.FAS_HYPERDRIVE && loginData.user.externalWorkerId) {
      try {
        const now = new Date();
        const koreaTime = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
        );
        if (koreaTime.getHours() < 5) {
          koreaTime.setDate(koreaTime.getDate() - 1);
        }
        const accsDay = `${koreaTime.getFullYear()}${String(koreaTime.getMonth() + 1).padStart(2, "0")}${String(koreaTime.getDate()).padStart(2, "0")}`;
        const fasResult = await fasCheckWorkerAttendance(
          c.env.FAS_HYPERDRIVE,
          loginData.user.externalWorkerId,
          accsDay,
        );
        attended = fasResult.hasAttendance;
      } catch (fasErr) {
        logger.error("FAS realtime attendance check failed", {
          error: fasErr instanceof Error ? fasErr.message : String(fasErr),
        });
        attended = true;
      }
    } else {
      const { start, end } = getTodayRange();
      const attendanceRecords = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, loginData.user.id),
            eq(attendance.result, "SUCCESS"),
          ),
        )
        .limit(100);
      attended = attendanceRecords.some((record) => {
        const checkinTime = record.checkinAt;
        return checkinTime && checkinTime >= start && checkinTime < end;
      });
    }

    if (!attended) {
      return respondWithDelay(
        error(
          c,
          "ATTENDANCE_NOT_VERIFIED",
          "오늘 출근 인증이 확인되지 않습니다. 게이트 안면인식 출근 후 이용 가능합니다.",
          403,
        ),
      );
    }
  }

  const phoneForToken =
    loginData.user.piiViewFull && loginData.user.phoneEncrypted
      ? await decrypt(c.env.ENCRYPTION_KEY, loginData.user.phoneEncrypted)
      : "";
  const accessToken = await signJwt(
    { sub: loginData.user.id, phone: phoneForToken, role: loginData.user.role },
    c.env.JWT_SECRET,
  );
  const refreshToken = crypto.randomUUID();
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(users)
    .set({ refreshToken, refreshTokenExpiresAt, updatedAt: new Date() })
    .where(eq(users.id, loginData.user.id));

  await registerWorkerDevice(c, db, loginData.user.id, body.deviceId);

  await clearLockout(c.env.KV, loginData.attemptKey);
  try {
    await logAuditWithContext(
      c,
      db,
      "LOGIN_SUCCESS",
      loginData.user.id,
      "USER",
      loginData.user.id,
      {
        method: "PHONE_DOB",
      },
    );
  } catch {
    // Do not block successful login response on audit failure.
  }

  return respondWithDelay(
    success(
      c,
      {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
        user: {
          id: loginData.user.id,
          phone: phoneForToken,
          role: loginData.user.role,
          name: loginData.user.name,
          nameMasked: loginData.user.nameMasked,
        },
      },
      200,
    ),
  );
}
