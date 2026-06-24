import { logoutAccount } from '../api/authApi';
import { unregisterPushNotifications } from '../notifications/pushNotifications';
import { disconnectRealtimeSocket } from '../realtime/socket';
import { clearSession, getRefreshToken } from '../storage/authSession';
import { markNextSessionClearAsLogout } from './sessionEvents';

/** Ends the session and tears down push/realtime. Callers should route to `/welcome`. */
export async function logoutUser(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    await logoutAccount(refreshToken);
  } catch {
    // best-effort
  }
  await unregisterPushNotifications();
  markNextSessionClearAsLogout();
  await clearSession();
  disconnectRealtimeSocket();
}
