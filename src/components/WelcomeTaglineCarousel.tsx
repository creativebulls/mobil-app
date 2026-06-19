import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAppList } from '../config/ConfigProvider';
import { WELCOME_TAGLINES } from '../constants/welcome';
import { colors } from '../theme/colors';

const DISPLAY_DURATION_MS = 3200;
const FADE_DURATION_MS = 350;

export function WelcomeTaglineCarousel() {
  const taglines = useAppList('welcome.taglines', WELCOME_TAGLINES);
  const [activeIndex, setActiveIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  // Keep the latest taglines available to the animation loop without
  // restarting it (the array identity changes when config loads).
  const taglinesRef = useRef(taglines);
  taglinesRef.current = taglines;

  useEffect(() => {
    let cancelled = false;

    function animateToNext() {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: FADE_DURATION_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) {
          return;
        }

        setActiveIndex((current) => (current + 1) % Math.max(1, taglinesRef.current.length));
        translateY.setValue(12);

        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: FADE_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: FADE_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }

    const interval = setInterval(animateToNext, DISPLAY_DURATION_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [opacity, translateY]);

  const safeIndex = taglines.length > 0 ? activeIndex % taglines.length : 0;

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[styles.text, { opacity, transform: [{ translateY }] }]}
        accessibilityLiveRegion="polite"
      >
        {taglines[safeIndex]}
      </Animated.Text>

      <View style={styles.dots}>
        {taglines.map((tagline, index) => (
          <View
            key={tagline}
            style={[styles.dot, index === safeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
    minHeight: 88,
  },
  text: {
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
});
