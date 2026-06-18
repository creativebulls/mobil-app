import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { GlossyButton } from '../src/components/GlossyButton';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { WelcomeTaglineCarousel } from '../src/components/WelcomeTaglineCarousel';
import { markOnboardingCompleted } from '../src/storage/onboarding';
import { markWelcomeCompleted } from '../src/storage/welcome';
import { colors } from '../src/theme/colors';

const NEW_USER_BUTTON_COLOR = '#5E36E1';

export default function WelcomeScreen() {
  const router = useRouter();

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  async function handleNewUser() {
    router.replace('/sign-up');

    try {
      await markWelcomeCompleted();
    } catch {
      // Navigation should still work even if persistence fails.
    }
  }

  async function handleExistingAccount() {
    router.replace('/sign-in');

    try {
      await markWelcomeCompleted();
      await markOnboardingCompleted();
    } catch {
      // Navigation should still work even if persistence fails.
    }
  }

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../assets/welcome.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(148, 71, 179, 0.05)', 'rgba(148, 71, 179, 0.55)', '#9447B3']}
          locations={[0.35, 0.72, 1]}
          style={styles.overlay}
        />

        <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
          <ScreenBackRow />

          <View style={styles.bottomSection}>
            <WelcomeTaglineCarousel />

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.newButton, pressed && styles.buttonPressed]}
                onPress={handleNewUser}
              >
                <Text style={styles.newButtonText}>I&apos;m new to WhereAbout</Text>
              </Pressable>

              <GlossyButton label="I have an account" onPress={handleExistingAccount} />
            </View>
          </View>
        </ScreenSafeArea>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    flex: 1,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 32,
  },
  actions: {
    gap: 16,
  },
  newButton: {
    backgroundColor: NEW_USER_BUTTON_COLOR,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: NEW_USER_BUTTON_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  newButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
});
