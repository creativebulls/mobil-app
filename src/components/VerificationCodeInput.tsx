import { useRef } from 'react';
import {
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

import { useInputFocusAnimation } from '../hooks/useInputFocusAnimation';
import { colors } from '../theme/colors';

const CODE_LENGTH = 6;
const HORIZONTAL_PADDING = 48;
const FORM_PADDING = 48;
const BLOCK_GAP = 10;
const screenWidth = Dimensions.get('window').width;
const availableWidth = screenWidth - HORIZONTAL_PADDING - FORM_PADDING;
const blockSize = Math.floor((availableWidth - BLOCK_GAP * (CODE_LENGTH - 1)) / CODE_LENGTH);

type VerificationCodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  variant?: 'gradient' | 'light';
};

type CodeBlockProps = {
  digit: string;
  index: number;
  blockSize: number;
  variant: 'gradient' | 'light';
  inputRef: (ref: TextInput | null) => void;
  onFocusBox: () => void;
  onChangeText: (text: string) => void;
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
};

function CodeBlock({
  digit,
  index,
  blockSize,
  variant,
  inputRef,
  onFocusBox,
  onChangeText,
  onKeyPress,
}: CodeBlockProps) {
  const { setFocused, containerStyle } = useInputFocusAnimation(variant);
  const isLight = variant === 'light';

  return (
    <Pressable onPress={onFocusBox} style={{ width: blockSize, height: blockSize }}>
      <Animated.View
        style={[
          styles.block,
          isLight && styles.blockLight,
          { width: blockSize, height: blockSize },
          containerStyle,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={digit}
          onChangeText={onChangeText}
          onKeyPress={onKeyPress}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={index === 0 ? CODE_LENGTH : 1}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
        />
        <Text
          style={[
            styles.digitText,
            isLight && styles.digitTextLight,
            digit ? (isLight ? styles.digitTextFilledLight : styles.digitTextFilled) : null,
          ]}
        >
          {digit || ' '}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function VerificationCodeInput({
  value,
  onChange,
  variant = 'gradient',
}: VerificationCodeInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? '');

  function updateCode(nextDigits: string[]) {
    onChange(nextDigits.join('').slice(0, CODE_LENGTH));
  }

  function focusBox(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleChange(text: string, index: number) {
    const sanitized = text.replace(/[^0-9]/g, '');

    if (sanitized.length > 1) {
      const pasted = sanitized.slice(0, CODE_LENGTH);
      const nextDigits = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? '');
      updateCode(nextDigits);

      const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = sanitized;
    updateCode(nextDigits);

    if (sanitized && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) {
    if (event.nativeEvent.key === 'Backspace') {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        updateCode(nextDigits);
        return;
      }

      if (index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        updateCode(nextDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  }

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => (
        <CodeBlock
          key={index}
          digit={digit}
          index={index}
          blockSize={blockSize}
          variant={variant}
          inputRef={(ref) => {
            inputRefs.current[index] = ref;
          }}
          onFocusBox={() => focusBox(index)}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(event) => handleKeyPress(event, index)}
        />
      ))}
    </View>
  );
}

export const VERIFICATION_CODE_LENGTH = CODE_LENGTH;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: BLOCK_GAP,
  },
  block: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockLight: {
    borderRadius: 8,
  },
  input: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
  },
  digitText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  digitTextFilled: {
    color: colors.text,
  },
  digitTextLight: {
    color: colors.labelGray,
  },
  digitTextFilledLight: {
    color: colors.brand,
  },
});
