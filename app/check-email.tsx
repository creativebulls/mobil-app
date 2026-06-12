import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getVerificationStatus,
  resendVerificationEmail,
  resumeVerifiedSession,
} from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import { AuthSuccessIcon } from '../src/components/AuthSuccessIcon';
import { BrandButton } from '../src/components/BrandButton';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { useAuthSocket } from '../src/hooks/useAuthSocket';
import { registerForPushNotifications } from '../src/notifications/pushNotifications';
import { getPendingSessionToken, saveSession } from '../src/storage/authSession';
import { getSignUpEmail } from '../src/storage/signUpDraft';
import { authStyles } from '../src/theme/authStyles';
import { colors } from '../src/theme/colors';

const POLL_INTERVAL_MS = 4000;

export default function CheckEmailScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = emailParam?.trim() || getSignUpEmail();
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isNavigatingRef = useRef(false);

  const continueAfterVerification = useCallback(
    async (payload?: {
      tokens: { accessToken: string; refreshToken: string };
      user: Parameters<typeof saveSession>[1];
    }) => {
      if (isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;

      try {
        if (payload) {
          await saveSession(payload.tokens, payload.user);
        } else {
          const pendingSessionToken = await getPendingSessionToken();

          if (!pendingSessionToken) {
            throw new Error('Missing pending session');
          }

          const session = await resumeVerifiedSession(pendingSessionToken);
          await saveSession(session.tokens, session.user);
        }

        void registerForPushNotifications();

        router.replace('/your-name');
      } catch (continueError) {
        isNavigatingRef.current = false;
        setError(getErrorMessage(continueError, 'Unable to continue after verification'));
      }
    },
    [router],
  );

  const handleVerified = useCallback(
    async (payload: {
      tokens: { accessToken: string; refreshToken: string };
      user: Parameters<typeof saveSession>[1];
    }) => {
      await continueAfterVerification(payload);
    },
    [continueAfterVerification],
  );

  useAuthSocket({
    enabled: Boolean(email),
    onEmailVerified: handleVerified,
  });

  useEffect(() => {
    if (!email) {
      return;
    }

    let active = true;

    async function pollVerificationStatus() {
      if (isNavigatingRef.current) {
        return;
      }

      try {
        const status = await getVerificationStatus(email);

        if (status.emailVerified && active) {
          await continueAfterVerification();
        }
      } catch {
        // Ignore polling errors; user can tap Continue manually.
      }
    }

    void pollVerificationStatus();
    const intervalId = setInterval(() => {
      void pollVerificationStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [continueAfterVerification, email]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleContinuePress() {
    if (!email) {
      return;
    }

    setError('');
    setIsChecking(true);

    try {
      const status = await getVerificationStatus(email);

      if (status.emailVerified) {
        await continueAfterVerification();
        return;
      }

      setError('Please verify your email using the link we sent before continuing.');
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Unable to check verification status'));
    } finally {
      setIsChecking(false);
    }
  }

  async function handleResendPress() {
    if (!email || isResending) {
      return;
    }

    setError('');
    setInfo('');
    setIsResending(true);

    try {
      await resendVerificationEmail(email);
      setInfo('A new verification email has been sent.');
    } catch (resendError) {
      setError(getErrorMessage(resendError, 'Unable to resend verification email'));
    } finally {
      setIsResending(false);
    }
  }

  function handleWrongEmailPress() {
    router.back();
  }

  return (
    <View style={authStyles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={authStyles.container}>
        <ScreenBackRow fallbackHref="/sign-up" variant="light" />

        <View style={authStyles.checkEmailContent}>
          <AuthSuccessIcon />

          <Text style={authStyles.checkEmailHeading}>Please check your email</Text>

          <Text style={authStyles.checkEmailSubtext}>We just sent a link to</Text>

          <Text style={authStyles.checkEmailAddress}>{email || 'your email'}</Text>

          <Text style={authStyles.checkEmailHint}>
            Tap the link in your email to verify your address. This screen will update automatically
            once verified.
          </Text>

          {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
          {info ? <Text style={authStyles.infoText}>{info}</Text> : null}

          <BrandButton
            label={isChecking ? 'Checking…' : 'Continue'}
            onPress={handleContinuePress}
            disabled={isChecking}
            style={authStyles.checkEmailContinueButton}
          />

          <Pressable onPress={handleResendPress} disabled={isResending}>
            <Text style={authStyles.checkEmailFooterLink}>
              {isResending ? 'Sending…' : 'Resend verification email'}
            </Text>
          </Pressable>

          {isChecking || isResending ? <ActivityIndicator color={colors.brand} /> : null}
        </View>

        <Pressable
          onPress={handleWrongEmailPress}
          style={authStyles.checkEmailFooterLinkWrap}
          accessibilityRole="link"
        >
          <Text style={authStyles.checkEmailFooterLink}>Wrong email address?</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
