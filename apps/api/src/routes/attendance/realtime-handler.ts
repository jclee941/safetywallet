import type { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";
import { resolveFasSource } from "../../lib/fas";
import { fasGetDailyAttendanceRealtimeStats } from "../../lib/fas";
import { createLogger } from "../../lib/logger";

type AppContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>;

// GET /realtime handler
export async function handleRealtime(c: AppContext) {
  const hyperdrive = c.env.FAS_HYPERDRIVE;
  if (!hyperdrive) {
    return error(
      c,
      "FAS_UNAVAILABLE",
      "FAS Hyperdrive binding not configured",
      503,
    );
  }

  // KST date: today or from query param (?date=YYYYMMDD or YYYY-MM-DD)
  const dateParam = c.req.query("date");
  let accsDay: string;
  if (dateParam) {
    accsDay = dateParam.replace(/-/g, "");
  } else {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    accsDay = kst.toISOString().slice(0, 10).replace(/-/g, "");
  }

  if (!/^\d{8}$/.test(accsDay)) {
    return error(
      c,
      "INVALID_DATE",
      "Date must be YYYYMMDD or YYYY-MM-DD format",
      400,
    );
  }

  const sourceParam = c.req.query("source");
  const source = resolveFasSource(sourceParam);

  try {
    const stats = await fasGetDailyAttendanceRealtimeStats(
      hyperdrive,
      accsDay,
      source.siteCd,
      source,
    );

    return success(c, {
      date: accsDay,
      siteCd: source.siteCd,
      siteName: source.d1SiteName,
      ...stats,
      source: source.dbName,
      realtimeDataSource: stats.source,
      metric: {
        key: "checkedInWorkers",
        definition:
          "distinct emplCd with non-empty inTime from access_daily for the selected site/day",
      },
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    const logger = createLogger("attendance");
    logger.error("Real-time attendance query failed", {
      accsDay,
      error: err instanceof Error ? err.message : String(err),
    });
    return error(
      c,
      "FAS_QUERY_FAILED",
      "Failed to query FAS attendance data",
      500,
    );
  }
}
