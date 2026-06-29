import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type RegistrationProgressProps = {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
  accentColor: string;
};

export function RegistrationProgress({
  currentStep,
  totalSteps,
  stepLabel,
  accentColor,
}: RegistrationProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {steps.map((step) => (
          <View
            key={step}
            style={[
              styles.dot,
              step === currentStep && [styles.dotActive, { backgroundColor: accentColor }],
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{stepLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedBorder,
  },
  dotActive: {
    width: 28,
    borderRadius: 999,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.labelGray,
  },
});
