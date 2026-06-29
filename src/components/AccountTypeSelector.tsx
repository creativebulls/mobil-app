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
  individualDescription: string;
  businessDescription: string;
  accentColor: string;
  disabled?: boolean;
};

export function AccountTypeSelector({
  value,
  onChange,
  label,
  individualLabel,
  businessLabel,
  individualDescription,
  businessDescription,
  accentColor,
  disabled = false,
}: AccountTypeSelectorProps) {
  const options = [
    {
      type: 'individual' as const,
      title: individualLabel,
      description: individualDescription,
      icon: 'person-outline' as const,
    },
    {
      type: 'business' as const,
      title: businessLabel,
      description: businessDescription,
      icon: 'business-outline' as const,
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.list}>
        {options.map((option) => {
          const selected = value === option.type;

          return (
            <Pressable
              key={option.type}
              disabled={disabled}
              onPress={() => onChange(option.type)}
              style={({ pressed }) => [
                styles.option,
                selected && { borderColor: accentColor, backgroundColor: `${accentColor}12` },
                pressed && !disabled && styles.optionPressed,
                disabled && styles.optionDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={[styles.iconWrap, selected && { backgroundColor: `${accentColor}20` }]}>
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={selected ? accentColor : colors.textSecondary}
                />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, selected && { color: accentColor }]}>
                  {option.title}
                </Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <View
                style={[
                  styles.radio,
                  selected && { borderColor: accentColor },
                ]}
              >
                {selected ? <View style={[styles.radioFill, { backgroundColor: accentColor }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  list: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
    padding: 14,
  },
  optionPressed: {
    opacity: 0.92,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.surfaceMutedBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
