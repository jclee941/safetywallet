import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull } from "drizzle-orm";
import { users } from "../../db/schema";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";
import { getTodayRange } from "../../utils/common";
import { toAccsDay, formatAccsDayTime } from "./index";
import { resolveFasSourceByWorkerId } from "../../lib/fas";
import { fasCheckWorkerAttendance } from "../../lib/fas";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

// GET /today handler
export async function handleToday(c: AppContext) {
  const auth = c.get("auth");
  const db = drizzle(c.env.DB);
  const hyperdrive = c.env.FAS_HYPERDRIVE;
  if (!hyperdrive) {
    return error(
      c,
      "FAS_UNAVAILABLE",
      "FAS Hyperdrive binding not configured",
      503,
    );
  }

  const user = await db
    .select({ externalWorkerId: users.externalWorkerId })
    .from(users)
    .where(and(eq(users.id, auth.user.id), isNull(users.deletedAt)))
    .get();

  if (!user?.externalWorkerId) {
    return success(c, {
      hasAttendance: false,
      records: [],
    });
  }

  const { start } = getTodayRange();
  const todayAccsDay = toAccsDay(start);
  const { source, rawEmplCd } = resolveFasSourceByWorkerId(
    user.externalWorkerId,
  );
  let attendanceResult;
  try {
    attendanceResult = await fasCheckWorkerAttendance(
      hyperdrive,
      rawEmplCd,
      todayAccsDay,
      source,
    );
  } catch (err) {
    const log = c.var.log;
    log?.warn("FAS attendance query failed, returning empty", {
      error: {
        name: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err),
      },
      endpoint: "/attendance/today",
    });
    return success(c, { hasAttendance: false, records: [] });
  }

  return success(c, {
    hasAttendance: attendanceResult.hasAttendance,
    records: attendanceResult.records.map((record) => ({
      externalWorkerId: `${source.workerIdPrefix}${record.emplCd}`,
      accsDay: record.accsDay,
      source: "FAS_REALTIME",
      checkinAt: formatAccsDayTime(record.accsDay, record.inTime),
      checkoutAt: formatAccsDayTime(record.accsDay, record.outTime),
      inTime: record.inTime,
      outTime: record.outTime,
    })),
  });
}
