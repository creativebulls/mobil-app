import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlossyButton } from '../src/components/GlossyButton';
import { ScreenBackRow } from '../src/components/ScreenBackRow';
import { useAppText } from '../src/config/ConfigProvider';
import { markWelcomeCompleted } from '../src/storage/welcome';
import { colors } from '../src/theme/colors';

const NEW_USER_BUTTON_COLOR = colors.brand;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AUTO_ADVANCE_MS = 3800;

const SLIDES = [
  { image: require('../assets/welcome.jpg'), text: 'Discover new places' },
  { image: require('../assets/welcome-2.jpg'), text: 'Meet new friends' },
  { image: require('../assets/welcome-3.png'), text: 'Explore new spots' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const newUserLabel = useAppText('welcome.new_user_button');
  const existingAccountLabel = useAppText('welcome.existing_account_button');

  const listRef = useRef<Animated.FlatList<(typeof SLIDES)[number]>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const captionOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Auto-advance through the slides; loops back to the first.
  useEffect(() => {
    const interval = setInterval(() => {
      const next = (activeIndexRef.current + 1) % SLIDES.length;
      listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(interval);
  }, []);

  // Cross-fade the caption whenever the active slide changes.
  useEffect(() => {
    captionOpacity.setValue(0);
    Animated.timing(captionOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, captionOpacity]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== activeIndexRef.current) {
      setActiveIndex(index);
    }
  }

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
    } catch {
      // Navigation should still work even if persistence fails.
    }
  }

  return (
    <View style={styles.root}>
      <Animated.FlatList
        ref={listRef}
        style={StyleSheet.absoluteFill}
        data={SLIDES}
        keyExtractor={(item) => item.text}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <ImageBackground source={item.image} style={styles.slide} resizeMode="cover">
            <LinearGradient
              colors={[
                'rgba(0, 0, 0, 0.35)',
                'rgba(0, 0, 0, 0.3)',
                'rgba(0, 0, 0, 0.75)',
                'rgba(0, 0, 0, 0.96)',
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.slideScrim}
            />
          </ImageBackground>
        )}
      />

      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <ScreenBackRow />
      </View>

      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 32 }]}
        pointerEvents="box-none"
      >
        <Animated.Text style={[styles.caption, { opacity: captionOpacity }]}>
          {SLIDES[activeIndex]?.text}
        </Animated.Text>

        <View style={styles.dots}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.text}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.newButton, pressed && styles.buttonPressed]}
            onPress={handleNewUser}
          >
            <Text style={styles.newButtonText}>{newUserLabel}</Text>
          </Pressable>

          <GlossyButton label={existingAccountLabel} onPress={handleExistingAccount} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  slideScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  bottomSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: 32,
    gap: 24,
  },
  caption: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textOnGradient,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 0.2,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dotInactive,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.dotActive,
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
