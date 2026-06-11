import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { gradients } from '../theme/colors';

type GradientBackgroundProps = {
  children: ReactNode;
  variant?: keyof typeof gradients;
  style?: StyleProp<ViewStyle>;
};

export function GradientBackground({
  children,
  variant = 'screen',
  style,
}: GradientBackgroundProps) {
  const gradient = gradients[variant];

  return (
    <LinearGradient
      colors={[...gradient.colors]}
      start={gradient.start}
      end={gradient.end}
      style={[styles.container, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
