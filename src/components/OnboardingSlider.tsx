import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from './ScreenSafeArea';

import { ONBOARDING_SLIDES, OnboardingSlide } from '../constants/onboarding';
import { ScreenBackRow } from './ScreenBackRow';
import { GradientBackground } from './GradientBackground';
import { GradientButton } from './GradientButton';
import { colors, gradients } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingSliderProps = {
  onAdvance: () => void;
  onComplete: () => void;
};

export function OnboardingSlider({ onAdvance, onComplete }: OnboardingSliderProps) {
  const router = useRouter();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/welcome');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  function handleNextPress() {
    onAdvance();

    if (isLastSlide) {
      onComplete();
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  }

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }

  function renderSlide({ item }: { item: OnboardingSlide }) {
    const illustrationGradient = gradients.illustration;

    return (
      <View style={styles.slide}>
        <LinearGradient
          colors={[...illustrationGradient.colors]}
          start={illustrationGradient.start}
          end={illustrationGradient.end}
          style={styles.illustration}
        >
          <Text style={styles.illustrationText}>{item.id}</Text>
        </LinearGradient>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  }

  return (
    <GradientBackground variant="screen">
      <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
        <ScreenBackRow fallbackHref="/welcome" />
        <FlatList
          ref={flatListRef}
          style={styles.slider}
          contentContainerStyle={styles.sliderContent}
          data={ONBOARDING_SLIDES}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {ONBOARDING_SLIDES.map((slide, index) => (
              <View
                key={slide.id}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>

          <GradientButton
            label={isLastSlide ? 'Get Started' : 'Next'}
            onPress={handleNextPress}
          />
        </View>
      </ScreenSafeArea>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  slider: {
    flex: 1,
  },
  sliderContent: {
    flexGrow: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  illustrationText: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.white,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textOnGradient,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    gap: 24,
  },
  pagination: {
    flexDirection: 'row',
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
});
