import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
const TOTAL_STEPS = 4;

function isEmailStepValid(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

function isPasswordStepValid(password: string, confirmPassword: string) {
  return meetsPasswordRequirements(password) && password === confirmPassword;
}

export default function SignUpScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const individualLabel = useAppText('registration.individual_label', 'Individual');
  const businessLabel = useAppText('registration.business_label', 'Business');
  const consentPrefix = useAppText('sign_up.consent_prefix', "I agree to Crave's");
  const consentTerms = useAppText('sign_up.consent_terms', 'Terms of Service');
  const consentConjunction = useAppText('sign_up.consent_conjunction', 'and');
  const consentPrivacy = useAppText('sign_up.consent_privacy', 'Privacy Policy');
  const submitLabel = useAppText('sign_up.submit_button', 'Create account');
  const continueLabel = useAppText('sign_up.continue_button', 'Continue');
  const footerText = useAppText('sign_up.footer_text', 'Already have an account?');
  const loginLabel = useAppText('sign_up.login_link', 'Log in');
  const termsUrl = useAppText('terms_url', 'https://whereabout.app/terms');
  const privacyUrl = useAppText('privacy_url', 'https://whereabout.app/privacy');
  const businessAccountsEnabled =
    useAppText('registration.business_accounts_enabled', 'true') === 'true';
  const individualAccountInfo = useAppText(
    'registration.individual_info',
    'For personal use. Discover places, connect with friends, and share your experiences on Crave.',
  );
  const businessAccountInfo = useAppText(
    'registration.business_info',
    'For venues, brands, and teams. Promote your location and reach local customers on Crave.',
  );
  const businessUnavailableMessage = useAppText(
    'registration.business_unavailable_message',
    'Business accounts are not available right now.',
  );

  const stepTitle = useAppText(
    currentStep === 1
      ? 'sign_up.step1.title'
      : currentStep === 2
        ? 'sign_up.step2.title'
        : currentStep === 3
          ? 'sign_up.step3.title'
          : 'sign_up.step4.title',
    currentStep === 1
      ? 'Create your account'
      : currentStep === 2
        ? 'Create a password'
        : currentStep === 3
          ? 'Choose account type'
          : 'Review and accept',
  );
  const stepSubtitle = useAppText(
    currentStep === 1
      ? 'sign_up.step1.subtitle'
      : currentStep === 2
        ? 'sign_up.step2.subtitle'
        : currentStep === 3
          ? 'sign_up.step3.subtitle'
          : 'sign_up.step4.subtitle',
    currentStep === 1
      ? 'Enter your email to get started.'
      : currentStep === 2
        ? 'Choose a secure password for your account.'
        : currentStep === 3
          ? businessAccountsEnabled
            ? 'Are you signing up as an individual or a business?'
            : 'You are creating an individual account.'
          : 'Accept our terms to finish creating your account.',
  );

  const accentColorRaw = useAppText('splash.get_started_button_color', '#FD4301');
  const accentColor = isValidHex(accentColorRaw) ? accentColorRaw : '#FD4301';
  const socialUnavailable = useAppText(
    'sign_up.social_unavailable',
    'Social sign-up is coming soon. Use email for now.',
  );
  const showAppleAuth = isAppleAuthButtonVisible();
  const showGoogleAuth = isGoogleAuthButtonVisible();
  const showSocialAuth = showAppleAuth || showGoogleAuth;

  const progressLabel = progressLabelTemplate
    .replace('{step}', String(currentStep))
    .replace('{total}', String(TOTAL_STEPS));

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmPasswordError =
    confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : '';

  const isCurrentStepValid = useMemo(() => {
    switch (currentStep) {
      case 1:
        return isEmailStepValid(email);
      case 2:
        return isPasswordStepValid(password, confirmPassword);
      case 3:
        return true;
      case 4:
        return consent;
      default:
        return false;
    }
  }, [consent, confirmPassword, currentStep, email, password]);

  useEffect(() => {
    if (!businessAccountsEnabled && accountType === 'business') {
      setAccountType('individual');
    }
  }, [accountType, businessAccountsEnabled]);

  const handleBack = useCallback(() => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/sign-in');
  }, [currentStep, router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);

  function handleContinue() {
    if (!isCurrentStepValid || isSubmitting) {
      return;
    }

    setError('');
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => step + 1);
    }
  }

  async function handleSignUp() {
    if (!isCurrentStepValid || isSubmitting || currentStep !== TOTAL_STEPS) {
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

  const primaryLabel = currentStep === TOTAL_STEPS ? submitLabel : continueLabel;
  const onPrimaryPress = currentStep === TOTAL_STEPS ? handleSignUp : handleContinue;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow onPress={handleBack} variant="light" />

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
              currentStep={currentStep}
              totalSteps={TOTAL_STEPS}
              stepLabel={progressLabel}
              accentColor={accentColor}
            />

            <View style={styles.header}>
              <Text style={styles.title}>{stepTitle}</Text>
              <Text style={styles.subtitle}>{stepSubtitle}</Text>
            </View>

            <View style={styles.form}>
              {currentStep === 1 ? (
                <>
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
                    onSubmitEditing={handleContinue}
                    trailingIcon="mail-outline"
                    trailingAccessibilityLabel="Email"
                    editable={!isSubmitting}
                  />

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

                  <View style={styles.footer}>
                    <Text style={styles.footerText}>{footerText} </Text>
                    <Pressable onPress={() => router.replace('/sign-in')}>
                      <Text style={[styles.footerLink, { color: accentColor }]}>{loginLabel}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
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
                    onSubmitEditing={handleContinue}
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
                </>
              ) : null}

              {currentStep === 3 ? (
                businessAccountsEnabled ? (
                  <AccountTypeSelector
                    value={accountType}
                    onChange={setAccountType}
                    label={accountTypeLabel}
                    individualLabel={individualLabel}
                    businessLabel={businessLabel}
                    individualDescription={individualAccountInfo}
                    businessDescription={businessAccountInfo}
                    accentColor={accentColor}
                    disabled={isSubmitting}
                  />
                ) : (
                  <View style={styles.individualOnlyCard}>
                    <Text style={styles.individualOnlyLabel}>{individualLabel}</Text>
                    <Text style={styles.individualOnlyDescription}>{individualAccountInfo}</Text>
                    <Text style={styles.individualOnlyHint}>{businessUnavailableMessage}</Text>
                  </View>
                )
              ) : null}

              {currentStep === 4 ? (
                <>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Email</Text>
                    <Text style={styles.summaryValue}>{email.trim()}</Text>
                    <Text style={[styles.summaryLabel, styles.summaryLabelSpaced]}>Account type</Text>
                    <Text style={styles.summaryValue}>
                      {accountType === 'business' ? businessLabel : individualLabel}
                    </Text>
                  </View>

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
                </>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                onPress={() => void onPrimaryPress()}
                disabled={!isCurrentStepValid || isSubmitting}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: accentColor, shadowColor: accentColor },
                  !isCurrentStepValid && styles.submitButtonDisabled,
                  pressed && isCurrentStepValid && !isSubmitting && styles.submitPressed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.submitButtonText,
                      !isCurrentStepValid && styles.submitButtonTextDisabled,
                    ]}
                  >
                    {primaryLabel}
                  </Text>
                )}
              </Pressable>
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
  individualOnlyCard: {
    borderWidth: 1,
    borderColor: colors.surfaceMutedBorder,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    backgroundColor: colors.white,
  },
  individualOnlyLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  individualOnlyDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  individualOnlyHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.labelGray,
    marginTop: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.surfaceMutedBorder,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.white,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.labelGray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryLabelSpaced: {
    marginTop: 14,
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
    marginTop: 4,
  },
});
