import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export type AccountType = 'individual' | 'business';

type AccountTypeSelectorProps = {
  value: AccountType;
  onChange: (value: AccountType) => void;
  label: string;
  individualLabel: string;
  businessLabel: string;
  accentColor: string;
  disabled?: boolean;
};

export function AccountTypeSelector({
  value,
  onChange,
  label,
  individualLabel,
  businessLabel,
  accentColor,
  disabled = false,
}: AccountTypeSelectorProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {(['individual', 'business'] as const).map((option) => {
          const selected = value === option;
          const optionLabel = option === 'individual' ? individualLabel : businessLabel;

          return (
            <Pressable
              key={option}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.option,
                selected && { borderColor: accentColor, backgroundColor: `${accentColor}12` },
                pressed && !disabled && styles.optionPressed,
                disabled && styles.optionDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && { color: accentColor, fontWeight: '700' }]}>
                {optionLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionPressed: {
    opacity: 0.92,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
