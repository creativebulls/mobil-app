import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef } from 'react';

import { fetchCurrentUser } from '../src/api/authApi';
import { ApiError } from '../src/api/types';
import { AppSplashScreen } from '../src/components/AppSplashScreen';
import { getAccessToken, getRefreshToken, getStoredUser, updateStoredUser } from '../src/storage/authSession';
import { isOnboardingCompleted } from '../src/storage/onboarding';
import { isWelcomeCompleted } from '../src/storage/welcome';

const SPLASH_MIN_DURATION_MS = 3000;

async function resolveActiveSessionRoute(): Promise<'/home' | '/sign-in'> {
  const [accessToken, refreshToken, storedUser] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
    getStoredUser(),
  ]);

  // No saved session at all → straight to sign-in.
  if ((!accessToken && !refreshToken) || !storedUser) {
    return '/sign-in';
  }

  try {
    // Validates the token and transparently refreshes an expired access token.
    const user = await fetchCurrentUser();
    await updateStoredUser(user);
    return user.registrationStatus === 'completed' ? '/home' : '/sign-in';
  } catch (error) {
    // Token is genuinely invalid / refresh failed → session was cleared.
    if (error instanceof ApiError && error.status === 401) {
      return '/sign-in';
    }

    // Offline or transient error → trust the cached session.
    return storedUser.registrationStatus === 'completed' ? '/home' : '/sign-in';
  }
}

export default function Index() {
  const router = useRouter();
  const hasNavigated = useRef(false);

  const handleSplashLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const startTime = Date.now();

      const [welcomeDone, onboardingDone] = await Promise.all([
        isWelcomeCompleted(),
        isOnboardingCompleted(),
      ]);

      let destination: '/welcome' | '/onboarding' | '/home' | '/sign-in';

      if (!welcomeDone) {
        destination = '/welcome';
      } else if (!onboardingDone) {
        destination = '/onboarding';
      } else {
        destination = await resolveActiveSessionRoute();
      }

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remaining));

      if (cancelled || hasNavigated.current) {
        return;
      }
      hasNavigated.current = true;

      router.replace(destination);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <AppSplashScreen onLayout={handleSplashLayout} />;
}
