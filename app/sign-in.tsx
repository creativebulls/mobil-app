import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { loginAccount } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import { LoginFormField } from '../src/components/LoginFormField';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { SocialAuthButton } from '../src/components/SocialAuthButton';
import { useAppText } from '../src/config/ConfigProvider';
import { routeAfterAuth } from '../src/auth/completeAuthSession';
import {
  canPerformSocialAuth,
  isAppleAuthButtonVisible,
  isGoogleAuthButtonVisible,
  isSocialAuthCancellation,
  signInWithAppleAccount,
  signInWithGoogleAccount,
} from '../src/auth/socialAuth';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
} from '../src/storage/authSession';
import { colors, isValidHex } from '../src/theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s().-]{7,}$/;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

function isValidLoginId(value: string): boolean {
  const trimmed = value.trim();
  if (EMAIL_PATTERN.test(trimmed)) {
    return true;
  }
  const digits = trimmed.replace(/\D/g, '');
  return PHONE_PATTERN.test(trimmed) && digits.length >= 7;
}

function isSignInFormValid(loginId: string, password: string): boolean {
  return isValidLoginId(loginId) && password.length >= 6;
}

export default function SignInScreen() {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const failedAttemptsRef = useRef(0);

  const title = useAppText('sign_in.title', 'Welcome back 👋');
  const subtitle = useAppText('sign_in.subtitle', 'Log in to continue your journey.');
  const appleLabel = useAppText('sign_in.apple_button', 'Continue with Apple');
  const googleLabel = useAppText('sign_in.google_button', 'Continue with Google');
  const dividerLabel = useAppText('sign_in.divider', 'or');
  const loginIdLabel = useAppText('sign_in.login_id_label', 'Email or phone number');
  const loginIdPlaceholder = useAppText(
    'sign_in.login_id_placeholder',
    'Enter your email or phone number',
  );
  const passwordLabel = useAppText('sign_in.password_label', 'Password');
  const passwordPlaceholder = useAppText('sign_in.password_placeholder', 'Enter your password');
  const forgotLabel = useAppText('sign_in.forgot_password', 'Forgot password?');
  const submitLabel = useAppText('sign_in.submit_button', 'Log in');
  const footerText = useAppText('sign_in.footer_text', "Don't have an account?");
  const registerLabel = useAppText('sign_in.register_link', 'Register');
  const accentColorRaw = useAppText('splash.get_started_button_color', '#FD4301');
  const accentColor = isValidHex(accentColorRaw) ? accentColorRaw : '#FD4301';
  const socialUnavailable = useAppText(
    'sign_in.social_unavailable',
    'Social sign-in is coming soon. Use email or phone for now.',
  );
  const showAppleAuth = isAppleAuthButtonVisible();
  const showGoogleAuth = isGoogleAuthButtonVisible();
  const showSocialAuth = showAppleAuth || showGoogleAuth;

  const isLocked = lockUntil !== null && Date.now() < lockUntil;
  const isFormValid = useMemo(() => isSignInFormValid(loginId, password), [loginId, password]);

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

  useEffect(() => {
    if (!lockUntil) {
      return;
    }
    const remaining = lockUntil - Date.now();
    if (remaining <= 0) {
      setLockUntil(null);
      failedAttemptsRef.current = 0;
      return;
    }
    const timer = setTimeout(() => {
      setLockUntil(null);
      failedAttemptsRef.current = 0;
    }, remaining);
    return () => clearTimeout(timer);
  }, [lockUntil]);

  async function completeLogin(email: string, passwordValue: string) {
    const result = await loginAccount(email.trim(), passwordValue);
    await saveSession(result.tokens, result.user);
    failedAttemptsRef.current = 0;
    routeAfterAuth(router, result.user);
  }

  async function handleSignIn() {
    if (!isFormValid || isSubmitting || isLocked) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await completeLogin(loginId, password);
    } catch (signInError) {
      failedAttemptsRef.current += 1;
      if (failedAttemptsRef.current >= MAX_FAILED_ATTEMPTS) {
        setLockUntil(Date.now() + LOCKOUT_MS);
        setError('Too many attempts. Please wait 30 seconds and try again.');
      } else {
        setError(getErrorMessage(signInError, 'Unable to sign in'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialAuth(provider: 'apple' | 'google') {
    if (isSubmitting || isLocked) {
      return;
    }

    if (!canPerformSocialAuth(provider)) {
      setError(socialUnavailable);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result =
        provider === 'apple' ? await signInWithAppleAccount() : await signInWithGoogleAccount();
      await saveSession(result.tokens, result.user);
      failedAttemptsRef.current = 0;
      routeAfterAuth(router, result.user);
    } catch (signInError) {
      if (!isSocialAuthCancellation(signInError)) {
        setError(getErrorMessage(signInError, 'Unable to sign in'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <View style={[styles.root, styles.sessionLoader]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/welcome" variant="light" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.form}>
              {showSocialAuth ? (
                <>
                  {showAppleAuth ? (
                    <SocialAuthButton
                      provider="apple"
                      label={appleLabel}
                      onPress={() => void handleSocialAuth('apple')}
                      disabled={isSubmitting || isLocked}
                    />
                  ) : null}
                  {showGoogleAuth ? (
                    <SocialAuthButton
                      provider="google"
                      label={googleLabel}
                      onPress={() => void handleSocialAuth('google')}
                      disabled={isSubmitting || isLocked}
                    />
                  ) : null}

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{dividerLabel}</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </>
              ) : null}

              <LoginFormField
                label={loginIdLabel}
                value={loginId}
                onChangeText={setLoginId}
                placeholder={loginIdPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="username"
                returnKeyType="next"
                trailingIcon="mail-outline"
                trailingAccessibilityLabel="Email or phone"
                editable={!isSubmitting && !isLocked}
              />

              <LoginFormField
                label={passwordLabel}
                value={password}
                onChangeText={setPassword}
                placeholder={passwordPlaceholder}
                secureTextEntry={!passwordVisible}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={() => void handleSignIn()}
                trailingIcon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                onTrailingIconPress={() => setPasswordVisible((visible) => !visible)}
                trailingAccessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                editable={!isSubmitting && !isLocked}
              />

              <Pressable onPress={() => router.push('/reset-password')} style={styles.forgotRow}>
                <Text style={[styles.forgotText, { color: accentColor }]}>{forgotLabel}</Text>
              </Pressable>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                onPress={() => void handleSignIn()}
                disabled={!isFormValid || isSubmitting || isLocked}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: accentColor, shadowColor: accentColor },
                  (!isFormValid || isLocked) && styles.submitButtonDisabled,
                  pressed && isFormValid && !isSubmitting && !isLocked && styles.submitPressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      (!isFormValid || isLocked) && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {submitLabel}
                  </Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{footerText} </Text>
                <Pressable onPress={() => router.push('/sign-up')}>
                  <Text style={[styles.footerLink, { color: accentColor }]}>{registerLabel}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
  flex: {
    flex: 1,
  },
  sessionLoader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    marginTop: 8,
    marginBottom: 28,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
  },
  form: {
    gap: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceMutedBorder,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.labelGray,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 14,
    minHeight: 52,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  submitButtonTextDisabled: {
    color: colors.labelGray,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  footerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});
