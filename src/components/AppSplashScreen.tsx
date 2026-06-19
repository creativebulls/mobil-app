import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import { AppImage } from './AppImage';
import { GradientBackground } from './GradientBackground';
import { colors } from '../theme/colors';

type AppSplashScreenProps = {
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function AppSplashScreen({ onLayout }: AppSplashScreenProps) {
  return (
    <GradientBackground variant="screen">
      <View style={styles.container} onLayout={onLayout}>
        <View style={styles.content}>
          <AppImage
            source={require('../../assets/splash-screen-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="WhereAbout logo"
          />
          <Text style={styles.title}>WhereAbout</Text>
          <Text style={styles.subtitle}>where people come together</Text>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.textOnGradient,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
  },
});
