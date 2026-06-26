import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchCurrentUser } from '../src/api/authApi';
import { updatePersonalInfo } from '../src/api/profileApi';
import { getErrorMessage } from '../src/api/types';
import { AnimatedFormInput } from '../src/components/AnimatedFormInput';
import { BrandButton } from '../src/components/BrandButton';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { updateStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

function resolveFirstName(user: {
  firstName: string | null;
  givenName: string | null;
}): string {
  return user.firstName ?? user.givenName ?? '';
}

function resolveLastName(user: {
  lastName: string | null;
  surname: string | null;
}): string {
  return user.lastName ?? user.surname ?? '';
}

export default function EditProfileScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setFirstName(resolveFirstName(user));
      setLastName(resolveLastName(user));
      setUsername(user.username ?? user.email.split('@')[0] ?? '');
      setEmail(user.email);
    } catch {
      setError('Could not load your profile details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isValid = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      username.trim().length >= 3 &&
      email.trim().length > 0,
    [email, firstName, lastName, username],
  );

  async function handleSave() {
    if (!isValid || isSaving) {
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      const result = await updatePersonalInfo({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
      });

      await updateStoredUser(result.user);

      if (result.emailVerificationRequired) {
        await dialog.alert({
          title: 'Verify your new email',
          message: 'We sent a verification link to your new email address. Please verify it to keep your account secure.',
        });
      }

      router.back();
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save your profile'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <StackScreenLayout>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Personal information</Text>
            <Text style={styles.sectionNote}>
              Update how your name, username, and email appear on your account.
            </Text>

            <View style={styles.form}>
              <AnimatedFormInput
                variant="light"
                label="First name"
                autoCapitalize="words"
                autoCorrect={false}
                value={firstName}
                onChangeText={setFirstName}
              />
              <AnimatedFormInput
                variant="light"
                label="Last name"
                autoCapitalize="words"
                autoCorrect={false}
                value={lastName}
                onChangeText={setLastName}
              />
              <AnimatedFormInput
                variant="light"
                label="Username"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={(value) => setUsername(value.replace(/\s/g, ''))}
              />
              <AnimatedFormInput
                variant="light"
                label="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <BrandButton
              label={isSaving ? 'Saving…' : 'Save changes'}
              onPress={() => void handleSave()}
              disabled={!isValid || isSaving}
              style={styles.saveButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: {
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.labelGray,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionNote: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  error: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand,
  },
  saveButton: {
    marginTop: 24,
  },
});
