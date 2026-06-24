import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ChatMessage } from '../api/types';
import { NotificationAvatarWithBadge } from '../components/NotificationAvatarWithBadge';
import { getStoredUser } from '../storage/authSession';
import { colors } from '../theme/colors';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';

type BannerKind = 'message' | 'activity';

type Banner = {
  key: string;
  kind: BannerKind;
  title: string;
  body: string;
  avatarUri: string | null;
  avatarName: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type IncomingNotification = {
  type?: string;
  message?: string;
  preview?: string | null;
  postId?: string | null;
  commentId?: string | null;
  actor?: { id?: string; name?: string; avatarUri?: string | null } | null;
};

const VISIBLE_MS = 4500;

/** Human-friendly summary of a chat message for the heads-up banner. */
function describeMessage(message: ChatMessage): string {
  const text = message.text?.trim();
  if (text) {
    return text;
  }
  if (message.media) {
    switch (message.media.mediaType) {
      case 'video':
        return 'Shared a video with you';
      case 'audio':
        return 'Sent you a voice message';
      case 'file':
        return message.media.fileName
          ? `Shared a file with you: ${message.media.fileName}`
          : 'Shared a file with you';
      default:
        return 'Shared a photo with you';
    }
  }
  if (message.sharedPlace) {
    return 'Shared a location with you';
  }
  return 'New message';
}

function activityIcon(type?: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'like':
    case 'comment_like':
      return 'heart';
    case 'comment':
    case 'reply':
      return 'chatbubble-ellipses';
    case 'friend_request':
    case 'friend_request_accepted':
      return 'person-add';
    default:
      return 'notifications';
  }
}

export function InAppNotificationBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const currentUserId = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [banner, setBanner] = useState<Banner | null>(null);
  const translateY = useRef(new Animated.Value(-220)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getStoredUser().then((user) => {
      currentUserId.current = user?.id ?? null;
    });
  }, []);

  const dismiss = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.timing(translateY, {
      toValue: -220,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setBanner(null));
  }, [translateY]);

  const present = useCallback(
    (next: Banner) => {
      setBanner(next);
      translateY.setValue(-220);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = setTimeout(() => dismiss(), VISIBLE_MS);
    },
    [dismiss, translateY],
  );

  useRealtimeEvent<ChatMessage>('message:new', (message) => {
    if (!message || message.senderId === currentUserId.current) {
      return;
    }
    // Don't interrupt the user while they're already in a chat.
    if (pathnameRef.current === '/chat') {
      return;
    }
    present({
      key: message.id,
      kind: 'message',
      title: message.senderName ?? 'New message',
      body: describeMessage(message),
      avatarUri: message.senderAvatar ?? null,
      avatarName: message.senderName ?? '?',
      icon: 'chatbubble-ellipses',
      onPress: () => {
        dismiss();
        router.push({
          pathname: '/chat',
          params: {
            conversationId: message.conversationId,
            userId: message.senderId,
            name: message.senderName ?? '',
            avatarUri: message.senderAvatar ?? '',
          },
        });
      },
    });
  });

  useRealtimeEvent<IncomingNotification>('notification:new', (notification) => {
    if (!notification) {
      return;
    }
    if (pathnameRef.current === '/notifications' || pathnameRef.current === '/comments') {
      return;
    }
    const actorName = notification.actor?.name ?? 'Someone';
    const message = notification.message ?? 'New notification';
    const body = notification.preview ? `${message}: ${notification.preview}` : message;
    present({
      key: `notif-${Date.now()}`,
      kind: 'activity',
      title: actorName,
      body,
      avatarUri: notification.actor?.avatarUri ?? null,
      avatarName: actorName,
      icon: activityIcon(notification.type),
      onPress: () => {
        dismiss();
        if (notification.postId) {
          router.push({
            pathname: '/comments',
            params: {
              postId: notification.postId,
              ...(notification.commentId ? { highlightCommentId: notification.commentId } : {}),
            },
          });
        } else {
          router.push('/notifications');
        }
      },
    });
  });

  useEffect(
    () => () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    },
    [],
  );

  if (!banner) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + 8, transform: [{ translateY }] }]}
    >
      <Pressable
        onPress={banner.onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <View style={styles.avatarWrap}>
          <NotificationAvatarWithBadge
            uri={banner.avatarUri}
            name={banner.avatarName}
            size={46}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={18} color={colors.labelGray} />
        </Pressable>
      </Pressable>
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
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#1A1024',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  pressed: {
    opacity: 0.92,
  },
  avatarWrap: {
    width: 50,
    height: 50,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
