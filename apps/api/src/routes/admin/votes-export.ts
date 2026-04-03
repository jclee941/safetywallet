import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql } from "drizzle-orm";
import type { Env, AuthContext } from "../../types";
import { voteCandidates, votes, users } from "../../db/schema";
import { success, error } from "../../lib/response";
import { logAuditWithContext } from "../../lib/audit";
import { requireAdmin, buildCsv, csvResponse } from "./helpers";

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

app.get("/votes/results", requireAdmin, async (c) => {
  const db = drizzle(c.env.DB);
  const { user: currentUser } = c.get("auth");
  const siteId = c.req.query("siteId");
  const month = c.req.query("month");
  const format = c.req.query("format") || "json";

  if (!siteId || !month) {
    return error(c, "MISSING_PARAMS", "siteId and month are required", 400);
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return error(c, "INVALID_MONTH", "month must be YYYY-MM", 400);
  }

  if (format !== "json" && format !== "csv") {
    return error(
      c,
      "UNSUPPORTED_FORMAT",
      "Only json or csv format supported",
      400,
    );
  }

  const voteCountExpression = sql<number>`COALESCE(COUNT(${votes.id}), 0)`;
  const candidateRows = await db
    .select({
      candidateId: voteCandidates.id,
      userId: users.id,
      userName: users.name,
      userNameMasked: users.nameMasked,
      userCompanyName: users.companyName,
      userTradeType: users.tradeType,
      voteCount: voteCountExpression.as("voteCount"),
    })
    .from(voteCandidates)
    .innerJoin(users, eq(voteCandidates.userId, users.id))
    .leftJoin(
      votes,
      and(
        eq(votes.siteId, voteCandidates.siteId),
        eq(votes.month, voteCandidates.month),
        eq(votes.candidateId, voteCandidates.userId),
      ),
    )
    .where(
      and(eq(voteCandidates.siteId, siteId), eq(voteCandidates.month, month)),
    )
    .groupBy(
      voteCandidates.id,
      users.id,
      users.name,
      users.nameMasked,
      users.companyName,
      users.tradeType,
    )
    .orderBy(desc(voteCountExpression), users.nameMasked)
    .all();

  const results = candidateRows.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    user: {
      id: candidate.userId,
      name: candidate.userName,
      nameMasked: candidate.userNameMasked,
      companyName: candidate.userCompanyName,
      tradeType: candidate.userTradeType,
    },
    voteCount: candidate.voteCount,
    rank: index + 1,
  }));

  if (format === "csv") {
    await logAuditWithContext(
      c,
      db,
      "VOTE_RESULT_EXPORT",
      currentUser.id,
      "EXPORT",
      siteId,
      {
        exportType: "vote-results",
        filterConditions: { siteId, month },
        rowCount: results.length,
      },
    );

    const headers = ["후보 ID", "후보자명", "소속", "업종", "득표수", "순위"];
    const rows = results.map((result) => [
      result.candidateId,
      result.user.nameMasked || result.user.name || "",
      result.user.companyName || "",
      result.user.tradeType || "",
      result.voteCount,
      result.rank,
    ]);
    const csv = buildCsv(headers, rows);
    return csvResponse(c, csv, `vote-results-${siteId}-${month}.csv`);
  }

  return success(c, results);
});

export default app;
