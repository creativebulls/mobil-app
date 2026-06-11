import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { setLocationPromptDismissed } from '../storage/locationPrompt';
import { BrandButton } from './BrandButton';
import { colors } from '../theme/colors';

type LocationPermissionPromptProps = {
  onGranted?: () => void;
  onDismiss?: () => void;
};

export function LocationPermissionPrompt({ onGranted, onDismiss }: LocationPermissionPromptProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState('');

  const checkLocationAccess = useCallback(async () => {
    setIsChecking(true);
    setError('');

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setIsVisible(true);
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();

      if (status === Location.PermissionStatus.GRANTED) {
        setIsVisible(false);
        onGranted?.();
        return;
      }

      setIsVisible(true);
    } catch {
      setIsVisible(true);
      setError('Unable to check location status.');
    } finally {
      setIsChecking(false);
    }
  }, [onGranted]);

  useEffect(() => {
    void checkLocationAccess();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkLocationAccess();
      }
    });

    return () => subscription.remove();
  }, [checkLocationAccess]);

  async function handleEnableLocationPress() {
    setError('');
    setIsRequesting(true);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        await Linking.openSettings();
        return;
      }

      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      if (existingStatus === Location.PermissionStatus.GRANTED) {
        setIsVisible(false);
        onGranted?.();
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === Location.PermissionStatus.GRANTED) {
        setIsVisible(false);
        onGranted?.();
        return;
      }

      setError('Location permission was not granted. You can enable it in Settings.');
    } catch {
      setError('Unable to request location permission.');
    } finally {
      setIsRequesting(false);
    }
  }

  function handleNotNowPress() {
    setIsVisible(false);
    void setLocationPromptDismissed();
    onDismiss?.();
  }

  if (isChecking || !isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enable location</Text>
      <Text style={styles.description}>
        Turn on location to discover awesome places near you and get better recommendations.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BrandButton
        label={isRequesting ? 'Checking…' : 'Enable location'}
        onPress={handleEnableLocationPress}
        disabled={isRequesting}
        style={styles.button}
      />

      <Pressable onPress={handleNotNowPress} disabled={isRequesting} style={styles.notNowPressable}>
        <Text style={styles.notNowText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  button: {
    marginTop: 4,
  },
  notNowPressable: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  notNowText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
});
