import { Fragment } from 'react';
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
      <View style={styles.track}>
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <Fragment key={step}>
              <View
                style={[
                  styles.circle,
                  isCompleted && { backgroundColor: accentColor, borderColor: accentColor },
                  isCurrent && { borderColor: accentColor },
                ]}
              />
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    step < currentStep && { backgroundColor: accentColor },
                  ]}
                />
              ) : null}
            </Fragment>
          );
        })}
      </View>
      <Text style={styles.label}>{stepLabel}</Text>
    </View>
  );
}

const CIRCLE_SIZE = 14;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    borderRadius: 1,
    backgroundColor: colors.surfaceMutedBorder,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.labelGray,
  },
});
