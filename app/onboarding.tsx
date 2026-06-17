import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { OnboardingSlider } from '../src/components/OnboardingSlider';
import { GradientBackground } from '../src/components/GradientBackground';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { isOnboardingCompleted, markOnboardingCompleted } from '../src/storage/onboarding';
import { colors } from '../src/theme/colors';

export default function OnboardingScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/welcome');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    async function checkOnboardingStatus() {
      const completed = await isOnboardingCompleted();
      if (completed) {
        router.replace('/sign-in');
        return;
      }
      setIsChecking(false);
    }

    checkOnboardingStatus();
  }, [router]);

  async function handleAdvance() {
    await markOnboardingCompleted();
  }

  async function handleComplete() {
    await markOnboardingCompleted();
    router.replace('/sign-in');
  }

  if (isChecking) {
    return (
      <GradientBackground variant="screen">
        <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.loadingContainer}>
          <ScreenBackRow fallbackHref="/welcome" />
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        </ScreenSafeArea>
      </GradientBackground>
    );
  }

  return <OnboardingSlider onAdvance={handleAdvance} onComplete={handleComplete} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
