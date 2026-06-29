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

  const isLight = variant === 'light';

  return (
    <Pressable
      style={[styles.button, isLight ? styles.buttonLight : styles.buttonGradient]}
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons
        name="chevron-back"
        size={isLight ? 26 : 28}
        color={isLight ? colors.text : colors.textOnGradient}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginBottom: 16,
  },
  buttonLight: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -4,
  },
  buttonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
