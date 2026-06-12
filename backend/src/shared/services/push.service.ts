import type { Expo as ExpoInstance, ExpoPushMessage } from 'expo-server-sdk';

import { isDevelopment } from '../../config/env';
import { User } from '../../modules/users/user.model';

// `expo-server-sdk` is published as an ES module, but this service is compiled
// to CommonJS. A static `import` (or a TS-compiled dynamic `import()`, which is
// down-levelled to `require()`) throws ERR_REQUIRE_ESM at runtime. Using the
// Function constructor preserves a genuine dynamic `import()` that Node can
// resolve for ESM packages from CommonJS code.
const importEsm = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>;

type ExpoModule = typeof import('expo-server-sdk');

let expoModulePromise: Promise<ExpoModule> | null = null;
let expoInstance: ExpoInstance | null = null;

async function getExpo(): Promise<{ Expo: ExpoModule['Expo']; expo: ExpoInstance }> {
  if (!expoModulePromise) {
    expoModulePromise = importEsm<ExpoModule>('expo-server-sdk');
  }
  const mod = await expoModulePromise;
  if (!expoInstance) {
    expoInstance = new mod.Expo();
  }
  return { Expo: mod.Expo, expo: expoInstance };
}

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
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

  const { Expo, expo } = await getExpo();

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
    priority: 'high',
    channelId: payload.channelId ?? 'default',
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
