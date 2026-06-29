import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
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
import { registerAccount } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import {
  AccountTypeSelector,
  type AccountType,
} from '../src/components/AccountTypeSelector';
import { LoginFormField } from '../src/components/LoginFormField';
import {
  meetsPasswordRequirements,
  PasswordRequirements,
} from '../src/components/PasswordRequirements';
import { RegistrationProgress } from '../src/components/RegistrationProgress';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { SocialAuthButton } from '../src/components/SocialAuthButton';
import { TermsConsentRow } from '../src/components/TermsConsentRow';
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
import { savePendingSessionToken, saveSession } from '../src/storage/authSession';
import { setSignUpDraft } from '../src/storage/signUpDraft';
import { colors, isValidHex } from '../src/theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSignUpFormValid(
  email: string,
  password: string,
  confirmPassword: string,
  consent: boolean,
) {
  return (
    EMAIL_PATTERN.test(email.trim()) &&
    meetsPasswordRequirements(password) &&
    password === confirmPassword &&
    consent
  );
}

function parseProgressNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = useAppText('sign_up.title', 'Create your account');
  const subtitle = useAppText('sign_up.subtitle', "Let's get you set up.");
  const progressLabelTemplate = useAppText('sign_up.progress_label', 'Step {step} of {total}');
  const appleLabel = useAppText('sign_up.apple_button', 'Continue with Apple');
  const googleLabel = useAppText('sign_up.google_button', 'Continue with Google');
  const emailLabel = useAppText('sign_up.email_label', 'Email');
  const emailPlaceholder = useAppText('sign_up.email_placeholder', 'Enter your email');
  const passwordLabel = useAppText('sign_up.password_label', 'Password');
  const passwordPlaceholder = useAppText('sign_up.password_placeholder', 'Create a password');
  const confirmPasswordLabel = useAppText('sign_up.confirm_password_label', 'Confirm password');
  const confirmPasswordPlaceholder = useAppText(
    'sign_up.confirm_password_placeholder',
    'Re-enter your password',
  );
  const passwordReqLength = useAppText('sign_up.password_req_length', 'At least 8 characters');
  const passwordReqNumber = useAppText('sign_up.password_req_number', 'Includes a number');
  const passwordReqUppercase = useAppText(
    'sign_up.password_req_uppercase',
    'Includes an uppercase letter',
  );
  const accountTypeLabel = useAppText('sign_up.account_type_label', 'I am');
  const individualLabel = useAppText('sign_up.individual_label', 'Individual');
  const businessLabel = useAppText('sign_up.business_label', 'Business');
  const consentPrefix = useAppText('sign_up.consent_prefix', "I agree to Crave's");
  const consentTerms = useAppText('sign_up.consent_terms', 'Terms of Service');
  const consentConjunction = useAppText('sign_up.consent_conjunction', 'and');
  const consentPrivacy = useAppText('sign_up.consent_privacy', 'Privacy Policy');
  const submitLabel = useAppText('sign_up.submit_button', 'Create account');
  const footerText = useAppText('sign_up.footer_text', 'Already have an account?');
  const loginLabel = useAppText('sign_up.login_link', 'Log in');
  const termsUrl = useAppText('terms_url', 'https://whereabout.app/terms');
  const privacyUrl = useAppText('privacy_url', 'https://whereabout.app/privacy');
  const businessAccountsEnabled =
    useAppText('registration.business_accounts_enabled', 'true') === 'true';
  const progressStep = parseProgressNumber(useAppText('registration.progress_step', '2'), 2);
  const progressTotal = parseProgressNumber(useAppText('registration.progress_total', '4'), 4);
  const progressLabel = progressLabelTemplate
    .replace('{step}', String(progressStep))
    .replace('{total}', String(progressTotal));
  const accentColorRaw = useAppText('splash.get_started_button_color', '#FD4301');
  const accentColor = isValidHex(accentColorRaw) ? accentColorRaw : '#FD4301';
  const socialUnavailable = useAppText(
    'sign_up.social_unavailable',
    'Social sign-up is coming soon. Use email for now.',
  );
  const showAppleAuth = isAppleAuthButtonVisible();
  const showGoogleAuth = isGoogleAuthButtonVisible();
  const showSocialAuth = showAppleAuth || showGoogleAuth;

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmPasswordError =
    confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : '';

  const isFormValid = useMemo(
    () => isSignUpFormValid(email, password, confirmPassword, consent),
    [email, password, confirmPassword, consent],
  );

  useEffect(() => {
    if (!businessAccountsEnabled && accountType === 'business') {
      setAccountType('individual');
    }
  }, [accountType, businessAccountsEnabled]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.replace('/sign-in');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleSignUp() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await registerAccount({
        email: email.trim(),
        password,
        termsConsent: true,
        accountType: businessAccountsEnabled ? accountType : 'individual',
      });

      await savePendingSessionToken(result.pendingSessionToken);

      setSignUpDraft({
        profilePhotoUri: result.user.profilePhotoUrl,
        email: email.trim(),
        password,
      });

      router.push({
        pathname: '/check-email',
        params: { email: email.trim() },
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to create account'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialAuth(provider: 'apple' | 'google') {
    if (isSubmitting) {
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
      routeAfterAuth(router, result.user);
    } catch (submitError) {
      if (!isSocialAuthCancellation(submitError)) {
        setError(getErrorMessage(submitError, 'Unable to sign up'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/sign-in" variant="light" />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <RegistrationProgress
              currentStep={progressStep}
              totalSteps={progressTotal}
              stepLabel={progressLabel}
              accentColor={accentColor}
            />

            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            <View style={styles.form}>
              <LoginFormField
                label={emailLabel}
                value={email}
                onChangeText={setEmail}
                placeholder={emailPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                trailingIcon="mail-outline"
                trailingAccessibilityLabel="Email"
                editable={!isSubmitting}
              />

              <LoginFormField
                label={passwordLabel}
                value={password}
                onChangeText={setPassword}
                placeholder={passwordPlaceholder}
                secureTextEntry={!passwordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                trailingIcon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                onTrailingIconPress={() => setPasswordVisible((visible) => !visible)}
                trailingAccessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                editable={!isSubmitting}
              />

              <PasswordRequirements
                password={password}
                minLengthLabel={passwordReqLength}
                numberLabel={passwordReqNumber}
                uppercaseLabel={passwordReqUppercase}
                accentColor={accentColor}
              />

              <LoginFormField
                label={confirmPasswordLabel}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={confirmPasswordPlaceholder}
                secureTextEntry={!confirmPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={() => void handleSignUp()}
                trailingIcon={confirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                onTrailingIconPress={() => setConfirmPasswordVisible((visible) => !visible)}
                trailingAccessibilityLabel={
                  confirmPasswordVisible ? 'Hide password' : 'Show password'
                }
                editable={!isSubmitting}
              />

              {confirmPasswordError ? (
                <Text style={styles.errorText}>{confirmPasswordError}</Text>
              ) : null}

              {businessAccountsEnabled ? (
                <AccountTypeSelector
                  value={accountType}
                  onChange={setAccountType}
                  label={accountTypeLabel}
                  individualLabel={individualLabel}
                  businessLabel={businessLabel}
                  accentColor={accentColor}
                  disabled={isSubmitting}
                />
              ) : null}

              <TermsConsentRow
                checked={consent}
                onToggle={() => setConsent((prev) => !prev)}
                prefix={consentPrefix}
                termsLabel={consentTerms}
                conjunction={consentConjunction}
                privacyLabel={consentPrivacy}
                termsUrl={termsUrl}
                privacyUrl={privacyUrl}
                accentColor={accentColor}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                onPress={() => void handleSignUp()}
                disabled={!isFormValid || isSubmitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: accentColor, shadowColor: accentColor },
                  !isFormValid && styles.submitButtonDisabled,
                  pressed && isFormValid && !isSubmitting && styles.submitPressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      !isFormValid && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {submitLabel}
                  </Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{footerText} </Text>
                <Pressable onPress={() => router.replace('/sign-in')}>
                  <Text style={[styles.footerLink, { color: accentColor }]}>{loginLabel}</Text>
                </Pressable>
              </View>

              {showSocialAuth ? (
                <View style={styles.socialSection}>
                  {showGoogleAuth ? (
                    <SocialAuthButton
                      provider="google"
                      label={googleLabel}
                      onPress={() => void handleSocialAuth('google')}
                      disabled={isSubmitting}
                    />
                  ) : null}
                  {showAppleAuth ? (
                    <SocialAuthButton
                      provider="apple"
                      label={appleLabel}
                      onPress={() => void handleSocialAuth('apple')}
                      disabled={isSubmitting}
                    />
                  ) : null}
                </View>
              ) : null}
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
    marginBottom: 24,
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
  errorText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: -4,
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
    marginTop: 4,
  },
  footerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
  socialSection: {
    gap: 12,
    marginTop: 8,
  },
});
