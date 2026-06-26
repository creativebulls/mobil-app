import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotifications } from '../notifications/NotificationsProvider';
import { colors } from '../theme/colors';

type FeedHeaderActionsProps = {
  messagesBadge?: number;
  showMessages?: boolean;
  compact?: boolean;
  /** Which shortcuts to render in this slot. */
  side?: 'left' | 'right' | 'both';
  onNotificationsPress?: () => void;
  onMessagesPress?: () => void;
};

export function FeedHeaderActions({
  messagesBadge = 0,
  showMessages = true,
  compact = false,
  side = 'both',
  onNotificationsPress,
  onMessagesPress,
}: FeedHeaderActionsProps) {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  function handleNotificationsPress() {
    if (onNotificationsPress) {
      onNotificationsPress();
      return;
    }
    router.push('/notifications');
  }

  function handleMessagesPress() {
    if (onMessagesPress) {
      onMessagesPress();
      return;
    }
    router.push('/messages');
  }

  const buttonStyle = compact ? styles.iconButtonCompact : styles.iconButton;

  const showNotifications = side === 'left' || side === 'both';
  const showMessagesButton = showMessages && (side === 'right' || side === 'both');

  return (
    <View style={[styles.row, compact && styles.rowCompact, side !== 'both' && styles.singleSlot]}>
      {showNotifications ? (
        <Pressable
          onPress={handleNotificationsPress}
          style={({ pressed }) => [buttonStyle, pressed && styles.iconButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={compact ? 19 : 20} color={colors.text} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {showMessagesButton ? (
        <Pressable
          onPress={handleMessagesPress}
          style={({ pressed }) => [buttonStyle, pressed && styles.iconButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Messages"
        >
          <Ionicons name="chatbubble-outline" size={compact ? 19 : 20} color={colors.text} />
          {messagesBadge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{messagesBadge > 99 ? '99+' : messagesBadge}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowCompact: {
    gap: 6,
  },
  singleSlot: {
    gap: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
  },
});
