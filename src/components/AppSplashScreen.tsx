import { LayoutChangeEvent, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AppImage } from './AppImage';
import { colors } from '../theme/colors';

type AppSplashScreenProps = {
  onLayout?: (event: LayoutChangeEvent) => void;
};

// Black wordmark (with teal dot) reads on the white light-theme background;
// the white wordmark is used on the dark-theme background.
const LIGHT_LOGO = require('../../assets/app-icons/crave-black.png');
const DARK_LOGO = require('../../assets/app-icons/crave-full.png');

export function AppSplashScreen({ onLayout }: AppSplashScreenProps) {
  const isDark = useColorScheme() === 'dark';

  const backgroundColor = isDark ? '#000000' : colors.white;
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const logo = isDark ? DARK_LOGO : LIGHT_LOGO;

  return (
    <View style={[styles.container, { backgroundColor }]} onLayout={onLayout}>
      <View style={styles.content}>
        <AppImage
          source={logo}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="CRAVE logo"
        />
        <Text style={[styles.subtitle, { color: textColor }]}>where people come together</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 300,
    aspectRatio: 590 / 167,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
    paddingHorizontal: 32,
  },
});
