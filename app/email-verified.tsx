import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { resumeVerifiedSession, verifyEmailToken } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import { AuthSuccessIcon } from '../src/components/AuthSuccessIcon';
import { BrandButton } from '../src/components/BrandButton';
import { registerForPushNotifications } from '../src/notifications/pushNotifications';
import { getPendingSessionToken, saveSession } from '../src/storage/authSession';
import { authStyles } from '../src/theme/authStyles';
import { colors } from '../src/theme/colors';

export default function EmailVerifiedScreen() {
  const router = useRouter();
  const { token, verified } = useLocalSearchParams<{ token?: string; verified?: string }>();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const finishVerification = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      if (token) {
        try {
          const result = await verifyEmailToken(token);
          await saveSession(result.tokens, result.user);
          void registerForPushNotifications();
          router.replace('/your-name');
          return;
        } catch {
          // Token may already have been used via the web link.
        }
      }

      const pendingSessionToken = await getPendingSessionToken();

      if (!pendingSessionToken) {
        throw new Error('Missing pending session. Return to the check email screen and tap Continue.');
      }

      const session = await resumeVerifiedSession(pendingSessionToken);
      await saveSession(session.tokens, session.user);
      void registerForPushNotifications();
      router.replace('/your-name');
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, 'Unable to verify email'));
    } finally {
      setIsLoading(false);
    }
  }, [router, token]);

  useEffect(() => {
    void finishVerification();
  }, [finishVerification]);

  const isVerifiedParam = verified === '1';

  return (
    <View style={authStyles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={[authStyles.container, authStyles.checkEmailContent]}>
        {isLoading ? (
          <>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={authStyles.checkEmailSubtext}>
              {isVerifiedParam ? 'Finishing verification…' : 'Verifying your email…'}
            </Text>
          </>
        ) : error ? (
          <>
            <View style={[authStyles.successIconCircle, { backgroundColor: colors.inputGray }]}>
              <Text style={{ fontSize: 36, color: colors.brand }}>!</Text>
            </View>
            <Text style={authStyles.checkEmailHeading}>Verification issue</Text>
            <Text style={authStyles.errorText}>{error}</Text>
            <BrandButton label="Try again" onPress={finishVerification} />
          </>
        ) : (
          <>
            <AuthSuccessIcon />
            <Text style={authStyles.checkEmailHeading}>Email verified</Text>
          </>
        )}
      </ScreenSafeArea>
    </View>
  );
}
