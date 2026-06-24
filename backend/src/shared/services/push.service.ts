import type { MulticastMessage } from 'firebase-admin/messaging';

import { isDevelopment } from '../../config/env';
import { User } from '../../modules/users/user.model';
import { getFirebaseMessaging } from './firebase';

export type PushPayload = {
  title: string;
  body: string;
  /** Absolute HTTPS URL for the sender/actor avatar shown in the notification. */
  imageUrl?: string | null;
  /** Shown under the title on iOS; subText on some Android devices. */
  subtitle?: string | null;
  data?: Record<string, unknown>;
  channelId?: string;
  /** Groups / replaces notifications for the same thread (e.g. conversation id). */
  androidTag?: string;
  /**
   * Send a data-only message (no `notification` block). The OS will not auto-
   * display anything; instead our native FirebaseMessagingService builds the
   * notification itself. Required for incoming-call notifications so we can add
   * Accept/Reject actions and a full-screen, lock-screen ringer. The title/body
   * are folded into the data payload so the native handler can render them.
   */
  dataOnly?: boolean;
};

// FCM error codes that mean a token is permanently invalid and should be purged.
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await User.updateMany(
    { expoPushTokens: { $in: tokens } },
    { $pull: { expoPushTokens: { $in: tokens } } },
  );
}

// FCM data payloads only accept string values, so coerce everything and drop
// null/undefined entries the client would otherwise receive as the string "null".
function toStringData(data?: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};

  if (!data) {
    return result;
  }

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }
    result[key] = typeof value === 'string' ? value : String(value);
  }

  return result;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const user = await User.findById(userId).select('expoPushTokens');

  if (!user || user.expoPushTokens.length === 0) {
    return;
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return;
  }

  const tokens = user.expoPushTokens;
  const channelId = payload.channelId ?? 'default';
  const imageUrl = payload.imageUrl?.trim() || undefined;
  const data = toStringData({
    ...payload.data,
    ...(imageUrl ? { imageUrl } : {}),
    ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
    // Fold the visible text into data for the data-only path so the native
    // handler can render the notification it builds.
    ...(payload.dataOnly ? { title: payload.title, body: payload.body } : {}),
  });

  const message: MulticastMessage = payload.dataOnly
    ? {
        tokens,
        // No `notification` block: this guarantees onMessageReceived fires in
        // the background/killed state so the native service can build the call
        // notification (Accept/Reject + full-screen ringer).
        data,
        android: {
          priority: 'high',
          collapseKey: payload.androidTag,
        },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'background' },
          payload: { aps: { 'content-available': 1 } },
        },
      }
    : {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(imageUrl ? { imageUrl } : {}),
        },
        data,
        android: {
          priority: 'high',
          collapseKey: payload.androidTag,
          notification: {
            channelId,
            sound: 'default',
            defaultVibrateTimings: true,
            ...(imageUrl ? { imageUrl } : {}),
            ...(payload.androidTag ? { tag: payload.androidTag } : {}),
            color: '#52BAD7',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
                ...(payload.subtitle ? { subtitle: payload.subtitle } : {}),
              },
              sound: 'default',
              ...(imageUrl ? { 'mutable-content': 1 } : {}),
            },
          },
          ...(imageUrl
            ? {
                fcmOptions: {
                  imageUrl,
                },
              }
            : {}),
        },
      };

  try {
    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (!result.success && result.error) {
          // Always log the underlying FCM/APNs error so delivery problems are
          // diagnosable in production (e.g. a missing APNs auth key surfaces as
          // `messaging/third-party-auth-error`).
          console.warn(
            `[push] FCM delivery failed for user ${userId} (token …${tokens[index]?.slice(-8)}): ${result.error.code} - ${result.error.message}`,
          );
          if (INVALID_TOKEN_CODES.has(result.error.code)) {
            invalidTokens.push(tokens[index]!);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await removeInvalidTokens(invalidTokens);
      }
    }

    if (response.successCount > 0 && isDevelopment) {
      console.log(`[push] Sent to ${response.successCount}/${tokens.length} device(s) for user ${userId}`);
    }
  } catch (error) {
    console.warn('[push] Failed to send FCM message', error);
  }
}
