import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppImage } from './AppImage';

import { useNotifications } from '../notifications/NotificationsProvider';
import { colors } from '../theme/colors';

type FeedHeaderProps = {
  title?: string;
  onNotificationsPress?: () => void;
  onAddPress?: () => void;
  onCallsPress?: () => void;
  /** Render the title left-aligned beside the logo instead of centered. */
  alignTitleLeft?: boolean;
};

export function FeedHeader({
  title = 'My Feed',
  onNotificationsPress,
  onAddPress,
  onCallsPress,
  alignTitleLeft = false,
}: FeedHeaderProps) {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  function handleNotificationsPress() {
    if (onNotificationsPress) {
      onNotificationsPress();
      return;
    }
    router.push('/notifications');
  }

  function handleAddPress() {
    if (onAddPress) {
      onAddPress();
      return;
    }
    router.push('/create-post');
  }

  return (
    <View style={styles.container}>
      <AppImage
        source={require('../../assets/black-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Crave logo"
      />

      {alignTitleLeft ? (
        <Text style={styles.titleLeft} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <Text style={styles.title} numberOfLines={1} pointerEvents="none">
          {title}
        </Text>
      )}

      <View style={styles.actions}>
        {onCallsPress ? (
          <Pressable
            onPress={onCallsPress}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Call history"
          >
            <Ionicons name="call-outline" size={19} color={colors.text} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleNotificationsPress}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={handleAddPress}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Create post"
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 56,
  },
  logo: {
    width: 32,
    height: 32,
  },
  title: {
    position: 'absolute',
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  titleLeft: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'left',
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    top: 4,
    right: 4,
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
