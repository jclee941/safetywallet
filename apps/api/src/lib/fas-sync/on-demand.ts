import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../../db/schema";
import type { FasEmployee } from "../fas";
import {
  type FasSyncResult,
  type SyncEnv,
  fasSyncLogger,
  findExistingFasUser,
  findPiiFallbackCandidate,
  formatSyncError,
  maskName,
  prepareEmployeeSyncData,
} from "./helpers";

/**
 * FAS 직원 1명을 D1에 동기화 (upsert).
 * 기존 app 데이터(role, points, permissions)는 보존.
 * 반환: D1 user record 또는 null (동기화 실패 시)
 */
export async function syncSingleFasEmployee(
  employee: FasEmployee,
  db: DrizzleD1Database,
  env: SyncEnv,
): Promise<typeof users.$inferSelect | null> {
  const {
    normalizedPhone,
    dob,
    phoneHash,
    dobHash,
    phoneEncrypted,
    dobEncrypted,
  } = await prepareEmployeeSyncData(employee, env);

  const existing = await findExistingFasUser(db, employee.emplCd);
  const now = new Date();

  if (existing) {
    await db
      .update(users)
      .set({
        name: employee.name,
        nameMasked: maskName(employee.name),
        ...(normalizedPhone ? { phoneHash, phoneEncrypted } : {}),
        ...(dob ? { dobHash, dobEncrypted } : {}),
        companyName: employee.companyName || null,
        tradeType: employee.partCd || null,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id));

    return (
      (await db.select().from(users).where(eq(users.id, existing.id)).get()) ??
      null
    );
  }

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: employee.name,
    nameMasked: maskName(employee.name),
    phoneHash,
    phoneEncrypted,
    dobHash,
    dobEncrypted,
    externalSystem: "FAS",
    externalWorkerId: employee.emplCd,
    companyName: employee.companyName || null,
    tradeType: employee.partCd || null,
    role: "WORKER",
    createdAt: now,
    updatedAt: now,
  });

  return (
    (await db.select().from(users).where(eq(users.id, userId)).get()) ?? null
  );
}

/**
 * FAS 직원 목록을 D1에 일괄 동기화.
 * D1 batch write 제한 고려하여 순차 처리.
 */
export async function syncFasEmployeesToD1(
  employees: FasEmployee[],
  db: DrizzleD1Database,
  env: SyncEnv,
): Promise<FasSyncResult> {
  const result: FasSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const emp of employees) {
    try {
      const {
        normalizedPhone,
        dob,
        phoneHash,
        dobHash,
        phoneEncrypted,
        dobEncrypted,
      } = await prepareEmployeeSyncData(emp, env);

      const existing = await findExistingFasUser(db, emp.emplCd);
      const piiFallbackCandidate = await findPiiFallbackCandidate(
        db,
        phoneHash,
        dobHash,
      );

      const now = new Date();

      if (existing) {
        const piiCollisionOnUpdate =
          piiFallbackCandidate && piiFallbackCandidate.id !== existing.id;

        if (piiCollisionOnUpdate) {
          fasSyncLogger.warn(
            "Detected PII-hash collision for existing FAS user during bulk sync; skipped PII update",
            {
              action: "fas.bulk_sync.pii_collision_existing",
              metadata: {
                emplCd: emp.emplCd,
                existingUserId: existing.id,
                candidateUserId: piiFallbackCandidate.id,
                candidateExternalSystem: piiFallbackCandidate.externalSystem,
                candidateExternalWorkerId:
                  piiFallbackCandidate.externalWorkerId,
              },
            },
          );
        }

        await db
          .update(users)
          .set({
            name: emp.name,
            nameMasked: maskName(emp.name),
            ...(normalizedPhone && !piiCollisionOnUpdate
              ? { phoneHash, phoneEncrypted }
              : {}),
            ...(dob && !piiCollisionOnUpdate ? { dobHash, dobEncrypted } : {}),
            companyName: emp.companyName || null,
            tradeType: emp.partCd || null,
            updatedAt: now,
          })
          .where(eq(users.id, existing.id));

        result.updated++;
      } else {
        if (piiFallbackCandidate) {
          fasSyncLogger.warn(
            "Detected PII-hash fallback candidate during FAS bulk sync; created new user instead",
            {
              action: "fas.bulk_sync.pii_fallback_candidate",
              metadata: {
                emplCd: emp.emplCd,
                candidateUserId: piiFallbackCandidate.id,
                candidateExternalSystem: piiFallbackCandidate.externalSystem,
                candidateExternalWorkerId:
                  piiFallbackCandidate.externalWorkerId,
              },
            },
          );
        }

        const userId = crypto.randomUUID();
        await db.insert(users).values({
          id: userId,
          name: emp.name,
          nameMasked: maskName(emp.name),
          phoneHash: piiFallbackCandidate ? null : phoneHash,
          phoneEncrypted: piiFallbackCandidate ? null : phoneEncrypted,
          dobHash: piiFallbackCandidate ? null : dobHash,
          dobEncrypted: piiFallbackCandidate ? null : dobEncrypted,
          externalSystem: "FAS",
          externalWorkerId: emp.emplCd,
          companyName: emp.companyName || null,
          tradeType: emp.partCd || null,
          role: "WORKER",
          createdAt: now,
          updatedAt: now,
        });
        result.created++;
      }
    } catch (error) {
      result.errors.push(formatSyncError(emp.emplCd, error));
    }
  }

  return result;
}

export const syncEmployeeFromFAS = syncSingleFasEmployee;
export const syncAllEmployeesFromFAS = syncFasEmployeesToD1;
