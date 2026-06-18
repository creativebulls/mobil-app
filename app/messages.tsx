import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchConversations } from '../src/api/messagesApi';
import type { ChatMessage, ConversationSummary } from '../src/api/types';
import { FeedHeader } from '../src/components/FeedHeader';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { Avatar } from '../src/components/Avatar';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { seedPresence } from '../src/realtime/presenceStore';
import { getStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

function messagePreview(message: ChatMessage): string {
  if (message.text?.trim()) {
    return message.text.trim();
  }
  if (message.sharedPlace?.name) {
    return message.sharedPlace.name;
  }
  if (message.media) {
    switch (message.media.mediaType) {
      case 'video':
        return 'Video';
      case 'audio':
        return 'Voice message';
      case 'file':
        return message.media.fileName ?? 'Attachment';
      default:
        return 'Photo';
    }
  }
  return '';
}

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const currentUserIdRef = useRef<string | null>(null);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return conversations;
    }
    return conversations.filter((item) => {
      const name = (item.isGroup ? item.name : item.user?.name ?? '').toLowerCase();
      const lastMessage = (item.lastMessage ?? '').toLowerCase();
      return name.includes(q) || lastMessage.includes(q);
    });
  }, [conversations, search]);

  const load = useCallback(async () => {
    try {
      const [result, me] = await Promise.all([fetchConversations(), getStoredUser()]);
      currentUserIdRef.current = me?.id ?? null;
      setConversations(result.conversations);
      seedPresence(
        result.conversations
          .filter((item) => item.isOnline && item.user?.id)
          .map((item) => item.user!.id),
      );
    } catch {
      // Keep whatever we have; the empty state covers the first-load failure.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRealtimeEvent<ChatMessage>('message:new', (message) => {
    setConversations((current) => {
      const index = current.findIndex((item) => item.id === message.conversationId);
      if (index === -1) {
        void load();
        return current;
      }

      const existing = current[index];
      const mine = message.senderId === currentUserIdRef.current;
      const updated: ConversationSummary = {
        ...existing,
        lastMessage: messagePreview(message),
        lastMessageAt: message.createdAt,
        lastMessageMine: mine,
        timeAgo: message.timeAgo,
        unreadCount: mine ? existing.unreadCount : existing.unreadCount + 1,
      };

      const next = [...current];
      next.splice(index, 1);
      next.unshift(updated);
      return next;
    });
  });

  useRealtimeEvent<{ conversationId: string }>('conversation:updated', () => {
    void load();
  });

  useRealtimeEvent<{ conversationId: string }>('conversation:removed', (payload) => {
    setConversations((current) => current.filter((item) => item.id !== payload.conversationId));
  });

  useRealtimeEvent<{ conversationId: string }>('message:read', (payload) => {
    setConversations((current) =>
      current.map((item) =>
        item.id === payload.conversationId ? { ...item, unreadCount: 0 } : item,
      ),
    );
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
      <View style={styles.container}>
        <FeedHeader title="Messages" onAddPress={() => router.push('/new-group')} />

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.labelGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages"
            placeholderTextColor={colors.labelGray}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.labelGray} />
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : conversations.length === 0 ? (
          <View style={styles.content}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.labelGray} />
            <Text style={styles.title}>No messages yet</Text>
            <Text style={styles.subtitle}>Visit a friend&apos;s profile to start a conversation.</Text>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.content}>
            <Ionicons name="search-outline" size={44} color={colors.labelGray} />
            <Text style={styles.title}>No results</Text>
            <Text style={styles.subtitle}>No chats match &quot;{search.trim()}&quot;.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
                    <Avatar uri={item.avatarUri} name={item.name} size={56} />
                  ) : (
                    <Avatar
                      uri={item.user?.avatarUri}
                      name={item.user?.name}
                      size={56}
                      presenceUserId={item.isGroup ? undefined : item.user?.id}
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
      </View>
    </MainScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
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
