import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchBlockedUsers,
  fetchRestrictedUsers,
  type RelationUser,
} from '../src/api/profileApi';
import { unblockUser, unrestrictUser } from '../src/api/messagesApi';
import { getErrorMessage } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { openUserProfile } from '../src/utils/openUserProfile';
import { getStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

export default function ManageRelationsScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [blocked, setBlocked] = useState<RelationUser[]>([]);
  const [restricted, setRestricted] = useState<RelationUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [blockedResult, restrictedResult, me] = await Promise.all([
        fetchBlockedUsers(),
        fetchRestrictedUsers(),
        getStoredUser(),
      ]);
      setBlocked(blockedResult.users);
      setRestricted(restrictedResult.users);
      setCurrentUserId(me?.id ?? null);
    } catch {
      // keep current state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleUnblock(user: RelationUser) {
    setBusyId(user.id);
    try {
      await unblockUser(user.id);
      setBlocked((current) => current.filter((item) => item.id !== user.id));
    } catch (error) {
      await dialog.alert({ title: 'Could not unblock', message: getErrorMessage(error, 'Try again later') });
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnrestrict(user: RelationUser) {
    setBusyId(user.id);
    try {
      await unrestrictUser(user.id);
      setRestricted((current) => current.filter((item) => item.id !== user.id));
    } catch (error) {
      await dialog.alert({ title: 'Could not update', message: getErrorMessage(error, 'Try again later') });
    } finally {
      setBusyId(null);
    }
  }

  function renderRow(user: RelationUser, actionLabel: string, onAction: () => void) {
    return (
      <View key={user.id} style={styles.row}>
        <Pressable
          style={styles.rowMain}
          onPress={() => openUserProfile(router, user.id, currentUserId)}
        >
          <Avatar uri={user.avatarUri} name={user.name} size={44} />
          <Text style={styles.name} numberOfLines={1}>
            {user.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={onAction}
          disabled={busyId === user.id}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{busyId === user.id ? '…' : actionLabel}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Blocked & restricted</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>Blocked accounts</Text>
            <Text style={styles.sectionNote}>
              Blocked people can&apos;t message you, send friend requests, or see your profile.
            </Text>
            {blocked.length === 0 ? (
              <Text style={styles.empty}>You haven&apos;t blocked anyone.</Text>
            ) : (
              blocked.map((user) => renderRow(user, 'Unblock', () => handleUnblock(user)))
            )}

            <Text style={styles.sectionTitle}>Restricted accounts</Text>
            <Text style={styles.sectionNote}>
              Restricted people can still message you, but their messages arrive quietly without push
              notifications.
            </Text>
            {restricted.length === 0 ? (
              <Text style={styles.empty}>You haven&apos;t restricted anyone.</Text>
            ) : (
              restricted.map((user) => renderRow(user, 'Unrestrict', () => handleUnrestrict(user)))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
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
    paddingBottom: 6,
  },
  sectionNote: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
