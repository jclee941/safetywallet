import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, sql } from "drizzle-orm";
import { hammingDistance, DUPLICATE_THRESHOLD } from "../../lib/phash";
import {
  postImages,
  pointPolicies,
  pointsLedger,
  posts,
} from "../../db/schema";
import { createLogger } from "../../lib/logger";

const logger = createLogger("posts-helpers");

export function extractR2Key(fileUrl: string): string {
  if (!fileUrl) {
    return "";
  }
  return fileUrl
    .replace(/^.*\/files\//, "")
    .replace(/^.*\/r2\//, "")
    .replace(/^\/?r2\//, "");
}

export interface DuplicateCheckResult {
  duplicateOfPostId: string | null;
  isPotentialDuplicate: boolean;
  imageDuplicate: boolean;
  contentSimilar: boolean;
}

export async function checkDuplicatePosts(
  db: ReturnType<typeof drizzle>,
  data: {
    siteId: string;
    content?: string;
    hazardType?: string | null;
    locationFloor?: string | null;
    locationZone?: string | null;
    imageHashes?: (string | null)[];
  },
): Promise<DuplicateCheckResult> {
  const cutoff = Math.floor(Date.now() / 1000) - 86400;

  const canCheckDuplicate = Boolean(data.locationFloor && data.locationZone);
  const duplicateConditions = [
    sql`${posts.siteId} = ${data.siteId}`,
    sql`${posts.locationFloor} = ${data.locationFloor ?? ""}`,
    sql`${posts.locationZone} = ${data.locationZone ?? ""}`,
    sql`${posts.createdAt} >= ${cutoff}`,
  ];

  if (data.hazardType) {
    duplicateConditions.push(sql`${posts.hazardType} = ${data.hazardType}`);
  }

  const duplicateWhereSql = sql.join(duplicateConditions, sql` and `);

  let contentSimilar = false;
  if (data.content && data.content.length >= 10) {
    const keywords = data.content
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((w: string) => w.length >= 2)
      .slice(0, 5);

    if (keywords.length >= 2) {
      const likeConditions = keywords.map(
        (kw: string) => sql`${posts.content} LIKE ${"%" + kw + "%"}`,
      );
      const recentSimilar = await db
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.siteId, data.siteId),
            sql`${posts.createdAt} >= ${cutoff}`,
            sql`(${sql.join(likeConditions, sql` OR `)})`,
          ),
        )
        .limit(1)
        .all();
      contentSimilar = recentSimilar.length > 0;
    }
  }

  let duplicateOfPostId: string | null = null;
  if (canCheckDuplicate) {
    const dupResult = await db
      .select({ id: posts.id })
      .from(posts)
      .where(duplicateWhereSql)
      .orderBy(desc(posts.createdAt))
      .limit(1)
      .get();
    if (dupResult) {
      duplicateOfPostId = dupResult.id;
    }
  }

  const isPotentialDuplicate =
    canCheckDuplicate || contentSimilar
      ? canCheckDuplicate
        ? !!duplicateOfPostId
        : true
      : false;

  let imageDuplicate = false;
  const hashes = Array.isArray(data.imageHashes) ? data.imageHashes : [];
  if (hashes.some((h: string | null) => h)) {
    const recentImages = await db
      .select({
        imageHash: postImages.imageHash,
        postId: postImages.postId,
      })
      .from(postImages)
      .innerJoin(posts, eq(posts.id, postImages.postId))
      .where(
        and(
          eq(posts.siteId, data.siteId),
          sql`${posts.createdAt} >= ${cutoff}`,
          sql`${postImages.imageHash} IS NOT NULL`,
        ),
      )
      .all();

    for (const hash of hashes) {
      if (!hash) continue;
      for (const recent of recentImages) {
        if (
          recent.imageHash &&
          hammingDistance(hash, recent.imageHash) <= DUPLICATE_THRESHOLD
        ) {
          imageDuplicate = true;
          break;
        }
      }
      if (imageDuplicate) break;
    }
  }

  return {
    duplicateOfPostId,
    isPotentialDuplicate: isPotentialDuplicate || imageDuplicate,
    imageDuplicate,
    contentSimilar,
  };
}

export async function autoAwardPostPoints(
  db: ReturnType<typeof drizzle>,
  userId: string,
  siteId: string,
  postId: string,
): Promise<void> {
  try {
    const postPolicy = await db
      .select()
      .from(pointPolicies)
      .where(
        and(
          eq(pointPolicies.siteId, siteId),
          eq(pointPolicies.reasonCode, "POST_SUBMITTED"),
          eq(pointPolicies.isActive, true),
        ),
      )
      .get();

    if (postPolicy) {
      const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const settleMonth = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}`;
      await db.insert(pointsLedger).values({
        userId,
        siteId,
        postId,
        amount: postPolicy.defaultAmount,
        reasonCode: "POST_SUBMITTED",
        reasonText: postPolicy.name,
        settleMonth,
        occurredAt: new Date(),
      });
    }
  } catch (pointErr) {
    logger.warn("Failed to auto-award POST_SUBMITTED points", {
      error: {
        name: pointErr instanceof Error ? pointErr.name : "Unknown",
        message:
          pointErr instanceof Error ? pointErr.message : String(pointErr),
      },
    });
  }
}
