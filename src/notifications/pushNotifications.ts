import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { registerPushToken, removePushToken } from '../api/notificationsApi';
import { getAccessToken } from '../storage/authSession';
import { presentRichNotification } from './displayNotification';

const PUSH_TOKEN_KEY = '@whereabout/fcm_push_token';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const content = notification.request.content;
    const data = (content.data ?? {}) as Record<string, string>;
    const imageUrl = data.imageUrl ?? null;
    const channelId = data.type === 'message' ? 'messages' : 'default';
    const subtitle = content.subtitle ?? data.subtitle ?? null;

    // In the foreground, re-present with avatar attachment so message/social
    // pushes look like proper chat notifications (profile pic + subtitle).
    if (AppState.currentState === 'active' && (imageUrl || subtitle)) {
      await presentRichNotification({
        title: content.title ?? '',
        body: content.body ?? '',
        subtitle,
        imageUrl,
        data,
        channelId,
      });

      return {
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Activity',
    description: 'Likes, comments, and friend requests',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F36464',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    description: 'Direct messages and group chats',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F36464',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('live-audio', {
    name: 'Information sharing',
    description: 'Information sharing requests and active sessions',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F36464',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

export async function ensureNotificationChannels(): Promise<void> {
  await ensureAndroidChannel();
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    // Native FCM device token (Android). Sent straight to our own backend,
    // which delivers via Firebase Cloud Messaging — no Expo push service.
    const tokenResponse = await Notifications.getDevicePushTokenAsync();
    const token = tokenResponse.data;

    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    await registerPushToken(token);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

  if (!token) {
    return;
  }

  try {
    await removePushToken(token);
  } catch {
    // best-effort; session may already be cleared
  }

  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
