import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

import { isDevelopment } from '../../config/env';
import { User } from '../../modules/users/user.model';

const expo = new Expo();

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await User.updateMany(
    { expoPushTokens: { $in: tokens } },
    { $pull: { expoPushTokens: { $in: tokens } } },
  );
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const user = await User.findById(userId).select('expoPushTokens');

  if (!user || user.expoPushTokens.length === 0) {
    return;
  }

  const validTokens = user.expoPushTokens.filter((token) => Expo.isExpoPushToken(token));
  const invalidTokens = user.expoPushTokens.filter((token) => !Expo.isExpoPushToken(token));

  if (invalidTokens.length > 0) {
    await removeInvalidTokens(invalidTokens);
  }

  if (validTokens.length === 0) {
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      if (isDevelopment) {
        console.warn('[push] Failed to send chunk', error);
      }
    }
  }
}
