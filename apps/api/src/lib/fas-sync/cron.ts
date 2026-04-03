import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { dbBatchChunked } from "../../db/helpers";
import { users } from "../../db/schema";
import type { FasEmployee } from "../fas";
import type { FasSyncResult, SyncEnv } from "./helpers";
import { syncAllEmployeesFromFAS } from "./on-demand";

/**
 * FAS에서 퇴직(stateFlag≠'W') 처리된 직원을 D1에서 soft delete.
 * 퇴직자 코드 목록을 받아 해당 유저만 비활성화한다.
 */
export async function deactivateRetiredEmployees(
  retiredEmplCds: string[],
  db: DrizzleD1Database,
): Promise<number> {
  if (retiredEmplCds.length === 0) return 0;

  const retiredSet = new Set(retiredEmplCds);

  const fasUsers = await db
    .select({
      id: users.id,
      externalWorkerId: users.externalWorkerId,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.externalSystem, "FAS"))
    .all();

  const deactivateOps: Promise<unknown>[] = [];
  const now = new Date();

  for (const user of fasUsers) {
    if (
      user.externalWorkerId &&
      retiredSet.has(user.externalWorkerId) &&
      !user.deletedAt
    ) {
      deactivateOps.push(
        db
          .update(users)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(users.id, user.id)),
      );
    }
  }

  if (deactivateOps.length > 0) {
    await dbBatchChunked(db, deactivateOps);
  }

  return deactivateOps.length;
}

export interface FasSyncCronInput {
  activeEmployees: FasEmployee[];
  retiredEmplCds: string[];
}

export interface FasSyncCronResult {
  syncResult: FasSyncResult;
  deactivated: number;
}

export async function runFasSyncCron(
  input: FasSyncCronInput,
  db: DrizzleD1Database,
  env: SyncEnv,
): Promise<FasSyncCronResult> {
  const syncResult = await syncAllEmployeesFromFAS(
    input.activeEmployees,
    db,
    env,
  );
  const deactivated = await deactivateRetiredEmployees(
    input.retiredEmplCds,
    db,
  );
  return { syncResult, deactivated };
}
