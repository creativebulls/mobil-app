import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { resetPasswordWithToken } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';

import { AnimatedFormInput } from '../src/components/AnimatedFormInput';
import { AuthScreenLayout } from '../src/components/AuthScreenLayout';
import { BrandButton } from '../src/components/BrandButton';
import { authStyles } from '../src/theme/authStyles';
import { clearResetToken, getResetToken } from '../src/storage/authSession';

function isResetPasswordFormValid(password: string, repeatPassword: string) {
  return password.length >= 6 && password === repeatPassword;
}

export default function ResetPasswordNewScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFormValid = useMemo(
    () => isResetPasswordFormValid(password, repeatPassword),
    [password, repeatPassword],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleResetPassword() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const resetToken = await getResetToken();

      if (!resetToken) {
        setError('Reset session expired. Please request a new verification code.');
        return;
      }

      await resetPasswordWithToken(resetToken, password);
      await clearResetToken();

      setSuccess('Your password has been reset successfully.');
      setTimeout(() => {
        router.replace('/sign-in');
      }, 1500);
    } catch (resetError) {
      setError(getErrorMessage(resetError, 'Unable to reset password'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenLayout fallbackHref="/sign-in">
      <KeyboardAvoidingView
        style={authStyles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.form}>
            <AnimatedFormInput
              variant="light"
              label="New Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <AnimatedFormInput
              variant="light"
              label="Repeat Password"
              secureTextEntry
              value={repeatPassword}
              onChangeText={setRepeatPassword}
            />

            {email ? (
              <Text style={authStyles.infoText}>Resetting password for {email}</Text>
            ) : null}

            {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
            {success ? <Text style={authStyles.successText}>{success}</Text> : null}

            <BrandButton
              label={isSubmitting ? 'Resetting…' : 'Reset Password'}
              onPress={handleResetPassword}
              disabled={!isFormValid || isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreenLayout>
  );
}
