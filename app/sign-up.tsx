import { Ionicons } from '@expo/vector-icons';
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
import { AnimatedFormInput } from '../src/components/AnimatedFormInput';
import { BrandButton } from '../src/components/BrandButton';
import { ConsentCheckbox } from '../src/components/ConsentCheckbox';
import { ProfilePhotoPicker } from '../src/components/ProfilePhotoPicker';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { savePendingSessionToken } from '../src/storage/authSession';
import { setSignUpDraft } from '../src/storage/signUpDraft';
import { authStyles } from '../src/theme/authStyles';
import { colors } from '../src/theme/colors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isSignUpFormValid(
  email: string,
  password: string,
  repeatPassword: string,
  consent: boolean,
) {
  return (
    EMAIL_PATTERN.test(email.trim()) &&
    password.length >= 6 &&
    password === repeatPassword &&
    consent
  );
}

export default function SignUpScreen() {
  const router = useRouter();
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFormValid = useMemo(
    () => isSignUpFormValid(email, password, repeatPassword, consent),
    [email, password, repeatPassword, consent],
  );

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

  async function handleNext() {
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
        profilePhotoUri,
      });

      await savePendingSessionToken(result.pendingSessionToken);

      setSignUpDraft({
        profilePhotoUri: result.user.profilePhotoUrl ?? profilePhotoUri,
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

  function handleFacebookSignUp() {
    router.replace('/home');
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/welcome" variant="light" />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Create new account</Text>

            <ProfilePhotoPicker value={profilePhotoUri} onChange={setProfilePhotoUri} />

            <View style={authStyles.form}>
              <AnimatedFormInput
                variant="light"
                label="Your email"
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

              <AnimatedFormInput
                variant="light"
                label="Repeat password"
                secureTextEntry
                value={repeatPassword}
                onChangeText={setRepeatPassword}
              />

              <ConsentCheckbox
                checked={consent}
                onToggle={() => setConsent((prev) => !prev)}
                label="I agree to the Terms of Service and consent to data processing"
              />

              {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

              <BrandButton
                label={isSubmitting ? 'Creating account…' : 'Next'}
                onPress={handleNext}
                disabled={!isFormValid || isSubmitting}
              />

              {isSubmitting ? <ActivityIndicator color={colors.brand} /> : null}

              <Pressable
                style={({ pressed }) => [styles.facebookButton, pressed && styles.facebookButtonPressed]}
                onPress={handleFacebookSignUp}
              >
                <Ionicons name="logo-facebook" size={22} color={colors.white} />
                <Text style={styles.facebookButtonText}>Sign up with Facebook</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 24,
    marginTop: 8,
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
});
