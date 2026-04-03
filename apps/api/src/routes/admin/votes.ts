import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { auditLogs, sites } from "../../db/schema";
import { success, error } from "../../lib/response";
import { requireAdmin } from "./helpers";
import { createLogger } from "../../lib/logger";
import votesCandidatesApp from "./votes-candidates";
import votesPeriodsApp from "./votes-periods";
import votesExportApp from "./votes-export";

const logger = createLogger("admin/votes");

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.route("/", votesCandidatesApp);
app.route("/", votesPeriodsApp);
app.route("/", votesExportApp);

// Auto-nomination config
app.get("/votes/auto-nomination-config", requireAdmin, async (c) => {
  const siteId = c.req.query("siteId");
  if (!siteId) {
    return error(c, "MISSING_PARAM", "siteId query parameter is required");
  }

  const db = drizzle(c.env.DB);
  const [site] = await db
    .select({
      siteId: sites.id,
      autoNominationTopN: sites.autoNominationTopN,
    })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site) {
    return error(c, "NOT_FOUND", "Site not found", 404);
  }

  return success(c, site);
});

app.patch(
  "/votes/auto-nomination-config",
  requireAdmin,
  zValidator(
    "json",
    z.object({
      siteId: z.string().min(1),
      topN: z.number().int().min(0).max(20),
    }),
  ),
  async (c) => {
    const { user } = c.get("auth");
    const body = c.req.valid("json");
    const db = drizzle(c.env.DB);

    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.id, body.siteId))
      .limit(1);

    if (!site) {
      return error(c, "NOT_FOUND", "Site not found", 404);
    }

    await db
      .update(sites)
      .set({ autoNominationTopN: body.topN })
      .where(eq(sites.id, body.siteId));

    try {
      await db.insert(auditLogs).values({
        action: "AUTO_NOMINATE_CANDIDATES",
        actorId: user.id,
        targetType: "SITE",
        targetId: body.siteId,
        reason: `Updated auto-nomination topN to ${body.topN}`,
      });
    } catch (error) {
      logger.error("Failed to write auto-nomination audit log", error);
    }

    return success(c, { siteId: body.siteId, autoNominationTopN: body.topN });
  },
);

export default app;
