import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
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

import { fetchConversations } from '../src/api/messagesApi';
import type { ChatMessage, ConversationSummary } from '../src/api/types';
import { FeedHeader } from '../src/components/FeedHeader';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { Avatar } from '../src/components/Avatar';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { usePresence } from '../src/realtime/PresenceProvider';
import { colors } from '../src/theme/colors';

export default function MessagesScreen() {
  const router = useRouter();
  const presence = usePresence();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchConversations();
      setConversations(result.conversations);
      presence.seed(
        result.conversations
          .filter((item) => item.isOnline && item.user?.id)
          .map((item) => item.user!.id),
      );
    } catch {
      // Keep whatever we have; the empty state covers the first-load failure.
    } finally {
      setIsLoading(false);
    }
  }, [presence]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRealtimeEvent<ChatMessage>('message:new', () => {
    void load();
  });
  useRealtimeEvent<{ conversationId: string }>('message:read', () => {
    void load();
  });

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function openConversation(item: ConversationSummary) {
    router.push({
      pathname: '/chat',
      params: {
        conversationId: item.id,
        isGroup: item.isGroup ? '1' : '',
        userId: item.user?.id ?? '',
        name: item.isGroup ? item.name : item.user?.name ?? 'Chat',
        avatarUri: item.avatarUri ?? '',
      },
    });
  }

  return (
    <MainScreenLayout activeTab="messages">
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <FeedHeader title="Messages" onAddPress={() => router.push('/new-group')} />

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : conversations.length === 0 ? (
          <View style={styles.content}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.labelGray} />
            <Text style={styles.title}>No messages yet</Text>
            <Text style={styles.subtitle}>Visit a friend&apos;s profile to start a conversation.</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
            renderItem={({ item }) => {
              const unread = item.unreadCount > 0;
              return (
                <Pressable
                  onPress={() => openConversation(item)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  {item.isGroup ? (
                    <View style={styles.groupGlyph}>
                      <Ionicons name="people" size={26} color={colors.white} />
                    </View>
                  ) : (
                    <Avatar
                      uri={item.user?.avatarUri}
                      name={item.user?.name}
                      size={56}
                      online={presence.isOnline(item.user?.id)}
                    />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.isGroup ? item.name : item.user?.name ?? 'Unknown'}
                      {item.isGroup ? (
                        <Text style={styles.memberCount}> · {item.memberCount}</Text>
                      ) : null}
                    </Text>
                    <Text
                      style={[styles.preview, unread && styles.previewUnread]}
                      numberOfLines={1}
                    >
                      {item.lastMessageMine ? 'You: ' : ''}
                      {item.lastMessage ?? ''}
                    </Text>
                  </View>
                  <View style={styles.rowMeta}>
                    {item.timeAgo ? <Text style={styles.time}>{item.timeAgo}</Text> : null}
                    {unread ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </MainScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loader: {
    marginTop: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  groupGlyph: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.labelGray,
  },
  preview: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  time: {
    fontSize: 12,
    color: colors.labelGray,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
});
