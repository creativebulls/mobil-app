import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { DialogProvider } from '../src/components/dialog/DialogProvider';
import { NotificationsProvider } from '../src/notifications/NotificationsProvider';
import { resolveBackendHost } from '../src/config/api';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useEffect(() => {
    void resolveBackendHost();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <DialogProvider>
        <NotificationsProvider>
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
            <Stack.Screen name="chat" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
            <Stack.Screen name="comments" options={{ presentation: 'modal' }} />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="manage-relations" />
            <Stack.Screen name="add-friends" />
            <Stack.Screen name="qr-connect" />
            <Stack.Screen name="user/[userId]" />
            <Stack.Screen name="places" />
            <Stack.Screen name="place-detail" />
          </Stack>
        </NotificationsProvider>
      </DialogProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
