import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import {
  clearNotifications,
  fetchNotifications,
  markNotificationsRead,
} from '../src/api/notificationsApi';
import { acceptFriendRequest, rejectFriendRequest } from '../src/api/profileApi';
import type { AppNotification, NotificationType } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { useNotifications } from '../src/notifications/NotificationsProvider';
import { openUserProfile } from '../src/utils/openUserProfile';
import { getStoredUser } from '../src/storage/authSession';
import { readCache, writeCache } from '../src/storage/offlineCache';
import { colors } from '../src/theme/colors';

function notificationIcon(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'like':
    case 'comment_like':
      return 'heart';
    case 'comment':
    case 'reply':
      return 'chatbubble';
    case 'friend_request':
      return 'person-add';
    case 'friend_request_accepted':
      return 'people';
    default:
      return 'notifications';
  }
}

function notificationBadgeColor(type: NotificationType): string {
  if (type === 'friend_request' || type === 'friend_request_accepted') {
    return colors.primary;
  }
  if (type === 'like' || type === 'comment_like') {
    return colors.brand;
  }
  return colors.primary;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const { setUnreadCount, refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await getStoredUser();
      setCurrentUserId(me?.id ?? null);
      const result = await fetchNotifications();
      setNotifications(result.notifications);

      if (result.notifications.some((item) => !item.read)) {
        await markNotificationsRead();
        setUnreadCount(0);
        const read = result.notifications.map((item) => ({ ...item, read: true }));
        setNotifications(read);
        void writeCache('notifications:list', read);
      } else {
        void writeCache('notifications:list', result.notifications);
        await refreshUnreadCount();
      }
    } catch {
      // ignore — keep cached/in-memory notifications
    } finally {
      setIsLoading(false);
    }
  }, [refreshUnreadCount, setUnreadCount]);

  useEffect(() => {
    // Show the last cached notifications instantly (and while offline).
    void readCache<AppNotification[]>('notifications:list').then((cached) => {
      if (cached && cached.data.length > 0) {
        setNotifications((current) => (current.length > 0 ? current : cached.data));
        setIsLoading(false);
      }
    });
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

  async function handleClearAll() {
    const confirmed = await dialog.confirm({
      title: 'Clear all notifications?',
      message: 'This removes all of your notifications.',
      confirmText: 'Clear all',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    setNotifications([]);
    setUnreadCount(0);
    try {
      await clearNotifications();
    } catch {
      void load();
    }
  }

  function handlePress(notification: AppNotification) {
    if (notification.type === 'friend_request') {
      // Pending requests are actioned via the buttons; resolved ones open the profile.
      const resolved =
        notification.friendRequestStatus === 'accepted' ||
        notification.friendRequestStatus === 'rejected';
      if (resolved && notification.actor?.id) {
        openUserProfile(router, notification.actor.id, currentUserId);
      }
      return;
    }

    if (notification.type === 'friend_request_accepted') {
      if (notification.actor?.id) {
        openUserProfile(router, notification.actor.id, currentUserId);
      }
      return;
    }

    // Post-related notifications (like / comment / reply / comment_like) deep-link
    // straight to the post, highlighting the relevant comment when available.
    if (notification.postId) {
      router.push({
        pathname: '/comments',
        params: {
          postId: notification.postId,
          ...(notification.commentId ? { highlightCommentId: notification.commentId } : {}),
        },
      });
      return;
    }

    if (notification.actor?.id) {
      openUserProfile(router, notification.actor.id, currentUserId);
    }
  }

  function handleActorPress(notification: AppNotification) {
    if (notification.actor?.id) {
      openUserProfile(router, notification.actor.id, currentUserId);
    }
  }

  async function handleAcceptFriend(notification: AppNotification) {
    if (!notification.friendRequestId) {
      return;
    }
    setActingOnId(notification.id);
    try {
      await acceptFriendRequest(notification.friendRequestId);
      const name = notification.actor?.name ?? 'them';
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                friendRequestStatus: 'accepted',
                message: `You and ${name} are now friends`,
              }
            : item,
        ),
      );
    } finally {
      setActingOnId(null);
    }
  }

  async function handleRejectFriend(notification: AppNotification) {
    if (!notification.friendRequestId) {
      return;
    }
    setActingOnId(notification.id);
    try {
      await rejectFriendRequest(notification.friendRequestId);
      const name = notification.actor?.name ?? 'them';
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                friendRequestStatus: 'rejected',
                message: `You declined ${name}'s friend request`,
              }
            : item,
        ),
      );
    } finally {
      setActingOnId(null);
    }
  }

  return (
    <StackScreenLayout>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          {notifications.length > 0 ? (
            <Pressable
              onPress={() => void handleClearAll()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              <Text style={styles.clearAll}>Clear</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
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
                  Likes, comments, and friend requests will show up here.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => [
                  styles.row,
                  !item.read && styles.rowUnread,
                  pressed &&
                    !(item.type === 'friend_request' && item.friendRequestStatus === 'pending') &&
                    styles.rowPressed,
                ]}
              >
                <View style={styles.avatarWrap}>
                  <Pressable onPress={() => handleActorPress(item)}>
                    <Avatar uri={item.actor?.avatarUri} name={item.actor?.name} size={46} />
                  </Pressable>
                  <View
                    style={[styles.typeBadge, { backgroundColor: notificationBadgeColor(item.type) }]}
                  >
                    <Ionicons name={notificationIcon(item.type)} size={11} color={colors.white} />
                  </View>
                </View>

                <View style={styles.rowText}>
                  <Text style={[styles.message, !item.read && styles.messageUnread]}>{item.message}</Text>
                  {item.preview ? (
                    <View style={styles.previewBubble}>
                      <Text style={styles.preview} numberOfLines={2}>
                        {item.preview}
                      </Text>
                    </View>
                  ) : null}
                  {item.type === 'friend_request' &&
                  item.friendRequestId &&
                  item.friendRequestStatus !== 'accepted' &&
                  item.friendRequestStatus !== 'rejected' ? (
                    <View style={styles.friendActions}>
                      <Pressable
                        onPress={() => void handleAcceptFriend(item)}
                        disabled={actingOnId === item.id}
                        style={({ pressed }) => [styles.acceptBtn, pressed && styles.rowPressed]}
                      >
                        <Text style={styles.acceptBtnText}>
                          {actingOnId === item.id ? '…' : 'Accept'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleRejectFriend(item)}
                        disabled={actingOnId === item.id}
                        style={({ pressed }) => [styles.declineBtn, pressed && styles.rowPressed]}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text style={styles.time}>{item.timeAgo}</Text>
                </View>

                {!item.read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            )}
          />
        )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  clearAll: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
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
    lineHeight: 20,
    color: colors.textSecondary,
  },
  messageUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  previewBubble: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.inputGray,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  declineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineBtnText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
});
