import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { logoutAccount } from '../src/api/authApi';
import { FeedHeader } from '../src/components/FeedHeader';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { clearSession, getRefreshToken, getStoredUser } from '../src/storage/authSession';
import { disconnectRealtimeSocket } from '../src/realtime/socket';
import type { UserProfile } from '../src/api/types';
import { colors } from '../src/theme/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void getStoredUser().then(setUser);
    }, []),
  );

  async function performLogout() {
    setIsLoggingOut(true);

    try {
      const refreshToken = await getRefreshToken();
      try {
        await logoutAccount(refreshToken);
      } catch {
        // best-effort server revoke; continue clearing locally regardless
      }
      await clearSession();
      disconnectRealtimeSocket();
      router.replace('/sign-in');
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleLogout() {
    const confirmed = await dialog.confirm({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmText: 'Log out',
      destructive: true,
    });

    if (confirmed) {
      void performLogout();
    }
  }

  const displayName =
    user?.givenName && user?.surname
      ? `${user.givenName} ${user.surname}`
      : user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email ?? 'Your profile';

  return (
    <MainScreenLayout activeTab="profile">
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <FeedHeader title="Profile" />

        <View style={styles.content}>
          {user?.profilePhotoUrl ? (
            <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.name}>{displayName}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.brand} />
            <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out…' : 'Log out'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </MainScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.inputGray,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.brand,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  email: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
  },
});
