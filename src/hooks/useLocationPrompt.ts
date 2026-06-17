import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';

import { useDialog } from '../components/dialog/DialogProvider';
import { isLocationPromptSnoozed, snoozeLocationPrompt } from '../storage/locationPrompt';
import { hasLocationAccess } from '../utils/locationAccess';

async function requestLocationAccess(): Promise<void> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      await Linking.openSettings();
      return;
    }

    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === Location.PermissionStatus.GRANTED) {
      return;
    }

    if (!current.canAskAgain) {
      await Linking.openSettings();
      return;
    }

    const result = await Location.requestForegroundPermissionsAsync();

    if (result.status !== Location.PermissionStatus.GRANTED && !result.canAskAgain) {
      await Linking.openSettings();
    }
  } catch {
    // ignore — user can retry from the next prompt
  }
}

/**
 * Shows a themed dialog asking the user to enable location whenever location
 * access is disabled. If the user taps "Not now" the prompt is snoozed for 24h.
 */
export function useLocationPrompt(enabled = true) {
  const dialog = useDialog();
  const isShowingRef = useRef(false);

  const maybePrompt = useCallback(async () => {
    if (!enabled || isShowingRef.current) {
      return;
    }

    const granted = await hasLocationAccess();
    if (granted) {
      return;
    }

    const snoozed = await isLocationPromptSnoozed();
    if (snoozed) {
      return;
    }

    isShowingRef.current = true;

    const result = await dialog.show({
      title: 'Enable location',
      message:
        'Turn on location to discover awesome places near you and get better recommendations.',
      dismissable: true,
      buttons: [
        { text: 'Not now', style: 'cancel', value: 'not_now' },
        { text: 'Allow location', style: 'default', value: 'allow' },
      ],
    });

    isShowingRef.current = false;

    if (result === 'allow') {
      await requestLocationAccess();
    } else {
      await snoozeLocationPrompt();
    }
  }, [dialog, enabled]);

  useEffect(() => {
    void maybePrompt();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void maybePrompt();
      }
    });

    return () => subscription.remove();
  }, [maybePrompt]);
}
