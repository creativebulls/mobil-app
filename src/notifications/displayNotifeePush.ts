import notifee from '@notifee/react-native';
import { Platform } from 'react-native';

type NotifeePayload = Parameters<typeof notifee.displayNotification>[0];

/** Ensures Android messenger-style notifications show the badged avatar correctly. */
function normalizeAndroidNotification(payload: NotifeePayload): NotifeePayload {
  if (Platform.OS !== 'android' || !payload.android) {
    return payload;
  }

  const android = { ...payload.android };
  if (android.largeIcon) {
    android.circularLargeIcon = true;
  }
  if (android.category === 'msg' && android.showTimestamp !== false) {
    android.showTimestamp = true;
  }

  return { ...payload, android };
}

/** Displays a push notification from the backend `data.notifee` JSON blob. */
export async function displayNotifeePush(raw: string): Promise<void> {
  try {
    const payload = normalizeAndroidNotification(JSON.parse(raw) as NotifeePayload);
    await notifee.displayNotification(payload);
  } catch {
    // Ignore malformed payloads.
  }
}
