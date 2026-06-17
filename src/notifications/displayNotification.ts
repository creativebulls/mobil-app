import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type RichNotificationInput = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  imageUrl?: string | null;
  subtitle?: string | null;
  channelId?: string;
};

/**
 * Presents a notification with avatar/image when the app is in the foreground.
 * FCM remote payloads often omit the image in the in-app banner, so we re-show
 * a local notification with the same content plus the profile picture.
 */
export async function presentRichNotification(input: RichNotificationInput): Promise<void> {
  const imageUrl = input.imageUrl?.trim() || null;

  const content: Notifications.NotificationContentInput = {
    title: input.title,
    body: input.body,
    data: {
      ...(input.data ?? {}),
      ...(imageUrl ? { imageUrl } : {}),
    },
    sound: 'default',
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ...(Platform.OS === 'android'
      ? {
          priority: Notifications.AndroidNotificationPriority.MAX,
          color: '#F36464',
          vibrate: [0, 250, 250, 250],
        }
      : {}),
  };

  if (Platform.OS === 'ios' && imageUrl) {
    content.attachments = [{ identifier: 'avatar', url: imageUrl, type: 'image/jpeg' }];
  }

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
}
