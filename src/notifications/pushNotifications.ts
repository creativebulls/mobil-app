import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { NOTIFICATION_SOUND_ANDROID } from '../constants/notificationSound';
import { registerPushToken, removePushToken } from '../api/notificationsApi';
import { getAccessToken } from '../storage/authSession';
import { displayNotifeePush } from './displayNotifeePush';

const PUSH_TOKEN_KEY = '@whereabout/fcm_push_token';

// Notification types that the in-app heads-up banner renders with a richer UI
// (rounded avatar + name + message). For these we suppress the OS notification
// while the app is in the foreground to avoid showing it twice.
const IN_APP_BANNER_TYPES = new Set([
  'message',
  'like',
  'comment',
  'reply',
  'comment_like',
  'friend_request',
  'friend_request_accepted',
]);

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const content = notification.request.content;
    const data = (content.data ?? {}) as Record<string, string>;

    if (AppState.currentState === 'active' && data.type === 'incoming_call') {
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    if (AppState.currentState === 'active' && IN_APP_BANNER_TYPES.has(data.type)) {
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

  const channelBase = {
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250] as [number, number, number, number],
    lightColor: '#52BAD7',
    sound: NOTIFICATION_SOUND_ANDROID,
    enableVibrate: true,
    showBadge: true,
  };

  await Notifications.setNotificationChannelAsync('default', {
    ...channelBase,
    name: 'Activity',
    description: 'Likes, comments, and friend requests',
  });

  await Notifications.setNotificationChannelAsync('messages', {
    ...channelBase,
    name: 'Messages',
    description: 'Direct messages and group chats',
  });

  await Notifications.setNotificationChannelAsync('calls', {
    ...channelBase,
    name: 'Calls',
    description: 'Incoming and missed voice calls',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('live-audio', {
    ...channelBase,
    name: 'Information sharing',
    description: 'Information sharing requests and active sessions',
    sound: 'default',
  });
}

export async function ensureNotificationChannels(): Promise<void> {
  await ensureAndroidChannel();
  await ensureNotifeeSetup();
}

async function ensureNotifeeSetup(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const channelBase = {
    importance: AndroidImportance.HIGH,
    sound: NOTIFICATION_SOUND_ANDROID,
  };

  await notifee.createChannel({ id: 'default', name: 'Activity', ...channelBase });
  await notifee.createChannel({ id: 'messages', name: 'Messages', ...channelBase });
  await notifee.createChannel({ id: 'calls', name: 'Calls', importance: AndroidImportance.HIGH });
  await notifee.createChannel({
    id: 'live-audio',
    name: 'Information sharing',
    importance: AndroidImportance.HIGH,
  });
}

let remoteHandlersSubscribed = false;

/** Foreground FCM handler: renders Telegram-style notifications via Notifee. */
export function setupRemotePushHandlers(): void {
  if (remoteHandlersSubscribed) {
    return;
  }
  remoteHandlersSubscribed = true;

  onMessage(getMessaging(), async (remoteMessage) => {
    const raw = remoteMessage.data?.notifee;
    if (!raw || typeof raw !== 'string') {
      return;
    }

    const data = (remoteMessage.data ?? {}) as Record<string, string>;
    if (AppState.currentState === 'active' && data.type && IN_APP_BANNER_TYPES.has(data.type)) {
      return;
    }

    await displayNotifeePush(raw);
  });
}

let tokenRefreshSubscribed = false;

/** Sends a freshly issued token to our backend and caches it for deregistration. */
async function persistPushToken(token: string): Promise<void> {
  await registerPushToken(token);
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

/**
 * Returns the platform push token registered with FCM.
 *
 * - Android: Expo's device token is already the FCM registration token.
 * - iOS: Expo's device token is the raw APNs token, which firebase-admin can't
 *   target. We use the Firebase iOS SDK (@react-native-firebase/messaging) to
 *   exchange it for an FCM token so the same backend send path works for both.
 */
async function getPlatformPushToken(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const messaging = getMessaging();

    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    const fcmToken = await getToken(messaging);
    return typeof fcmToken === 'string' && fcmToken.length > 0 ? fcmToken : null;
  }

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  const token = tokenResponse.data;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * iOS FCM tokens can rotate, so subscribe once to re-send a refreshed token to
 * the backend. Registered lazily after the first successful registration.
 */
function ensureTokenRefreshListener(): void {
  if (tokenRefreshSubscribed || Platform.OS !== 'ios') {
    return;
  }

  tokenRefreshSubscribed = true;
  onTokenRefresh(getMessaging(), (token) => {
    if (typeof token === 'string' && token.length > 0) {
      void persistPushToken(token);
    }
  });
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
    const token = await getPlatformPushToken();

    if (!token) {
      return null;
    }

    await persistPushToken(token);
    ensureTokenRefreshListener();
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
