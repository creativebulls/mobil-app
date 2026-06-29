import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_MODE_KEY = '@guest_mode';

export async function isGuestMode(): Promise<boolean> {
  const value = await AsyncStorage.getItem(GUEST_MODE_KEY);
  return value === 'true';
}

export async function enableGuestMode(): Promise<void> {
  await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
}

export async function clearGuestMode(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_MODE_KEY);
}
