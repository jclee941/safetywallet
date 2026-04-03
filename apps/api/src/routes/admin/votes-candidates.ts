import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { voteCandidates, users, auditLogs } from "../../db/schema";
import { AdminCreateVoteCandidateSchema } from "../../validators/schemas";
import { success, error } from "../../lib/response";
import { requireAdmin } from "./helpers";
import { createLogger } from "../../lib/logger";

const logger = createLogger("admin/votes-candidates");
const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.get("/votes/candidates", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const siteId = c.req.query("siteId");
  const month = c.req.query("month");
  if (!siteId || !month)
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);

  const candidates = await db
    .select({
      id: voteCandidates.id,
      month: voteCandidates.month,
      source: voteCandidates.source,
      createdAt: voteCandidates.createdAt,
      user: {
        id: users.id,
        name: users.name,
        nameMasked: users.nameMasked,
        companyName: users.companyName,
        tradeType: users.tradeType,
      },
    })
    .from(voteCandidates)
    .innerJoin(users, eq(voteCandidates.userId, users.id))
    .where(
      and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
    )
    .orderBy(desc(voteCandidates.createdAt))
    .all();

  return success(c, { candidates });
});

app.post(
  "/votes/candidates",
  requireAdmin,
  zValidator("json", AdminCreateVoteCandidateSchema as never),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { user: currentUser } = c.get("auth");
    const body: z.infer<typeof AdminCreateVoteCandidateSchema> =
      c.req.valid("json");

    if (!body.userId || !body.siteId || !body.month) {
      return error(
        c,
        "MISSING_FIELDS",
        "userId, siteId, and month are required",
        400,
      );
    }

    const existing = await db
      .select()
      .from(voteCandidates)
      .where(
        and(
          eq(voteCandidates.siteId, body.siteId),
          eq(voteCandidates.userId, body.userId),
          eq(voteCandidates.month, body.month),
        ),
      )
      .get();

    if (existing)
      return error(
        c,
        "DUPLICATE_CANDIDATE",
        "Candidate already exists for this month",
        409,
      );

    const newCandidate = await db
      .insert(voteCandidates)
      .values({
        userId: body.userId,
        siteId: body.siteId,
        month: body.month,
        source: "ADMIN",
      })
      .returning()
      .get();

    try {
      await db.insert(auditLogs).values({
        action: "VOTE_CANDIDATE_ADDED",
        actorId: currentUser.id,
        targetType: "VOTE_CANDIDATE",
        targetId: newCandidate.id,
        reason: `Added candidate ${body.userId} for ${body.month}`,
      });
    } catch (error) {
      logger.error("Failed to write candidate-add audit log", error);
    }

    return success(c, { candidate: newCandidate }, 201);
  },
);

app.delete("/votes/candidates/:id", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const id = c.req.param("id");
  if (!id) return error(c, "BAD_REQUEST", "Vote ID is required", 400);

  const existing = await db
    .select()
    .from(voteCandidates)
    .where(eq(voteCandidates.id, id))
    .get();
  if (!existing)
    return error(c, "CANDIDATE_NOT_FOUND", "Candidate not found", 404);

  await db.delete(voteCandidates).where(eq(voteCandidates.id, id)).run();
  try {
    await db.insert(auditLogs).values({
      action: "VOTE_CANDIDATE_REMOVED",
      actorId: currentUser.id,
      targetType: "VOTE_CANDIDATE",
      targetId: id,
      reason: `Removed candidate ${existing.userId} from ${existing.month}`,
    });
  } catch (error) {
    logger.error("Failed to write candidate-remove audit log", error);
  }
  return success(c, { success: true });
});

export default app;
