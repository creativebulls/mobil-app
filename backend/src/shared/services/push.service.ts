import type { MulticastMessage } from 'firebase-admin/messaging';

import { isDevelopment } from '../../config/env';
import { User } from '../../modules/users/user.model';
import { getFirebaseMessaging } from './firebase';

export type PushCommunication = {
  /** Thread / conversation id used to group notifications. */
  conversationId: string;
  senderId: string;
  senderName: string;
};

export type PushPayload = {
  title: string;
  body: string;
  /** Absolute HTTPS URL for the sender/actor avatar shown in the notification. */
  imageUrl?: string | null;
  /** @deprecated Prefer `communication` + Telegram-style layout; subtitle shows app name on iOS. */
  subtitle?: string | null;
  data?: Record<string, unknown>;
  channelId?: string;
  /** Groups / replaces notifications for the same thread (e.g. conversation id). */
  androidTag?: string;
  /**
   * When set, renders Telegram-style notifications: sender avatar as a round
   * icon with app badge (iOS Communication Notifications + Android MessagingStyle).
   */
  communication?: PushCommunication | null;
  /**
   * Send a data-only message (no `notification` block). The OS will not auto-
   * display anything; instead our native FirebaseMessagingService builds the
   * notification itself. Required for incoming-call notifications so we can add
   * Accept/Reject actions and a full-screen, lock-screen ringer.
   */
  dataOnly?: boolean;
};

const COMMUNICATION_CATEGORY_ID = 'communication';
const NOTIFICATION_SOUND_IOS = 'notification-recived-sount.mp3';
const NOTIFICATION_SOUND_ANDROID = 'notification_recived_sount';
/** Notifee `AndroidStyle.MESSAGING` enum value. */
const ANDROID_STYLE_MESSAGING = 1;

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

function buildNotifeeOptions(payload: PushPayload, imageUrl?: string) {
  const communication = payload.communication;
  const useTelegramStyle = Boolean(communication);
  const channelId = payload.channelId ?? 'default';

  const ios: Record<string, unknown> = {
    sound: NOTIFICATION_SOUND_IOS,
    foregroundPresentationOptions: {
      alert: true,
      badge: true,
      sound: true,
      banner: true,
      list: true,
    },
  };

  if (useTelegramStyle && communication) {
    ios.categoryId = COMMUNICATION_CATEGORY_ID;
    ios.communicationInfo = {
      conversationId: communication.conversationId,
      sender: {
        id: communication.senderId,
        displayName: communication.senderName,
        ...(imageUrl ? { avatar: imageUrl } : {}),
      },
    };
  }

  const android: Record<string, unknown> = {
    channelId,
    sound: NOTIFICATION_SOUND_ANDROID,
    color: '#52BAD7',
    pressAction: { id: 'default' },
    ...(payload.androidTag ? { tag: payload.androidTag, groupId: payload.androidTag } : {}),
  };

  if (imageUrl) {
    android.largeIcon = imageUrl;
    android.circularLargeIcon = true;
  }

  if (useTelegramStyle && communication) {
    const person = {
      name: communication.senderName,
      ...(imageUrl ? { icon: imageUrl } : {}),
    };
    android.style = {
      type: ANDROID_STYLE_MESSAGING,
      person,
      messages: [
        {
          text: payload.body,
          timestamp: Date.now(),
          person,
        },
      ],
    };
  }

  return {
    title: payload.title,
    body: payload.body,
    ...(imageUrl ? { image: imageUrl } : {}),
    ios,
    android,
  };
}

function buildTelegramStyleMessage(
  tokens: string[],
  payload: PushPayload,
  data: Record<string, string>,
  notifeeOptions: ReturnType<typeof buildNotifeeOptions>,
  imageUrl?: string,
): MulticastMessage {
  return {
    tokens,
    data,
    android: {
      priority: 'high',
      collapseKey: payload.androidTag,
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: NOTIFICATION_SOUND_IOS,
          mutableContent: true,
          contentAvailable: true,
        },
        notifee_options: notifeeOptions,
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
  const useTelegramStyle = Boolean(payload.communication);
  const notifeeOptions = buildNotifeeOptions(payload, imageUrl);

  const data = toStringData({
    ...payload.data,
    ...(imageUrl ? { imageUrl } : {}),
    ...(payload.dataOnly ? { title: payload.title, body: payload.body } : {}),
    ...(useTelegramStyle ? { notifee: JSON.stringify(notifeeOptions) } : {}),
  });

  const message: MulticastMessage = payload.dataOnly
    ? {
        tokens,
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
    : useTelegramStyle
      ? buildTelegramStyleMessage(tokens, payload, data, notifeeOptions, imageUrl)
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
              sound: NOTIFICATION_SOUND_ANDROID,
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
                },
                sound: NOTIFICATION_SOUND_IOS,
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
