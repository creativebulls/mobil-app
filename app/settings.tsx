import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { fetchCurrentUser } from '../src/api/authApi';
import { fetchSettings, updateSettings } from '../src/api/profileApi';
import type { PushPreferences, UserSettings } from '../src/api/types';
import { logoutUser } from '../src/auth/logoutUser';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { colors } from '../src/theme/colors';

const PUSH_OPTIONS: { key: keyof PushPreferences; label: string; description: string }[] = [
  { key: 'likes', label: 'Likes', description: 'When someone likes your post' },
  { key: 'comments', label: 'Comments & replies', description: 'Comments, replies and comment likes' },
  { key: 'friendRequests', label: 'Friend requests', description: 'New and accepted friend requests' },
  { key: 'messages', label: 'Messages', description: 'New direct messages' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [liveAudioEnabled, setLiveAudioEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchSettings();
      setSettings(result);
    } catch {
      // keep whatever we have
    } finally {
      setIsLoading(false);
    }

    try {
      const user = await fetchCurrentUser();
      setLiveAudioEnabled(user.liveAudioEnabled);
    } catch {
      // ignore; leave previous value
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function persist(next: UserSettings, patch: Parameters<typeof updateSettings>[0]) {
    const previous = settings;
    setSettings(next);
    try {
      const saved = await updateSettings(patch);
      setSettings(saved);
    } catch (error) {
      setSettings(previous);
      await dialog.alert({ title: 'Could not save', message: 'Please try again.' });
    }
  }

  function togglePrivate(value: boolean) {
    if (!settings) {
      return;
    }
    void persist({ ...settings, isPrivate: value }, { isPrivate: value });
  }

  function togglePush(key: keyof PushPreferences, value: boolean) {
    if (!settings) {
      return;
    }
    const pushPreferences = { ...settings.pushPreferences, [key]: value };
    void persist({ ...settings, pushPreferences }, { pushPreferences: { [key]: value } });
  }

  async function performLogout() {
    setIsLoggingOut(true);
    try {
      await logoutUser();
      router.replace('/welcome');
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

  return (
    <StackScreenLayout>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons name="person-circle-outline" size={22} color={colors.text} />
              <Text style={styles.rowLabel}>Edit profile</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.labelGray} />
            </Pressable>

            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Private account</Text>
                <Text style={styles.toggleDescription}>
                  Only your friends can see your posts, status and profile details.
                </Text>
              </View>
              <Switch
                value={settings?.isPrivate ?? false}
                onValueChange={togglePrivate}
                trackColor={{ true: colors.brand, false: colors.border }}
                thumbColor={colors.white}
              />
            </View>

            <Pressable
              onPress={() => router.push('/saved-posts')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.text} />
              <Text style={styles.rowLabel}>Saved posts</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.labelGray} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/manage-relations')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons name="person-remove-outline" size={22} color={colors.text} />
              <Text style={styles.rowLabel}>Blocked & restricted</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.labelGray} />
            </Pressable>

            {liveAudioEnabled ? (
              <>
                <Text style={styles.sectionTitle}>Information sharing</Text>
                <View style={styles.liveCard}>
                  <View style={styles.liveCardHeader}>
                    <Ionicons name="share-social" size={20} color={colors.brand} />
                    <Text style={styles.liveCardTitle}>Information sharing is enabled</Text>
                  </View>
                  <Text style={styles.liveCardBody}>
                    An administrator has enabled information sharing for your account. When a session
                    is requested, you&apos;ll be asked to allow it first, and an &quot;Information
                    sharing on&quot; indicator will show the whole time. You can stop it at any moment.
                  </Text>
                </View>
              </>
            ) : null}

            <Text style={styles.sectionTitle}>Push notifications</Text>
            <Text style={styles.sectionNote}>
              When you turn a push notification off, you&apos;ll still receive it in your in-app
              notification center.
            </Text>
            {PUSH_OPTIONS.map((option) => (
              <View key={option.key} style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleLabel}>{option.label}</Text>
                  <Text style={styles.toggleDescription}>{option.description}</Text>
                </View>
                <Switch
                  value={settings?.pushPreferences[option.key] ?? true}
                  onValueChange={(value) => togglePush(option.key, value)}
                  trackColor={{ true: colors.brand, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>
            ))}

            <Pressable
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              <Text style={styles.rowLabel}>Notification center</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.labelGray} />
            </Pressable>

            <Pressable
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={({ pressed }) => [styles.row, styles.logoutRow, pressed && styles.pressed]}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.brand} />
              <Text style={[styles.rowLabel, styles.logoutLabel]}>
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    marginTop: 40,
  },
  scroll: {
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.labelGray,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionNote: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleText: {
    flex: 1,
    gap: 3,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  logoutRow: {
    marginTop: 24,
    borderBottomWidth: 0,
  },
  logoutLabel: {
    color: colors.brand,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  liveCard: {
    marginHorizontal: 20,
    marginTop: 4,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FDECEC',
    gap: 8,
  },
  liveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  liveCardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
