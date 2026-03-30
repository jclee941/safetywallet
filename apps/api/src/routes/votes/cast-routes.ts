import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import {
  votes,
  voteCandidates,
  votePeriods,
  siteMemberships,
} from "../../db/schema";
import { CastVoteSchema } from "../../validators/schemas";
import { authMiddleware } from "../../middleware/auth";
import { attendanceMiddleware } from "../../middleware/attendance";
import { logAuditWithContext } from "../../lib/audit";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

interface SubmitVoteBody {
  candidateId: string;
  siteId?: string;
}

app.post("/", authMiddleware, zValidator("json", CastVoteSchema), async (c) => {
  const { user } = c.get("auth");

  const body = c.req.valid("json") as SubmitVoteBody;

  if (!body.candidateId) {
    return error(c, "MISSING_CANDIDATE_ID", "candidateId is required", 400);
  }

  await attendanceMiddleware(c, async () => {}, body.siteId);

  const { candidateId } = body;
  const db = drizzle(c.env.DB);

  const membershipConditions = [
    eq(siteMemberships.userId, user.id),
    eq(siteMemberships.status, "ACTIVE"),
  ];

  if (body.siteId) {
    membershipConditions.push(eq(siteMemberships.siteId, body.siteId));
  }

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(and(...membershipConditions))
    .get();

  if (!membership) {
    return error(c, "NO_ACTIVE_SITE", "활성화된 현장이 없습니다.", 400);
  }

  const siteId = membership.siteId;
  const nowEpoch = Math.floor(Date.now() / 1000);

  const activePeriod = await db
    .select({ id: votePeriods.id, month: votePeriods.month })
    .from(votePeriods)
    .where(
      and(
        eq(votePeriods.siteId, siteId),
        lte(votePeriods.startDate, nowEpoch),
        gte(votePeriods.endDate, nowEpoch),
        sql`status = 'ACTIVE'`,
      ),
    )
    .get();

  if (!activePeriod) {
    return error(c, "VOTING_CLOSED", "No active voting period", 409);
  }

  const activePeriodMonth = activePeriod.month;

  const candidate = await db
    .select()
    .from(voteCandidates)
    .where(
      and(
        eq(voteCandidates.siteId, siteId),
        eq(voteCandidates.month, activePeriodMonth),
        eq(voteCandidates.userId, candidateId),
      ),
    )
    .get();

  if (!candidate) {
    return error(c, "INVALID_CANDIDATE", "유효하지 않은 후보입니다.", 400);
  }

  const existingVote = await db
    .select({ id: votes.id })
    .from(votes)
    .where(
      and(
        eq(votes.siteId, siteId),
        eq(votes.month, activePeriodMonth),
        eq(votes.voterId, user.id),
      ),
    )
    .get();

  if (existingVote) {
    return error(c, "DUPLICATE_VOTE", "Already voted in this period", 409);
  }

  if (candidateId === user.id) {
    return error(c, "CANNOT_VOTE_SELF", "자신에게 투표할 수 없습니다.", 400);
  }

  await db.insert(votes).values({
    siteId,
    month: activePeriodMonth,
    voterId: user.id,
    candidateId,
  });

  try {
    await logAuditWithContext(
      c,
      db,
      "VOTE_CAST",
      user.id,
      "VOTE",
      `${siteId}:${activePeriodMonth}:${user.id}`,
      { siteId, month: activePeriodMonth, candidateId },
    );
  } catch {
    // Do not block successful vote submission on audit failure.
  }

  return success(c, { message: "투표가 완료되었습니다." });
});

export default app;
