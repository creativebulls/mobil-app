import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/colors';

type BackButtonProps = {
  onPress?: () => void;
  variant?: 'gradient' | 'light';
};

export function BackButton({ onPress, variant = 'gradient' }: BackButtonProps) {
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    }
  }

  return (
    <Pressable
      style={[styles.button, variant === 'light' && styles.buttonLight]}
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons
        name="chevron-back"
        size={28}
        color={variant === 'light' ? colors.text : colors.textOnGradient}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
});
