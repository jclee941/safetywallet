import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, inArray } from "drizzle-orm";
import type { AuthContext, Env } from "../../types";
import { users } from "../../db/schema";
import { hmac, encrypt } from "../../lib/crypto";
import { logAuditWithContext } from "../../lib/audit";
import { dbBatchChunked } from "../../db/helpers";
import { success, error } from "../../lib/response";
import { maskName } from "../../utils/common";
import { AdminSyncWorkersSchema } from "../../validators/schemas";

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

app.post(
  "/workers/sync",
  zValidator("json", AdminSyncWorkersSchema),
  async (c) => {
    const auth = c.get("auth");
    if (
      auth?.user?.role !== "SUPER_ADMIN" &&
      auth?.user?.role !== "SITE_ADMIN"
    ) {
      return error(c, "FORBIDDEN", "관리자 권한이 필요합니다", 403);
    }
    const db = drizzle(c.env.DB);

    let data: {
      siteId?: string;
      workers?: Array<{
        externalWorkerId?: string;
        name?: string;
        phone?: string;
        dob?: string;
        companyName?: string;
        tradeType?: string;
      }>;
    } | null = null;
    try {
      c.req.valid("json");
      data = (await c.req.raw.clone().json()) as {
        siteId?: string;
        workers?: Array<{
          externalWorkerId?: string;
          name?: string;
          phone?: string;
          dob?: string;
          companyName?: string;
          tradeType?: string;
        }>;
      };
    } catch {
      return error(c, "INVALID_JSON", "Invalid JSON", 400);
    }

    if (!data.workers || !Array.isArray(data.workers)) {
      return error(
        c,
        "MISSING_WORKERS_ARRAY",
        "workers array is required",
        400,
      );
    }

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as { externalWorkerId: string; error: string }[],
    };

    // Phase 1: Validate workers
    const validWorkers: Array<{
      externalWorkerId: string;
      name: string;
      phone: string;
      dob: string;
      companyName: string | null;
      tradeType: string | null;
    }> = [];

    for (const worker of data.workers) {
      if (
        !worker.externalWorkerId ||
        !worker.name ||
        !worker.phone ||
        !worker.dob
      ) {
        results.failed++;
        results.errors.push({
          externalWorkerId: worker.externalWorkerId || "unknown",
          error: "Missing required fields: externalWorkerId, name, phone, dob",
        });
        continue;
      }
      validWorkers.push({
        externalWorkerId: worker.externalWorkerId,
        name: worker.name,
        phone: worker.phone,
        dob: worker.dob,
        companyName: worker.companyName ?? null,
        tradeType: worker.tradeType ?? null,
      });
    }

    if (validWorkers.length > 0) {
      // Phase 2: Compute crypto in parallel
      const prepared = await Promise.all(
        validWorkers.map(async (w) => {
          const normalizedPhone = w.phone.replace(/[^0-9]/g, "");
          const [phoneHash, dobHash, phoneEncrypted, dobEncrypted] =
            await Promise.all([
              hmac(c.env.HMAC_SECRET, normalizedPhone),
              hmac(c.env.HMAC_SECRET, w.dob),
              encrypt(c.env.ENCRYPTION_KEY, normalizedPhone),
              encrypt(c.env.ENCRYPTION_KEY, w.dob),
            ]);
          return {
            ...w,
            phoneHash,
            dobHash,
            phoneEncrypted,
            dobEncrypted,
            nameMasked: maskName(w.name),
          };
        }),
      );

      // Phase 3: Batch-fetch existing users (chunked for SQLite variable limit)
      const LOOKUP_CHUNK = 500;
      const existingMap = new Map<string, string>();
      for (let i = 0; i < prepared.length; i += LOOKUP_CHUNK) {
        const chunk = prepared.slice(i, i + LOOKUP_CHUNK);
        const ids = chunk.map((w) => w.externalWorkerId);
        const existing = await db
          .select({
            id: users.id,
            externalWorkerId: users.externalWorkerId,
          })
          .from(users)
          .where(inArray(users.externalWorkerId, ids))
          .all();
        for (const u of existing) {
          if (u.externalWorkerId) existingMap.set(u.externalWorkerId, u.id);
        }
      }

      // Phase 4: Build batch operations
      const operations: Promise<unknown>[] = [];
      for (const w of prepared) {
        const existingId = existingMap.get(w.externalWorkerId);
        if (existingId) {
          operations.push(
            db
              .update(users)
              .set({
                name: w.name,
                nameMasked: w.nameMasked,
                phoneHash: w.phoneHash,
                phoneEncrypted: w.phoneEncrypted,
                dobHash: w.dobHash,
                dobEncrypted: w.dobEncrypted,
                companyName: w.companyName,
                tradeType: w.tradeType,
                updatedAt: new Date(),
              })
              .where(eq(users.id, existingId)),
          );
          results.updated++;
        } else {
          operations.push(
            db.insert(users).values({
              externalSystem: "FAS",
              externalWorkerId: w.externalWorkerId,
              name: w.name,
              nameMasked: w.nameMasked,
              phoneHash: w.phoneHash,
              phoneEncrypted: w.phoneEncrypted,
              dobHash: w.dobHash,
              dobEncrypted: w.dobEncrypted,
              companyName: w.companyName,
              tradeType: w.tradeType,
              role: "WORKER",
            }),
          );
          results.created++;
        }
      }

      // Phase 5: Execute batched writes
      const batchResult = await dbBatchChunked(db, operations);
      if (batchResult.failedChunks > 0) {
        results.failed += batchResult.failedChunks;
        for (const err of batchResult.errors) {
          results.errors.push({
            externalWorkerId: "batch",
            error: `Chunk ${err.chunkIndex} failed: ${err.error}`,
          });
        }
      }
    }

    try {
      await logAuditWithContext(
        c,
        db,
        "FAS_WORKERS_SYNCED",
        "system",
        "USER",
        "BULK",
        {
          totalWorkers: data.workers.length,
          created: results.created,
          updated: results.updated,
          failed: results.failed,
        },
      );
    } catch {
      // Do not block successful sync response on audit failure.
    }

    return success(c, results);
  },
);

app.delete("/workers/:externalWorkerId", async (c) => {
  const auth = c.get("auth");
  if (auth.user.role !== "SITE_ADMIN" && auth.user.role !== "SUPER_ADMIN") {
    return error(c, "ADMIN_ACCESS_REQUIRED", "Admin access required", 403);
  }

  const db = drizzle(c.env.DB);
  const externalWorkerId = c.req.param("externalWorkerId");

  if (!externalWorkerId) {
    return error(
      c,
      "MISSING_EXTERNAL_WORKER_ID",
      "externalWorkerId is required",
      400,
    );
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.externalWorkerId, externalWorkerId))
    .get();

  if (!user) {
    return success(c, { deleted: false, reason: "User not found" });
  }

  await db.delete(users).where(eq(users.id, user.id));

  try {
    await logAuditWithContext(
      c,
      db,
      "USER_PROFILE_UPDATED",
      "system",
      "USER",
      user.id,
      {
        action: "FAS_WORKER_DELETED",
        externalWorkerId,
      },
    );
  } catch {
    // Do not block successful delete response on audit failure.
  }

  return success(c, { deleted: true });
});

export default app;
