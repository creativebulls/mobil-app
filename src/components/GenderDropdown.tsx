import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useInputFocusAnimation } from '../hooks/useInputFocusAnimation';
import { colors } from '../theme/colors';

export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;

type GenderDropdownProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'gradient' | 'light';
};

export function GenderDropdown({
  value,
  onChange,
  placeholder = 'Select gender',
  variant = 'gradient',
}: GenderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { setFocused, containerStyle } = useInputFocusAnimation(variant);
  const isLight = variant === 'light';

  useEffect(() => {
    setFocused(isOpen || Boolean(value));
  }, [isOpen, value, setFocused]);

  function handleSelect(option: string) {
    onChange(option);
    setIsOpen(false);
  }

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)}>
        <Animated.View style={[styles.trigger, isLight && styles.triggerLight, containerStyle]}>
          <Text style={[styles.triggerText, isLight && styles.triggerTextLight, !value && styles.placeholder]}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Gender</Text>
            <ScrollView bounces={false}>
              {GENDER_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.option, value === option && styles.optionSelected]}
                  onPress={() => handleSelect(option)}
                >
                  <Text
                    style={[styles.optionText, value === option && styles.optionTextSelected]}
                  >
                    {option}
                  </Text>
                  {value === option ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  triggerLight: {
    borderRadius: 8,
  },
  triggerText: {
    fontSize: 16,
    color: colors.text,
  },
  triggerTextLight: {
    color: colors.labelGray,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '50%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: '#FDEEEE',
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: colors.brand,
  },
});
