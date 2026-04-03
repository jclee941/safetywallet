import { createLogger } from "../logger";
import type { AlertType } from "./dispatch";

const log = createLogger("alerting");
const COOLDOWN_PREFIX = "alert-cooldown:";

export async function isCoolingDown(
  kv: KVNamespace,
  alertType: AlertType,
): Promise<boolean> {
  const key = `${COOLDOWN_PREFIX}${alertType}`;
  try {
    const value = await kv.get(key);
    return value !== null;
  } catch (err) {
    log.warn("KV alert cooldown read failed, allowing alert", {
      key,
      alertType,
      error: { name: "KVError", message: String(err) },
    });
    return false;
  }
}

export async function setCooldown(
  kv: KVNamespace,
  alertType: AlertType,
  seconds: number,
): Promise<void> {
  const key = `${COOLDOWN_PREFIX}${alertType}`;
  try {
    await kv.put(key, new Date().toISOString(), { expirationTtl: seconds });
  } catch (err) {
    log.warn("KV alert cooldown write failed", {
      key,
      alertType,
      error: { name: "KVError", message: String(err) },
    });
  }
}
