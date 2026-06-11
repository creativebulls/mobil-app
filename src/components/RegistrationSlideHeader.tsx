import { StyleSheet, Text, View } from 'react-native';

import { RegistrationSlideInfo } from '../constants/registration';
import { colors } from '../theme/colors';

type RegistrationSlideHeaderProps = {
  slide: RegistrationSlideInfo;
  variant?: 'gradient' | 'light';
};

export function RegistrationSlideHeader({
  slide,
  variant = 'light',
}: RegistrationSlideHeaderProps) {
  const isLight = variant === 'light';

  return (
    <View style={styles.container}>
      {slide.stepLabel ? (
        <Text style={[styles.badge, isLight && styles.badgeLight]}>{slide.stepLabel}</Text>
      ) : null}
      <Text style={[styles.title, isLight && styles.titleLight]}>{slide.title}</Text>
      {slide.subtitle ? (
        <Text style={[styles.subtitle, isLight && styles.subtitleLight]}>{slide.subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    paddingHorizontal: 4,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    color: colors.textOnGradient,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeLight: {
    backgroundColor: colors.inputGray,
    color: colors.brand,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textOnGradient,
    lineHeight: 34,
  },
  titleLight: {
    fontSize: 24,
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
  },
  subtitleLight: {
    color: colors.textSecondary,
  },
});
