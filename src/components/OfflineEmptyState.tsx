import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type OfflineEmptyStateProps = {
  onRetry?: () => void;
  title?: string;
  message?: string;
};

/**
 * Full-screen placeholder shown when a page has no cached/offline data and the
 * device can't reach the network. Mirrors the "you're offline" empty states used
 * by most social apps.
 */
export function OfflineEmptyState({
  onRetry,
  title = "You're offline",
  message = 'This page needs an internet connection. Reconnect and try again to see the latest.',
}: OfflineEmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputGray,
    marginBottom: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: colors.brand,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
});
