import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchCurrentUser } from '../src/api/authApi';
import { fetchMyAppeal, submitAppeal } from '../src/api/moderationApi';
import { getErrorMessage, type MyAppeal } from '../src/api/types';
import { logoutUser } from '../src/auth/logoutUser';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { getStoredUser, updateStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

export default function AccountSuspendedScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [reason, setReason] = useState<string | null>(null);
  const [appeal, setAppeal] = useState<MyAppeal | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();
      setReason(stored?.suspensionReason ?? null);

      const [user, appealResult] = await Promise.all([
        fetchCurrentUser().catch(() => null),
        fetchMyAppeal().catch(() => ({ appeal: null })),
      ]);

      if (user) {
        await updateStoredUser(user);
        setReason(user.suspensionReason ?? null);
        if (!user.suspended) {
          router.replace('/home');
          return;
        }
      }
      setAppeal(appealResult.appeal);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    const text = message.trim();
    if (!text) {
      await dialog.alert({ title: 'Add details', message: 'Please explain your appeal.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitAppeal(text);
      setMessage('');
      const result = await fetchMyAppeal();
      setAppeal(result.appeal);
      await dialog.alert({
        title: 'Appeal submitted',
        message: 'Our team will review your appeal and get back to you.',
      });
    } catch (error) {
      await dialog.alert({
        title: 'Could not submit appeal',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const user = await fetchCurrentUser();
      await updateStoredUser(user);
      if (!user.suspended) {
        router.replace('/home');
        return;
      }
      setReason(user.suspensionReason ?? null);
      const result = await fetchMyAppeal();
      setAppeal(result.appeal);
    } catch {
      // Leave the screen as-is on a transient error.
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    router.replace('/welcome');
  }

  const appealPending = appeal?.status === 'pending';
  const appealRejected = appeal?.status === 'rejected';

  return (
    <StackScreenLayout style={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Ionicons name="alert-circle" size={48} color={colors.danger} />
          </View>
          <Text style={styles.title}>Account suspended</Text>
          <Text style={styles.reason}>
            {reason || 'Your account has been suspended for violating our community guidelines.'}
          </Text>

          {appealPending ? (
            <View style={styles.statusCard}>
              <Ionicons name="time-outline" size={20} color={colors.brand} />
              <Text style={styles.statusText}>
                Your appeal is under review. We&apos;ll notify you once a decision is made.
              </Text>
            </View>
          ) : (
            <>
              {appealRejected ? (
                <View style={styles.statusCard}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                  <Text style={styles.statusText}>
                    Your previous appeal was declined. You may submit another with more details.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.appealLabel}>Appeal this decision</Text>
              <TextInput
                style={styles.input}
                placeholder="Explain why we should review your suspension…"
                placeholderTextColor={colors.labelGray}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
                textAlignVertical="top"
              />
              <Pressable
                style={[styles.submitBtn, isSubmitting && styles.submitDisabled]}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.submitText}>Submit appeal</Text>
                )}
              </Pressable>
            </>
          )}

          <Pressable style={styles.refreshBtn} onPress={() => void handleRefresh()} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator color={colors.brand} size="small" />
            ) : (
              <Text style={styles.refreshText}>Refresh status</Text>
            )}
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={() => void handleLogout()}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </ScrollView>
      )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    marginTop: 60,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  reason: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.inputGray,
    borderRadius: 12,
    padding: 14,
    alignSelf: 'stretch',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  appealLabel: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  input: {
    alignSelf: 'stretch',
    minHeight: 120,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  submitBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  refreshBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  logoutBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.labelGray,
  },
});
