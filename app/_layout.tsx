import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { onSessionCleared } from '../src/auth/sessionEvents';
import { CallProvider } from '../src/calls/CallProvider';
import { DialogProvider } from '../src/components/dialog/DialogProvider';
import { NotificationsProvider } from '../src/notifications/NotificationsProvider';
import { PresenceProvider } from '../src/realtime/PresenceProvider';
import { resolveBackendHost } from '../src/config/api';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Screens that are safe to remain on when there is no session.
const PUBLIC_ROUTES = [
  '/',
  '/welcome',
  '/onboarding',
  '/sign-in',
  '/sign-up',
  '/check-email',
  '/email-verified',
  '/your-name',
  '/registration-details',
  '/parental-consent',
  '/reset-password',
  '/reset-password-new',
  '/verification-code',
];

/**
 * Watches for the session being cleared (invalid refresh token or explicit
 * logout) and immediately routes the user to sign-in, so they never sit on an
 * authenticated screen showing blank data.
 */
function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(
    () =>
      onSessionCleared(() => {
        if (!PUBLIC_ROUTES.includes(pathnameRef.current)) {
          router.replace('/sign-in');
        }
      }),
    [router],
  );

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    void resolveBackendHost();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <StatusBar style="light" />
        <DialogProvider>
          <NotificationsProvider>
            <PresenceProvider>
            <CallProvider>
              <SessionGuard />
              <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              <Stack.Screen name="sign-in" options={{ gestureEnabled: false }} />
              <Stack.Screen name="sign-up" />
              <Stack.Screen name="check-email" />
              <Stack.Screen name="email-verified" />
              <Stack.Screen name="your-name" />
              <Stack.Screen name="registration-details" />
              <Stack.Screen name="parental-consent" />
              <Stack.Screen name="reset-password" />
              <Stack.Screen name="verification-code" />
              <Stack.Screen name="reset-password-new" />
              <Stack.Screen name="home" />
              <Stack.Screen name="messages" />
              <Stack.Screen name="new-group" />
              <Stack.Screen name="chat" />
              <Stack.Screen name="profile" />
              <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
              <Stack.Screen name="comments" options={{ presentation: 'modal' }} />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="manage-relations" />
              <Stack.Screen name="add-friends" />
              <Stack.Screen name="friends" />
              <Stack.Screen name="qr-connect" />
              <Stack.Screen name="user/[userId]" />
              <Stack.Screen name="places" />
              <Stack.Screen name="place-detail" />
              </Stack>
            </CallProvider>
            </PresenceProvider>
          </NotificationsProvider>
        </DialogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
