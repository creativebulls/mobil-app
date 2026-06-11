import AsyncStorage from '@react-native-async-storage/async-storage';

import { WELCOME_STORAGE_KEY } from '../constants/welcome';

export async function isWelcomeCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WELCOME_STORAGE_KEY);
  return value === 'true';
}

export async function markWelcomeCompleted(): Promise<void> {
  await AsyncStorage.setItem(WELCOME_STORAGE_KEY, 'true');
}

export async function resetWelcome(): Promise<void> {
  await AsyncStorage.removeItem(WELCOME_STORAGE_KEY);
}
