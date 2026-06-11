import { useCallback, useRef } from 'react';
import { Animated } from 'react-native';

import { colors } from '../theme/colors';

const FOCUS_DURATION = 220;

export function useInputFocusAnimation(variant: 'gradient' | 'light' = 'gradient') {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const setFocused = useCallback(
    (focused: boolean) => {
      Animated.timing(focusAnim, {
        toValue: focused ? 1 : 0,
        duration: FOCUS_DURATION,
        useNativeDriver: false,
      }).start();
    },
    [focusAnim],
  );

  const isLight = variant === 'light';

  const containerStyle = {
    borderColor: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight
        ? [colors.inputGray, colors.inputFocus]
        : ['rgba(255, 255, 255, 0.4)', colors.primary],
    }),
    backgroundColor: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight
        ? [colors.inputGray, colors.inputGray]
        : [colors.inputBackground, '#FFFFFF'],
    }),
    borderWidth: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight ? [1, 1.5] : [1.5, 2.5],
    }),
    shadowColor: isLight ? 'transparent' : colors.primaryDark,
    shadowOffset: { width: 0, height: isLight ? 0 : 4 },
    shadowOpacity: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight ? [0, 0] : [0, 0.3],
    }),
    shadowRadius: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight ? [0, 0] : [0, 8],
    }),
    elevation: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight ? [0, 0] : [0, 5],
    }),
  };

  const labelStyle = {
    color: focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: isLight
        ? [colors.labelGray, colors.inputFocus]
        : ['rgba(255, 255, 255, 0.85)', colors.white],
    }),
    transform: [
      {
        translateX: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 4],
        }),
      },
    ],
  };

  const inputStyle = isLight
    ? {
        color: focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.labelGray, colors.inputFocus],
        }),
      }
    : undefined;

  return { setFocused, containerStyle, labelStyle, inputStyle };
}
