import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_PROMPT_SNOOZE_KEY = '@whereabout/location_prompt_snoozed_until';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Snooze the "enable location" prompt for 24 hours (used when the user taps
 * "Not now").
 */
export async function snoozeLocationPrompt(): Promise<void> {
  const snoozeUntil = Date.now() + SNOOZE_DURATION_MS;
  await AsyncStorage.setItem(LOCATION_PROMPT_SNOOZE_KEY, String(snoozeUntil));
}

/**
 * Whether the location prompt is currently snoozed (within the 24h window).
 * Expired snoozes are cleared automatically.
 */
export async function isLocationPromptSnoozed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(LOCATION_PROMPT_SNOOZE_KEY);

  if (!value) {
    return false;
  }

  const snoozeUntil = Number(value);

  if (Number.isNaN(snoozeUntil)) {
    await AsyncStorage.removeItem(LOCATION_PROMPT_SNOOZE_KEY);
    return false;
  }

  if (Date.now() < snoozeUntil) {
    return true;
  }

  await AsyncStorage.removeItem(LOCATION_PROMPT_SNOOZE_KEY);
  return false;
}

export async function clearLocationPromptSnooze(): Promise<void> {
  await AsyncStorage.removeItem(LOCATION_PROMPT_SNOOZE_KEY);
}

// Backwards-compatible aliases (now backed by the 24h snooze behaviour).
export const setLocationPromptDismissed = snoozeLocationPrompt;
export const getLocationPromptDismissed = isLocationPromptSnoozed;
export const clearLocationPromptDismissed = clearLocationPromptSnooze;
