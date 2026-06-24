import notifee from '@notifee/react-native';

/** Displays a push notification from the backend `data.notifee` JSON blob. */
export async function displayNotifeePush(raw: string): Promise<void> {
  try {
    const payload = JSON.parse(raw) as Parameters<typeof notifee.displayNotification>[0];
    await notifee.displayNotification(payload);
  } catch {
    // Ignore malformed payloads.
  }
}
