import { LinearGradient } from 'expo-linear-gradient';
import {
  ImageBackground,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppList, useAppText } from '../config/ConfigProvider';
import { SPLASH_TAGLINES } from '../constants/splash';
import { BrandButton } from './BrandButton';
import { AppImage } from './AppImage';
import { colors } from '../theme/colors';

const SPLASH_BACKGROUND = require('../../assets/splash.png');
const CRAVE_LOGO = require('../../assets/app-icons/crave-full.png');
const LOGO_WIDTH = 250;

type AppSplashScreenProps = {
  onLayout?: (event: LayoutChangeEvent) => void;
  onGetStarted?: () => void;
  onExploreGuest?: () => void;
};

export function AppSplashScreen({ onLayout, onGetStarted, onExploreGuest }: AppSplashScreenProps) {
  const insets = useSafeAreaInsets();
  const taglines = useAppList('splash.taglines', SPLASH_TAGLINES);
  const getStartedLabel = useAppText('splash.get_started_button', 'Get started');
  const exploreGuestLabel = useAppText('splash.explore_guest_link', 'Explore as guest');

  return (
    <View style={styles.root} onLayout={onLayout}>
      <ImageBackground source={SPLASH_BACKGROUND} style={styles.background} resizeMode="cover">
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.15)', 'rgba(0, 0, 0, 0.2)', 'rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.92)']}
          locations={[0, 0.35, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.logoWrap}>
            <AppImage
              source={CRAVE_LOGO}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Crave logo"
            />
          </View>

          <View style={styles.bottomBlock}>
            <View style={styles.taglines}>
              {taglines.map((line) => (
                <Text key={line} style={styles.tagline}>
                  {line}
                </Text>
              ))}
            </View>

            <BrandButton label={getStartedLabel} onPress={() => onGetStarted?.()} style={styles.ctaButton} />

            <Pressable
              onPress={() => onExploreGuest?.()}
              style={({ pressed }) => [styles.guestLink, pressed && styles.guestLinkPressed]}
              accessibilityRole="link"
            >
              <Text style={styles.guestLinkText}>{exploreGuestLabel}</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: LOGO_WIDTH,
    aspectRatio: 590 / 167,
  },
  bottomBlock: {
    gap: 20,
  },
  taglines: {
    gap: 4,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  ctaButton: {
    marginTop: 0,
    borderRadius: 14,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  guestLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  guestLinkPressed: {
    opacity: 0.75,
  },
  guestLinkText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
