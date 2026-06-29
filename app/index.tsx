import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { fetchCurrentUser } from '../src/api/authApi';
import { ApiError } from '../src/api/types';
import { AppSplashScreen } from '../src/components/AppSplashScreen';
import { getAccessToken, getRefreshToken, getStoredUser, updateStoredUser } from '../src/storage/authSession';
import { enableGuestMode } from '../src/storage/guest';
import { colors } from '../src/theme/colors';

type SessionRoute = '/home' | '/sign-in' | '/account-suspended';
type BootstrapState = 'loading' | 'splash' | 'navigating';

async function resolveActiveSessionRoute(): Promise<SessionRoute | null> {
  const [accessToken, refreshToken, storedUser] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
    getStoredUser(),
  ]);

  if ((!accessToken && !refreshToken) || !storedUser) {
    return null;
  }

  try {
    const user = await fetchCurrentUser();
    await updateStoredUser(user);
    if (user.suspended) {
      return '/account-suspended';
    }
    return user.registrationStatus === 'completed' ? '/home' : '/sign-in';
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    if (storedUser.suspended) {
      return '/account-suspended';
    }

    return storedUser.registrationStatus === 'completed' ? '/home' : '/sign-in';
  }
}

export default function Index() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('loading');

  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const destination = await resolveActiveSessionRoute();

      if (cancelled) {
        return;
      }

      if (destination) {
        hasNavigated.current = true;
        setBootstrapState('navigating');
        hideNativeSplash();
        router.replace(destination);
        return;
      }

      setBootstrapState('splash');
      hideNativeSplash();
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [hideNativeSplash, router]);

  const navigateOnce = useCallback(
    (destination: '/welcome' | '/home') => {
      if (hasNavigated.current) {
        return;
      }
      hasNavigated.current = true;
      router.replace(destination);
    },
    [router],
  );

  const handleGetStarted = useCallback(() => {
    navigateOnce('/welcome');
  }, [navigateOnce]);

  const handleExploreGuest = useCallback(() => {
    void enableGuestMode().then(() => {
      navigateOnce('/welcome');
    });
  }, [navigateOnce]);

  if (bootstrapState === 'loading' || bootstrapState === 'navigating') {
    return (
      <View style={styles.bootLoader}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <AppSplashScreen
      onGetStarted={handleGetStarted}
      onExploreGuest={handleExploreGuest}
      onLayout={hideNativeSplash}
    />
  );
}

const styles = StyleSheet.create({
  bootLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
});
