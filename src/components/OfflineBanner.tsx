import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '../hooks/useIsOnline';
import { colors } from '../theme/colors';

/**
 * Persistent "You're offline" bar pinned to the top of every screen, mirroring
 * the pattern used by most social apps. Appears whenever an API request fails at
 * the network level and disappears once connectivity is restored.
 */
export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  // Keep the bar mounted briefly after reconnecting so we can animate it out.
  const [mounted, setMounted] = useState<boolean>(!online);
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (!online) {
      setMounted(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(translateY, {
      toValue: -120,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [online, translateY]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { paddingTop: insets.top + 6, transform: [{ translateY }] }]}
    >
      <Animated.View style={styles.bar}>
        <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
        <Text style={styles.text}>You're offline — showing saved content</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 6,
    zIndex: 1100,
    elevation: 1100,
    backgroundColor: colors.text,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
