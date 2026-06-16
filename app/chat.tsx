import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchMessages,
  markConversationRead,
  openConversationWith,
  sendMessage,
} from '../src/api/messagesApi';
import type { ChatMessage } from '../src/api/types';
import { getErrorMessage } from '../src/api/types';
import { useCall } from '../src/calls/CallProvider';
import { Avatar } from '../src/components/Avatar';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { getRealtimeSocket } from '../src/realtime/socket';
import { getStoredUser } from '../src/storage/authSession';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

export default function ChatScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const call = useCall();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    name?: string;
    avatarUri?: string;
  }>();

  const [conversationId, setConversationId] = useState<string | null>(
    params.conversationId || null,
  );
  const [otherUserId, setOtherUserId] = useState<string | null>(params.userId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerName = params.name || 'Chat';
  const headerAvatar = params.avatarUri || null;

  const load = useCallback(async () => {
    try {
      const me = await getStoredUser();
      setCurrentUserId(me?.id ?? null);

      let convId = params.conversationId || null;

      if (!convId && params.userId) {
        const opened = await openConversationWith(params.userId);
        convId = opened.id;
        setOtherUserId(opened.user.id);
      }

      if (!convId) {
        setIsLoading(false);
        return;
      }

      setConversationId(convId);
      const result = await fetchMessages(convId);
      setMessages(result.messages);
      setNextCursor(result.nextCursor);
      if (result.user) {
        setOtherUserId(result.user.id);
      }
      void markConversationRead(convId).catch(() => undefined);
    } catch (error) {
      await dialog.alert({
        title: 'Could not open chat',
        message: getErrorMessage(error, 'Try again later'),
      });
      router.back();
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, params.userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useRealtimeEvent<ChatMessage>('message:new', (incoming) => {
    if (!conversationId || incoming.conversationId !== conversationId) {
      return;
    }
    setMessages((current) => {
      if (current.some((message) => message.id === incoming.id)) {
        return current;
      }
      return [...current, incoming];
    });
    setOtherTyping(false);
    if (incoming.senderId !== currentUserId) {
      void markConversationRead(conversationId).catch(() => undefined);
    }
  });

  useRealtimeEvent<{ conversationId: string | null; userId: string; typing: boolean }>(
    'message:typing',
    (payload) => {
      if (payload.userId === otherUserId) {
        setOtherTyping(payload.typing);
      }
    },
  );

  function emitTyping(typing: boolean) {
    if (!otherUserId) {
      return;
    }
    void getRealtimeSocket().then((socket) => {
      socket?.emit('message:typing', { toUserId: otherUserId, conversationId, typing });
    });
  }

  function handleChangeText(value: string) {
    setDraft(value);
    emitTyping(true);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(() => emitTyping(false), 1500);
  }

  async function handleLoadMore() {
    if (!conversationId || !nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const result = await fetchMessages(conversationId, nextCursor);
      setMessages((current) => [...result.messages, ...current]);
      setNextCursor(result.nextCursor);
    } catch {
      // Silent: pagination failures simply leave older history unloaded.
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || isSending) {
      return;
    }
    setIsSending(true);
    setDraft('');
    emitTyping(false);
    try {
      const result = await sendMessage({
        conversationId: conversationId ?? undefined,
        recipientId: conversationId ? undefined : otherUserId ?? undefined,
        text,
      });
      setConversationId(result.conversationId);
      setMessages((current) =>
        current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message],
      );
    } catch (error) {
      setDraft(text);
      await dialog.alert({
        title: 'Message not sent',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerUser}
            onPress={() => otherUserId && openUserProfile(router, otherUserId, currentUserId)}
          >
            <Avatar uri={headerAvatar} name={headerName} size={34} />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerName}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              otherUserId &&
              call.startCall({
                userId: otherUserId,
                name: headerName,
                avatarUri: headerAvatar,
                conversationId,
              })
            }
            disabled={!otherUserId || call.status !== 'idle'}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voice call"
            style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
          >
            <Ionicons name="call" size={22} color={colors.brand} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : (
            <FlatList
              data={[...messages].reverse()}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              inverted
              renderItem={({ item }) => {
                const mine = item.senderId === currentUserId;
                return (
                  <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                    <View style={styles.bubbleGroup}>
                      {item.sharedPlace ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/place-detail',
                              params: {
                                id: item.sharedPlace!.placeId,
                                name: item.sharedPlace!.name,
                                imageUrl: item.sharedPlace!.imageUrl ?? '',
                              },
                            })
                          }
                          style={({ pressed }) => [styles.placeCard, pressed && styles.pressed]}
                        >
                          {item.sharedPlace.imageUrl ? (
                            <Image source={{ uri: item.sharedPlace.imageUrl }} style={styles.placeImage} />
                          ) : (
                            <View style={[styles.placeImage, styles.placeImagePlaceholder]}>
                              <Ionicons name="location" size={28} color={colors.brand} />
                            </View>
                          )}
                          <View style={styles.placeCardBody}>
                            <Text style={styles.placeCardLabel}>SHARED PLACE</Text>
                            <Text style={styles.placeCardName} numberOfLines={2}>
                              {item.sharedPlace.name}
                            </Text>
                            <View style={styles.placeCardCta}>
                              <Text style={styles.placeCardCtaText}>View place</Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.brand} />
                            </View>
                          </View>
                        </Pressable>
                      ) : null}
                      {item.text ? (
                        <View
                          style={[
                            styles.bubble,
                            mine ? styles.bubbleMine : styles.bubbleTheirs,
                            item.sharedPlace ? styles.bubbleWithCard : null,
                          ]}
                        >
                          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              }}
            />
          )}

          {otherTyping ? <Text style={styles.typing}>{headerName} is typing…</Text> : null}

          <View
            style={[
              styles.inputBar,
              { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) },
            ]}
          >
            <TextInput
              style={styles.input}
              placeholder="Message…"
              placeholderTextColor={colors.labelGray}
              value={draft}
              onChangeText={handleChangeText}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || isSending}
              style={({ pressed }) => [
                styles.sendButton,
                (!draft.trim() || isSending) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="send" size={20} color={colors.white} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  callButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 40,
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubbleGroup: {
    maxWidth: '78%',
    gap: 4,
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  bubbleWithCard: {
    alignSelf: 'stretch',
  },
  placeCard: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  placeImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.inputGray,
  },
  placeImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeCardBody: {
    padding: 12,
    gap: 4,
  },
  placeCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: colors.labelGray,
  },
  placeCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  placeCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  placeCardCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.inputGray,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  typing: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 12,
    color: colors.labelGray,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 21,
    backgroundColor: colors.inputGray,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  pressed: {
    opacity: 0.7,
  },
});
