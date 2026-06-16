import type { MulticastMessage } from 'firebase-admin/messaging';

import { isDevelopment } from '../../config/env';
import { User } from '../../modules/users/user.model';
import { getFirebaseMessaging } from './firebase';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
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

  const message: MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: toStringData(payload.data),
    android: {
      priority: 'high',
      notification: {
        channelId,
        sound: 'default',
        defaultVibrateTimings: true,
      },
    },
  };

  try {
    const response = await messaging.sendEachForMulticast(message);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (!result.success && result.error && INVALID_TOKEN_CODES.has(result.error.code)) {
          invalidTokens.push(tokens[index]!);
        }
      });

      if (invalidTokens.length > 0) {
        await removeInvalidTokens(invalidTokens);
      }
    }
  } catch (error) {
    if (isDevelopment) {
      console.warn('[push] Failed to send FCM message', error);
    }
  }
}
