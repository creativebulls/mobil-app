import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchNotifications, markNotificationsRead } from '../src/api/notificationsApi';
import type { AppNotification } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { useNotifications } from '../src/notifications/NotificationsProvider';
import { colors } from '../src/theme/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const { setUnreadCount, refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      setNotifications(result.notifications);

      if (result.notifications.some((item) => !item.read)) {
        await markNotificationsRead();
        setUnreadCount(0);
        setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      } else {
        await refreshUnreadCount();
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [refreshUnreadCount, setUnreadCount]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeEvent<AppNotification>('notification:new', (notification) => {
    setNotifications((current) =>
      current.some((item) => item.id === notification.id) ? current : [notification, ...current],
    );
  });

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function handlePress(notification: AppNotification) {
    if (notification.postId) {
      router.push({ pathname: '/comments', params: { postId: notification.postId } });
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={40} color={colors.labelGray} />
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySubtitle}>
                  Likes and comments on your posts will show up here.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.row,
                  !item.read && styles.rowUnread,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.avatarWrap}>
                  <Avatar uri={item.actor?.avatarUri} name={item.actor?.name} size={46} />
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          item.type === 'like' || item.type === 'comment_like'
                            ? colors.brand
                            : colors.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        item.type === 'like' || item.type === 'comment_like' ? 'heart' : 'chatbubble'
                      }
                      size={11}
                      color={colors.white}
                    />
                  </View>
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.message}>{item.message}</Text>
                  {item.preview ? (
                    <Text style={styles.preview} numberOfLines={2}>
                      “{item.preview}”
                    </Text>
                  ) : null}
                  <Text style={styles.time}>{item.timeAgo}</Text>
                </View>

                {!item.read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    paddingVertical: 32,
  },
  list: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  rowUnread: {
    backgroundColor: '#FFF5F5',
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatarWrap: {
    position: 'relative',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  message: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  preview: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
});
