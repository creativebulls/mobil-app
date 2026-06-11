import { useLocalSearchParams, useRouter } from 'expo-router';
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

import { resendPasswordResetCode, verifyPasswordResetCode } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';

import { AuthScreenLayout } from '../src/components/AuthScreenLayout';
import { BrandButton } from '../src/components/BrandButton';
import {
  VERIFICATION_CODE_LENGTH,
  VerificationCodeInput,
} from '../src/components/VerificationCodeInput';
import { authStyles } from '../src/theme/authStyles';
import { saveResetToken } from '../src/storage/authSession';

export default function VerificationCodeScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendSeconds, setResendSeconds] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isFormValid = useMemo(
    () => verificationCode.trim().length === VERIFICATION_CODE_LENGTH,
    [verificationCode],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  async function handleVerifyCode() {
    if (!isFormValid || !email || isSubmitting) {
      return;
    }

    setError('');
    setInfo('');
    setIsSubmitting(true);

    try {
      const result = await verifyPasswordResetCode(email, verificationCode.trim());
      await saveResetToken(result.resetToken);

      router.push({
        pathname: '/reset-password-new',
        params: { email },
      });
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, 'Invalid verification code'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (resendSeconds > 0 || !email || isResending) {
      return;
    }

    setError('');
    setInfo('');
    setIsResending(true);

    try {
      await resendPasswordResetCode(email);
      setInfo('A new verification code has been sent to your email.');
      setVerificationCode('');
      setResendSeconds(60);
    } catch (resendError) {
      setError(getErrorMessage(resendError, 'Unable to resend verification code'));
    } finally {
      setIsResending(false);
    }
  }

  function handleSignInPress() {
    router.replace('/sign-in');
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
            {email ? (
              <Text style={authStyles.infoText}>Enter the code sent to {email}</Text>
            ) : null}

            <View style={authStyles.field}>
              <Text style={authStyles.label}>Enter Code</Text>
              <VerificationCodeInput
                variant="light"
                value={verificationCode}
                onChange={setVerificationCode}
              />
            </View>

            {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
            {info ? <Text style={authStyles.infoText}>{info}</Text> : null}

            <BrandButton
              label={isSubmitting ? 'Verifying…' : 'Verify Code'}
              onPress={handleVerifyCode}
              disabled={!isFormValid || isSubmitting}
            />

            <Pressable
              onPress={handleResendCode}
              style={authStyles.linkRow}
              disabled={resendSeconds > 0}
            >
              <Text style={authStyles.footerText}>Didn&apos;t receive the code? </Text>
              {resendSeconds > 0 ? (
                <Text style={authStyles.linkMuted}>Resend in {resendSeconds}s</Text>
              ) : (
                <Text style={authStyles.footerLink}>Resend</Text>
              )}
            </Pressable>

            <View style={authStyles.footer}>
              <Text style={authStyles.footerText}>Back to </Text>
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
