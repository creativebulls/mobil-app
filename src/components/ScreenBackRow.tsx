import { Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BackButton } from './BackButton';

type ScreenBackRowProps = {
  onPress?: () => void;
  fallbackHref?: Href;
  variant?: 'gradient' | 'light';
};

export function ScreenBackRow({ onPress, fallbackHref, variant = 'gradient' }: ScreenBackRowProps) {
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  }

  return (
    <View style={styles.backRow}>
      <BackButton onPress={handlePress} variant={variant} />
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
