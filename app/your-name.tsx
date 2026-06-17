import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { updateStoredUser } from '../src/storage/authSession';
import { setSignUpName } from '../src/storage/signUpDraft';
import { authStyles } from '../src/theme/authStyles';
import { colors } from '../src/theme/colors';

function isNameFormValid(surname: string, name: string) {
  return surname.trim().length > 0 && name.trim().length > 0;
}

export default function YourNameScreen() {
  const router = useRouter();
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFormValid = useMemo(() => isNameFormValid(surname, name), [surname, name]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
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
      const user = await updateProfileNames(name.trim(), surname.trim());
      await updateStoredUser(user);

      setSignUpName({
        surname: surname.trim(),
        name: name.trim(),
      });

      router.push('/registration-details');
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to save your name'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/check-email" variant="light" />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>What&apos;s Your name?</Text>

            <View style={authStyles.form}>
              <AnimatedFormInput
                variant="light"
                label="Surname"
                autoCapitalize="words"
                autoCorrect={false}
                value={surname}
                onChangeText={setSurname}
              />

              <AnimatedFormInput
                variant="light"
                label="Name"
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={setName}
              />

              {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

              <BrandButton
                label={isSubmitting ? 'Saving…' : 'Next'}
                onPress={handleNext}
                disabled={!isFormValid || isSubmitting}
              />

              {isSubmitting ? <ActivityIndicator color={colors.brand} /> : null}
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
    paddingTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 28,
  },
});
