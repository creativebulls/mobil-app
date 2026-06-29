import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export type PasswordRequirementChecks = {
  minLength: boolean;
  hasNumber: boolean;
  hasUppercase: boolean;
};

export function getPasswordRequirementChecks(password: string): PasswordRequirementChecks {
  return {
    minLength: password.length >= 8,
    hasNumber: /[0-9]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
  };
}

export function meetsPasswordRequirements(password: string): boolean {
  const checks = getPasswordRequirementChecks(password);
  return checks.minLength && checks.hasNumber && checks.hasUppercase;
}

type PasswordRequirementsProps = {
  password: string;
  minLengthLabel: string;
  numberLabel: string;
  uppercaseLabel: string;
  accentColor: string;
};

function RequirementRow({
  met,
  label,
  accentColor,
}: {
  met: boolean;
  label: string;
  accentColor: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={met ? accentColor : colors.labelGray}
      />
      <Text style={[styles.text, met && styles.textMet]}>{label}</Text>
    </View>
  );
}

export function PasswordRequirements({
  password,
  minLengthLabel,
  numberLabel,
  uppercaseLabel,
  accentColor,
}: PasswordRequirementsProps) {
  const checks = getPasswordRequirementChecks(password);

  return (
    <View style={styles.wrap}>
      <RequirementRow met={checks.minLength} label={minLengthLabel} accentColor={accentColor} />
      <RequirementRow met={checks.hasNumber} label={numberLabel} accentColor={accentColor} />
      <RequirementRow met={checks.hasUppercase} label={uppercaseLabel} accentColor={accentColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: -4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    color: colors.labelGray,
    lineHeight: 20,
  },
  textMet: {
    color: colors.textSecondary,
  },
});
