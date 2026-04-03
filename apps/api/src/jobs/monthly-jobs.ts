import type { Env } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { acquireSyncLock, releaseSyncLock } from "../lib/sync-lock";
import {
  formatSettleMonth,
  getKSTDate,
  getMonthRange,
  getOrCreateSystemUser,
  log,
} from "./helpers";
import {
  executeAutoNomination,
  executeMonthEndSnapshotLedger,
  executeVoteRewardDistribution,
} from "./monthly";

export async function runMonthEndSnapshot(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const { start, end } = getMonthRange(kstNow);

  log.info("Running month-end snapshot", { kstNow: kstNow.toISOString() });

  await executeMonthEndSnapshotLedger({
    db,
    kstNow,
    start,
    end,
    settleMonth: formatSettleMonth(kstNow),
    systemUserId: await getOrCreateSystemUser(db),
  });
}

export async function runAutoNomination(env: Env): Promise<void> {
  const db = drizzle(env.DB);
  const kstNow = getKSTDate();
  const prevMonthDate = new Date(
    kstNow.getFullYear(),
    kstNow.getMonth() - 1,
    1,
  );

  log.info("Running auto-nomination", {
    month: formatSettleMonth(prevMonthDate),
  });

  const { start: monthStart, end: monthEnd } = getMonthRange(prevMonthDate);

  await executeAutoNomination({
    db,
    prevMonth: formatSettleMonth(prevMonthDate),
    monthStart,
    monthEnd,
    systemUserId: await getOrCreateSystemUser(db),
  });
}

export async function runVoteRewardDistribution(env: Env): Promise<void> {
  if (!env.KV) {
    log.warn("KV binding unavailable; skipping vote reward distribution");
    return;
  }

  const lock = await acquireSyncLock(env.KV, "vote-reward-distribution", 600);
  if (!lock.acquired) {
    log.info("Vote reward distribution already in progress, skipping");
    return;
  }

  const db = drizzle(env.DB);

  try {
    await executeVoteRewardDistribution({
      db,
      env,
      nowEpoch: Math.floor(Date.now() / 1000),
      systemUserId: await getOrCreateSystemUser(db),
    });
  } finally {
    await releaseSyncLock(env.KV, "vote-reward-distribution", lock.holder);
  }
}
