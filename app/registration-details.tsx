import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { completeRegistration } from '../src/api/authApi';
import { getErrorMessage } from '../src/api/types';
import { RegistrationFormData, RegistrationSlider } from '../src/components/RegistrationSlider';
import { clearSignUpDraft } from '../src/storage/signUpDraft';
import { updateStoredUser } from '../src/storage/authSession';

export default function RegistrationDetailsScreen() {
  const router = useRouter();
  const { resumeAt } = useLocalSearchParams<{ resumeAt?: string }>();
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  async function handleSubmit(data: RegistrationFormData) {
    if (!data.birthdate) {
      return;
    }

    setSubmitError('');

    try {
      const user = await completeRegistration({
        firstName: data.firstName,
        lastName: data.lastName,
        birthdate: data.birthdate,
        gender: data.gender,
        termsConsent: true,
        parentalConsent: data.parentalConsent || undefined,
      });

      await updateStoredUser(user);

      clearSignUpDraft();
      router.replace('/home');
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Registration failed'));
    }
  }

  return (
    <RegistrationSlider
      onSubmit={handleSubmit}
      resumeAt={resumeAt === 'review' ? 'review' : undefined}
      externalError={submitError}
    />
  );
}
