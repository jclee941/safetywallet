import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { inArray } from "drizzle-orm";
import type { Env } from "../../types";
import { users } from "../../db/schema";
import { createSmsClient } from "../../lib/sms";
import { createLogger } from "../../lib/logger";
import { decrypt } from "../../lib/crypto";

const log = createLogger("notifications");

export const IN_QUERY_CHUNK_SIZE = 50;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function sendSmsFallback(
  env: Env,
  db: DrizzleD1Database,
  userIds: string[],
  message: { title: string; body: string },
): Promise<number> {
  const smsClient = createSmsClient(env);

  const uniqueUserIds = [...new Set(userIds)];
  if (uniqueUserIds.length === 0) {
    return 0;
  }

  const targetUsers: { id: string; phoneEncrypted: string | null }[] = [];

  for (const userIdChunk of chunkArray(uniqueUserIds, IN_QUERY_CHUNK_SIZE)) {
    const chunkUsers = await db
      .select({ id: users.id, phoneEncrypted: users.phoneEncrypted })
      .from(users)
      .where(inArray(users.id, userIdChunk))
      .all();

    targetUsers.push(...chunkUsers);
  }

  const decryptedUsers = await Promise.all(
    targetUsers.map(async (u) => ({
      id: u.id,
      phone: u.phoneEncrypted
        ? await decrypt(env.ENCRYPTION_KEY, u.phoneEncrypted)
        : null,
    })),
  );

  const validTargets = decryptedUsers.filter(
    (u): u is typeof u & { phone: string } => !!u.phone,
  );

  if (validTargets.length === 0) {
    return 0;
  }

  const smsBody = `[송도세브란스] ${message.title}\n${message.body}`;
  const smsMessages = validTargets.map((u) => ({
    to: u.phone,
    body: smsBody,
  }));

  const result = await smsClient.sendBulk(smsMessages);

  log.info("SMS fallback completed", {
    metadata: {
      requested: validTargets.length,
      sent: result.successCount,
      failed: result.failureCount,
    },
  });

  return result.successCount;
}
