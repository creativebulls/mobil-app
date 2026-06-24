import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { recordParentalConsent } from '../src/api/authApi';
import { AppImage } from '../src/components/AppImage';
import { getErrorMessage } from '../src/api/types';
import { BrandButton } from '../src/components/BrandButton';
import { ConsentCheckbox } from '../src/components/ConsentCheckbox';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { updateStoredUser } from '../src/storage/authSession';
import {
  getSignUpProfilePhoto,
  setSignUpParentalConsent,
} from '../src/storage/signUpDraft';
import { colors } from '../src/theme/colors';

const PROFILE_PHOTO_SIZE = 88;

export default function ParentalConsentScreen() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const profilePhotoUri = getSignUpProfilePhoto();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleNext() {
    if (!consent || isSubmitting) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const user = await recordParentalConsent();
      await updateStoredUser(user);
      setSignUpParentalConsent(true);

      router.replace({
        pathname: '/registration-details',
        params: { resumeAt: 'review' },
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to record parental consent'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/registration-details" variant="light" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>Regarding to your age</Text>

          <View style={styles.photoWrap}>
            <View style={styles.photoCircle}>
              {profilePhotoUri ? (
                <AppImage
                  source={{ uri: profilePhotoUri }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={40} color={colors.labelGray} />
              )}
            </View>
          </View>

          <Text style={styles.bodyText}>
            Due to our rules the creation of account for people under the age of 16 are not
            allowed.
          </Text>
          <Text style={styles.bodyTextBrand}>People under the age of 16 are not allowed.</Text>

          <Text style={styles.bodyText}>
            If you still want to create your account you&apos;ll need the consent of your parents.
          </Text>

          <ConsentCheckbox
            checked={consent}
            onToggle={() => setConsent((prev) => !prev)}
            label="I have consent of my parents to create Crave account"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BrandButton
            label={isSubmitting ? 'Saving…' : 'Next'}
            onPress={handleNext}
            disabled={!consent || isSubmitting}
            style={styles.nextButton}
          />

          {isSubmitting ? <ActivityIndicator color={colors.brand} /> : null}
        </ScrollView>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    lineHeight: 32,
  },
  photoWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },
  photoCircle: {
    width: PROFILE_PHOTO_SIZE,
    height: PROFILE_PHOTO_SIZE,
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bodyTextBrand: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.brand,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  nextButton: {
    marginTop: 8,
  },
});
