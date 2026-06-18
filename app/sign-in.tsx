import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { loginAccount } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import { AnimatedFormInput } from '../src/components/AnimatedFormInput';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { registerForPushNotifications } from '../src/notifications/pushNotifications';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
} from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSignInFormValid(email: string, password: string) {
  return EMAIL_PATTERN.test(email.trim()) && password.length >= 6;
}

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const isFormValid = useMemo(() => isSignInFormValid(email, password), [email, password]);

  // A logged-in user should never see the login screen. If a completed session
  // is still saved, bounce straight to home.
  useEffect(() => {
    let active = true;
    void (async () => {
      const [accessToken, refreshToken, user] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
        getStoredUser(),
      ]);
      if (!active) {
        return;
      }
      if ((accessToken || refreshToken) && user?.suspended) {
        router.replace('/account-suspended');
        return;
      }
      if ((accessToken || refreshToken) && user?.registrationStatus === 'completed') {
        router.replace('/home');
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.replace('/welcome');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleSignIn() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await loginAccount(email.trim(), password);
      await saveSession(result.tokens, result.user);

      if (result.user.suspended) {
        router.replace('/account-suspended');
        return;
      }

      void registerForPushNotifications();

      if (result.user.registrationCompleted) {
        router.replace('/home');
        return;
      }

      if (result.user.givenName && result.user.surname) {
        router.replace('/registration-details');
        return;
      }

      router.replace('/your-name');
    } catch (signInError) {
      setError(getErrorMessage(signInError, 'Unable to sign in'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSignUpPress() {
    router.push('/sign-up');
  }

  function handleResetPasswordPress() {
    router.push('/reset-password');
  }

  function handleFacebookLogin() {
    router.replace('/home');
  }

  if (checkingSession) {
    return (
      <View style={[styles.root, styles.sessionLoader]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <View style={styles.topSection}>
          <ScreenBackRow fallbackHref="/welcome" variant="light" />
          <View style={styles.logoWrap} pointerEvents="none">
            <Image
              source={require('../assets/black-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="WhereAbout logo"
            />
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.form}>
            <AnimatedFormInput
              variant="light"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <AnimatedFormInput
              variant="light"
              label="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Pressable onPress={handleResetPasswordPress} style={styles.forgetPasswordRow}>
              <Text style={styles.forgetPasswordText}>Forget Password</Text>
            </Pressable>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSignIn}
              disabled={!isFormValid || isSubmitting}
              style={({ pressed }) => [
                styles.signInButton,
                isFormValid ? styles.signInButtonActive : styles.signInButtonDisabled,
                pressed && isFormValid && styles.signInButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.signInButtonText,
                  !isFormValid && styles.signInButtonTextDisabled,
                ]}
              >
                Sign In
              </Text>
            </Pressable>

            {isSubmitting ? <ActivityIndicator color={colors.brand} /> : null}

            <Pressable
              style={({ pressed }) => [styles.facebookButton, pressed && styles.facebookButtonPressed]}
              onPress={handleFacebookLogin}
            >
              <Ionicons name="logo-facebook" size={22} color={colors.white} />
              <Text style={styles.facebookButtonText}>Login with Facebook</Text>
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <Pressable onPress={handleSignUpPress}>
                <Text style={styles.footerLink}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScreenSafeArea>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  sessionLoader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topSection: {
    position: 'relative',
    minHeight: 120,
    justifyContent: 'center',
  },
  logoWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  logo: {
    width: 112,
    height: 112,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  form: {
    gap: 20,
  },
  signInButton: {
    marginTop: 4,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonActive: {
    backgroundColor: colors.buttonPurple,
  },
  signInButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  signInButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  signInButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signInButtonTextDisabled: {
    color: colors.labelGray,
  },
  facebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.facebook,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  facebookButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  facebookButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  forgetPasswordRow: {
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  forgetPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.labelGray,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
