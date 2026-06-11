import { Animated, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { useInputFocusAnimation } from '../hooks/useInputFocusAnimation';
import { colors } from '../theme/colors';
import { formStyles } from '../theme/formStyles';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type AnimatedFormInputProps = TextInputProps & {
  label?: string;
  variant?: 'gradient' | 'light';
};

export function AnimatedFormInput({
  label,
  style,
  onFocus,
  onBlur,
  variant = 'gradient',
  placeholder,
  ...props
}: AnimatedFormInputProps) {
  const { setFocused, containerStyle, labelStyle, inputStyle } = useInputFocusAnimation(variant);
  const isLight = variant === 'light';
  const InputComponent = isLight ? AnimatedTextInput : TextInput;

  return (
    <View style={formStyles.field}>
      {label ? (
        <Animated.Text
          style={[isLight ? formStyles.labelLight : formStyles.label, labelStyle]}
        >
          {label}
        </Animated.Text>
      ) : null}
      <Animated.View style={[styles.container, isLight && styles.containerLight, containerStyle]}>
        <InputComponent
          {...props}
          placeholder={isLight ? undefined : placeholder}
          style={[styles.input, isLight ? inputStyle : null, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  containerLight: {
    borderRadius: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: 'transparent',
  },
});
