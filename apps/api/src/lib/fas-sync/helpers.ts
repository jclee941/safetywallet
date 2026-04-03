import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { users } from "../../db/schema";
import { encrypt, hmac } from "../crypto";
import type { FasEmployee } from "../fas";
import { createLogger } from "../logger";

export interface FasSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SyncEnv {
  HMAC_SECRET: string;
  ENCRYPTION_KEY: string;
}

export interface PreparedEmployeeSyncData {
  normalizedPhone: string | null;
  dob: string | null;
  phoneHash: string | null;
  dobHash: string | null;
  phoneEncrypted: string | null;
  dobEncrypted: string | null;
}

export const fasSyncLogger = createLogger("fas-sync");

/**
 * 주민번호 앞 7자리에서 생년월일(YYYYMMDD) 추출
 * socialNo: "7104101" → "19710410"
 * 7번째 자리: 1,2 = 1900년대 / 3,4 = 2000년대 / 9,0 = 1800년대
 */
export function socialNoToDob(socialNo: string | null): string | null {
  if (!socialNo || socialNo.length < 7) return null;

  const yymmdd = socialNo.substring(0, 6);
  const genderDigit = socialNo.charAt(6);

  let century: string;
  switch (genderDigit) {
    case "1":
    case "2":
    case "5":
    case "6":
      century = "19";
      break;
    case "3":
    case "4":
    case "7":
    case "8":
      century = "20";
      break;
    case "9":
    case "0":
      century = "18";
      break;
    default:
      return null;
  }

  return `${century}${yymmdd}`;
}

export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, "");
}

export async function prepareEmployeeSyncData(
  employee: FasEmployee,
  env: SyncEnv,
): Promise<PreparedEmployeeSyncData> {
  const normalizedPhone = normalizePhone(employee.phone);
  const dob = socialNoToDob(employee.socialNo);

  const phoneHash = normalizedPhone
    ? await hmac(env.HMAC_SECRET, normalizedPhone)
    : null;
  const dobHash = dob ? await hmac(env.HMAC_SECRET, dob) : null;
  const phoneEncrypted = normalizedPhone
    ? await encrypt(env.ENCRYPTION_KEY, normalizedPhone)
    : null;
  const dobEncrypted = dob ? await encrypt(env.ENCRYPTION_KEY, dob) : null;

  return {
    normalizedPhone,
    dob,
    phoneHash,
    dobHash,
    phoneEncrypted,
    dobEncrypted,
  };
}

export async function findExistingFasUser(
  db: DrizzleD1Database,
  emplCd: string,
) {
  return db
    .select()
    .from(users)
    .where(
      and(eq(users.externalSystem, "FAS"), eq(users.externalWorkerId, emplCd)),
    )
    .get();
}

export async function findPiiFallbackCandidate(
  db: DrizzleD1Database,
  phoneHash: string | null,
  dobHash: string | null,
) {
  if (!phoneHash || !dobHash) return null;

  return db
    .select()
    .from(users)
    .where(and(eq(users.phoneHash, phoneHash), eq(users.dobHash, dobHash)))
    .get();
}

export function formatSyncError(emplCd: string, error: unknown): string {
  return `${emplCd}: ${error instanceof Error ? error.message : String(error)}`;
}

export function maskName(name: string): string {
  return name;
}
