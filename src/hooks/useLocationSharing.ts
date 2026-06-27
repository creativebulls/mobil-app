import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { updateMyLocation } from '../api/profileApi';
import { getRefreshToken } from '../storage/authSession';
import { hasLocationAccess } from '../utils/locationAccess';

const SHARE_INTERVAL_MS = 2 * 60 * 1000;

async function pushCurrentLocation(): Promise<void> {
  if (AppState.currentState !== 'active') {
    return;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return;
  }

  if (!(await hasLocationAccess())) {
    return;
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await updateMyLocation(position.coords.latitude, position.coords.longitude);
  } catch {
    // Location fix or network may fail transiently.
  }
}

/** Periodically uploads the user's location so friends can see them on the map. */
export function useLocationSharing(enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (!cancelled) {
        void pushCurrentLocation();
      }
    };

    tick();
    const interval = setInterval(tick, SHARE_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);
}
