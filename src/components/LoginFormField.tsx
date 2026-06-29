import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { useInputFocusAnimation } from '../hooks/useInputFocusAnimation';
import { colors } from '../theme/colors';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type LoginFormFieldProps = TextInputProps & {
  label: string;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onTrailingIconPress?: () => void;
  trailingAccessibilityLabel?: string;
};

export function LoginFormField({
  label,
  trailingIcon,
  onTrailingIconPress,
  trailingAccessibilityLabel,
  style,
  onFocus,
  onBlur,
  ...props
}: LoginFormFieldProps) {
  const { setFocused, containerStyle, labelStyle } = useInputFocusAnimation('light');
  const inputRef = useRef<TextInput>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.field}>
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
      <Pressable onPress={focusInput}>
        <Animated.View style={[styles.inputWrap, containerStyle]}>
          <AnimatedTextInput
            ref={inputRef}
            {...props}
            style={[styles.input, style]}
            placeholderTextColor={colors.labelGray}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
          />
          {trailingIcon ? (
            onTrailingIconPress ? (
              <Pressable
                onPress={onTrailingIconPress}
                hitSlop={8}
                style={styles.trailingIcon}
                accessibilityRole="button"
                accessibilityLabel={trailingAccessibilityLabel}
              >
                <Ionicons name={trailingIcon} size={20} color={colors.labelGray} />
              </Pressable>
            ) : (
              <View style={styles.trailingIcon} accessibilityLabel={trailingAccessibilityLabel}>
                <Ionicons name={trailingIcon} size={20} color={colors.labelGray} />
              </View>
            )
          ) : null}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 52,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
  },
  trailingIcon: {
    padding: 4,
  },
});
