import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

type GlossyButtonProps = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
};

export function GlossyButton({ label, onPress, style }: GlossyButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.white,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  label: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
