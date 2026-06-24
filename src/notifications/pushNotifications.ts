import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { registerPushToken, removePushToken } from '../api/notificationsApi';
import { getAccessToken } from '../storage/authSession';

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
      // The in-app call overlay (delivered over the socket) already rings and
      // shows the caller, so fully suppress the OS notification to avoid a
      // duplicate ring/heads-up while the app is open.
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    if (AppState.currentState === 'active' && IN_APP_BANNER_TYPES.has(data.type)) {
      // The themed in-app banner handles this; just play the sound + badge.
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
    lightColor: '#52BAD7',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    description: 'Direct messages and group chats',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52BAD7',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Calls',
    description: 'Incoming and missed voice calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52BAD7',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync('live-audio', {
    name: 'Information sharing',
    description: 'Information sharing requests and active sessions',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#52BAD7',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

export async function ensureNotificationChannels(): Promise<void> {
  await ensureAndroidChannel();
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
