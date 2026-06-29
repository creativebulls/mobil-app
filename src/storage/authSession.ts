import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthTokens, UserProfile } from '../api/types';
import { emitSessionCleared } from '../auth/sessionEvents';
import { clearGuestMode } from './guest';
import { clearOfflineCache } from './offlineCache';

const ACCESS_TOKEN_KEY = '@whereabout/access_token';
const REFRESH_TOKEN_KEY = '@whereabout/refresh_token';
const USER_KEY = '@whereabout/user';
const PENDING_SESSION_KEY = '@whereabout/pending_session';
const RESET_TOKEN_KEY = '@whereabout/reset_token';

export async function saveSession(tokens: AuthTokens, user: UserProfile): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
    [USER_KEY, JSON.stringify(user)],
  ]);
  await AsyncStorage.removeItem(PENDING_SESSION_KEY);
  await clearGuestMode();
}

export async function savePendingSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_SESSION_KEY, token);
}

export async function getPendingSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_SESSION_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_KEY,
    PENDING_SESSION_KEY,
    RESET_TOKEN_KEY,
  ]);
  // Drop cached API data so the next account never sees the previous user's data.
  await clearOfflineCache();
  await clearGuestMode();
  emitSessionCleared();
}

export async function saveResetToken(token: string): Promise<void> {
  await AsyncStorage.setItem(RESET_TOKEN_KEY, token);
}

export async function getResetToken(): Promise<string | null> {
  return AsyncStorage.getItem(RESET_TOKEN_KEY);
}

export async function clearResetToken(): Promise<void> {
  await AsyncStorage.removeItem(RESET_TOKEN_KEY);
}

export async function updateStoredUser(user: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getSocketToken(): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    return accessToken;
  }

  return getPendingSessionToken();
}
