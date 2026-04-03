import { createLogger } from "../logger";
import { encryptPayload } from "./encryption";
import { createVapidJwt, type VapidKeys } from "./vapid";

const log = createLogger("web-push");

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushResult {
  success: boolean;
  statusCode: number;
  endpoint: string;
  error?: string;
}

export async function sendPushNotification(
  subscription: PushSubscription,
  message: PushMessage,
  vapidKeys: VapidKeys,
  subject: string = "mailto:admin@safewallet.jclee.me",
): Promise<PushResult> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

    const jwt = await createVapidJwt(audience, subject, vapidKeys.privateKey);
    const payload = JSON.stringify(message);
    const { encrypted } = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth,
    );

    const authorization = `vapid t=${jwt}, k=${vapidKeys.publicKey}`;

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(encrypted.byteLength),
        TTL: "86400",
        Urgency: "normal",
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200) {
      return {
        success: true,
        statusCode: response.status,
        endpoint: subscription.endpoint,
      };
    }

    if (response.status === 410 || response.status === 404) {
      return {
        success: false,
        statusCode: response.status,
        endpoint: subscription.endpoint,
        error: "Subscription expired or invalid",
      };
    }

    const errorBody = await response.text().catch(() => "");
    return {
      success: false,
      statusCode: response.status,
      endpoint: subscription.endpoint,
      error: `Push service returned ${response.status}: ${errorBody}`.slice(
        0,
        500,
      ),
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    log.error("Failed to send push notification", {
      error: { name: e.name, message: e.message },
      metadata: { endpoint: subscription.endpoint },
    });
    return {
      success: false,
      statusCode: 0,
      endpoint: subscription.endpoint,
      error: e.message,
    };
  }
}

export async function sendPushBulk(
  subscriptions: PushSubscription[],
  message: PushMessage,
  vapidKeys: VapidKeys,
  subject?: string,
): Promise<PushResult[]> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(sub, message, vapidKeys, subject),
    ),
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      success: false,
      statusCode: 0,
      endpoint: subscriptions[i].endpoint,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });
}

export function shouldRemoveSubscription(result: PushResult): boolean {
  return result.statusCode === 404 || result.statusCode === 410;
}

export function isRetryableError(result: PushResult): boolean {
  return (
    result.statusCode === 429 ||
    (result.statusCode >= 500 && result.statusCode < 600)
  );
}
