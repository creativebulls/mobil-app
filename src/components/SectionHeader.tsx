import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type SectionHeaderProps = {
  title: string;
  onViewAllPress?: () => void;
  viewAllLabel?: string;
  accessibilityLabel?: string;
};

export function SectionHeader({
  title,
  onViewAllPress,
  viewAllLabel = 'View all',
  accessibilityLabel = 'View all',
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {title}
      </Text>

      <Pressable
        onPress={onViewAllPress}
        style={({ pressed }) => [styles.viewAllButton, pressed && styles.viewAllButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.viewAllText}>{viewAllLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.brand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  viewAllButtonPressed: {
    opacity: 0.75,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
});
