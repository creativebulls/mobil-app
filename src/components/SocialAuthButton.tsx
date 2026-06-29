import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type SocialAuthProvider = 'apple' | 'google';

type SocialAuthButtonProps = {
  provider: SocialAuthProvider;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

const PROVIDER_ICON: Record<SocialAuthProvider, keyof typeof Ionicons.glyphMap> = {
  apple: 'logo-apple',
  google: 'logo-google',
};

export function SocialAuthButton({ provider, label, onPress, disabled = false }: SocialAuthButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name={PROVIDER_ICON[provider]} size={20} color={colors.text} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 22,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
