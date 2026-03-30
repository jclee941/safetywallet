import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { votes, voteCandidates, users, siteMemberships } from "../../db/schema";
import { VoteResultsQuerySchema } from "../../validators/query";
import { authMiddleware } from "../../middleware/auth";
import { success, error } from "../../lib/response";
import type { Env, AuthContext } from "../../types";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

function getCurrentMonth(): string {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().slice(0, 7);
}

app.get("/current", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const { user } = c.get("auth");
  const currentMonth = getCurrentMonth();

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return success(c, {
      vote: null,
      message: "현재 활성화된 현장이 없습니다.",
    });
  }

  const siteId = membership.siteId;

  const candidates = await db
    .select({
      id: voteCandidates.id,
      userId: voteCandidates.userId,
      source: voteCandidates.source,
      userName: users.name,
      userNameMasked: users.nameMasked,
    })
    .from(voteCandidates)
    .leftJoin(users, eq(voteCandidates.userId, users.id))
    .where(
      and(
        eq(voteCandidates.siteId, siteId),
        eq(voteCandidates.month, currentMonth),
      ),
    )
    .all();

  if (candidates.length === 0) {
    return success(c, {
      vote: null,
      message: "현재 진행 중인 투표가 없습니다.",
    });
  }

  const existingVote = await db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.siteId, siteId),
        eq(votes.month, currentMonth),
        eq(votes.voterId, user.id),
      ),
    )
    .get();

  const voteCounts = await db
    .select({
      candidateId: votes.candidateId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(votes)
    .where(and(eq(votes.siteId, siteId), eq(votes.month, currentMonth)))
    .groupBy(votes.candidateId)
    .all();

  const voteCountMap = new Map(
    voteCounts.map((vc) => [vc.candidateId, vc.count]),
  );

  return success(c, {
    vote: {
      siteId,
      month: currentMonth,
      candidates: candidates.map((cand) => ({
        id: cand.id,
        userId: cand.userId,
        name: cand.userNameMasked || cand.userName || "익명",
        source: cand.source,
        voteCount: voteCountMap.get(cand.userId) || 0,
      })),
    },
    hasVoted: !!existingVote,
    votedCandidateId: existingVote?.candidateId || null,
  });
});

app.get("/my", authMiddleware, async (c) => {
  const { user } = c.get("auth");
  const db = drizzle(c.env.DB);

  const membership = await db
    .select()
    .from(siteMemberships)
    .where(
      and(
        eq(siteMemberships.userId, user.id),
        eq(siteMemberships.status, "ACTIVE"),
      ),
    )
    .get();

  if (!membership) {
    return error(c, "NO_ACTIVE_SITE", "활성 현장이 없습니다", 400);
  }

  const myVotes = await db
    .select({
      id: votes.id,
      month: votes.month,
      candidateId: votes.candidateId,
      candidateName: users.nameMasked,
      votedAt: votes.votedAt,
    })
    .from(votes)
    .innerJoin(users, eq(votes.candidateId, users.id))
    .where(and(eq(votes.siteId, membership.siteId), eq(votes.voterId, user.id)))
    .orderBy(sql`${votes.month} DESC`);

  return success(c, { votes: myVotes });
});

app.get(
  "/results/:siteId",
  zValidator("query", VoteResultsQuerySchema),
  async (c) => {
    const db = drizzle(c.env.DB);
    const siteId = c.req.param("siteId");
    const { month: queryMonth } = c.req.valid("query");
    const month = queryMonth || getCurrentMonth();

    const results = await db
      .select({
        candidateId: voteCandidates.userId,
        name: users.nameMasked,
        count: sql<number>`COUNT(${votes.id})`.as("count"),
      })
      .from(voteCandidates)
      .innerJoin(users, eq(voteCandidates.userId, users.id))
      .leftJoin(
        votes,
        and(
          eq(votes.candidateId, voteCandidates.userId),
          eq(votes.siteId, voteCandidates.siteId),
          eq(votes.month, voteCandidates.month),
        ),
      )
      .where(
        and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
      )
      .groupBy(voteCandidates.userId, users.nameMasked)
      .orderBy(sql`count DESC`);

    return success(c, { month, results });
  },
);

export default app;
