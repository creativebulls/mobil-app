import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { requestPasswordReset } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';

import { AnimatedFormInput } from '../src/components/AnimatedFormInput';
import { AuthLockIcon } from '../src/components/AuthLockIcon';
import { AuthScreenLayout } from '../src/components/AuthScreenLayout';
import { BrandButton } from '../src/components/BrandButton';
import { authStyles } from '../src/theme/authStyles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFormValid = useMemo(() => EMAIL_PATTERN.test(email.trim()), [email]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleSendCode() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email.trim());

      router.push({
        pathname: '/verification-code',
        params: { email: email.trim() },
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to send verification code'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignInPress() {
    router.replace('/sign-in');
  }

  return (
    <AuthScreenLayout fallbackHref="/sign-in" headerIcon={<AuthLockIcon />}>
      <Text style={authStyles.headerSubtitle}>
        Please enter your registered email to reset your password
      </Text>
      <KeyboardAvoidingView
        style={authStyles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.form}>
            <AnimatedFormInput
              variant="light"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

            <BrandButton
              label={isSubmitting ? 'Sending…' : 'Send Verification Code'}
              onPress={handleSendCode}
              disabled={!isFormValid || isSubmitting}
            />

            <View style={authStyles.footer}>
              <Text style={authStyles.footerText}>Remember your password? </Text>
              <Pressable onPress={handleSignInPress}>
                <Text style={authStyles.footerLink}>Sign In</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreenLayout>
  );
}
