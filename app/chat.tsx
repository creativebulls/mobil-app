import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  sendMediaMessage,
  sendMessage,
  sharePlaceInConversation,
} from '../src/api/messagesApi';
import type { ChatMessage } from '../src/api/types';
import { getErrorMessage } from '../src/api/types';
import { useCall } from '../src/calls/CallProvider';
import { Avatar } from '../src/components/Avatar';
import { ChatMediaBubble, MediaViewerModal, type OpenableMedia } from '../src/components/ChatMedia';
import { PlacePickerModal } from '../src/components/PlacePickerModal';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { usePresence } from '../src/realtime/PresenceProvider';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { getRealtimeSocket } from '../src/realtime/socket';
import { getStoredUser } from '../src/storage/authSession';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

const TICK_READ = '#34B7F1';

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type ChatRow = {
  message: ChatMessage;
  mine: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

export default function ChatScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const call = useCall();
  const presence = usePresence();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    name?: string;
    avatarUri?: string;
    isGroup?: string;
  }>();

  const isGroup = params.isGroup === '1';

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
  const [viewerMedia, setViewerMedia] = useState<OpenableMedia | null>(null);
  const [groupName, setGroupName] = useState<string | null>(isGroup ? params.name || 'Group' : null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [placePickerVisible, setPlacePickerVisible] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerName = (isGroup ? groupName : params.name) || (isGroup ? 'Group' : 'Chat');
  const headerAvatar = params.avatarUri || null;

  const load = useCallback(async () => {
    try {
      const me = await getStoredUser();
      setCurrentUserId(me?.id ?? null);

      let convId = params.conversationId || null;

      if (!convId && params.userId && !isGroup) {
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
      if (result.conversation?.isGroup) {
        setGroupName(result.conversation.name);
        setMemberCount(result.conversation.memberCount);
      } else if (result.user) {
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

  useRealtimeEvent<{ conversationId: string }>('message:read', (payload) => {
    if (!conversationId || payload.conversationId !== conversationId) {
      return;
    }
    // The other participant opened the chat — mark all of my messages as read
    // so the delivery tick becomes a read (double) tick.
    setMessages((current) =>
      current.some((message) => message.senderId === currentUserId && !message.read)
        ? current.map((message) =>
            message.senderId === currentUserId && !message.read
              ? { ...message, read: true }
              : message,
          )
        : current,
    );
  });

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

  async function uploadMedia(media: {
    uri: string;
    mediaType: 'image' | 'video';
    width?: number;
    height?: number;
  }) {
    setIsSending(true);
    try {
      const result = await sendMediaMessage({
        conversationId: conversationId ?? undefined,
        recipientId: conversationId ? undefined : otherUserId ?? undefined,
        uri: media.uri,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
      });
      setConversationId(result.conversationId);
      setMessages((current) =>
        current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message],
      );
    } catch (error) {
      await dialog.alert({
        title: 'Could not send',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handlePickMedia() {
    if (isSending) {
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await dialog.alert({
        title: 'Permission needed',
        message: 'Allow photo access to share images and videos.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      // Heavy compression so media is quick to upload and download on mobile data.
      quality: 0.5,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    await uploadMedia({
      uri: asset.uri,
      mediaType: asset.type === 'video' ? 'video' : 'image',
      width: asset.width,
      height: asset.height,
    });
  }

  async function handleSharePlace(place: { placeId: string; name: string; imageUrl: string | null }) {
    setPlacePickerVisible(false);
    setIsSending(true);
    try {
      const response = await sharePlaceInConversation({
        conversationId: conversationId ?? undefined,
        recipientId: conversationId ? undefined : otherUserId ?? undefined,
        placeId: place.placeId,
        name: place.name,
        imageUrl: place.imageUrl,
      });
      setConversationId(response.conversationId);
      setMessages((current) =>
        current.some((message) => message.id === response.message.id)
          ? current
          : [...current, response.message],
      );
    } catch (error) {
      await dialog.alert({
        title: 'Could not share place',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }

  // Pre-compute grouping metadata once per message change. The list is inverted,
  // so we reverse after annotating to keep newest at the bottom.
  const rows = useMemo<ChatRow[]>(
    () =>
      messages
        .map((message, index) => {
          const prev = messages[index - 1];
          const next = messages[index + 1];
          return {
            message,
            mine: message.senderId === currentUserId,
            isFirstInGroup: !prev || prev.senderId !== message.senderId,
            isLastInGroup: !next || next.senderId !== message.senderId,
          };
        })
        .reverse(),
    [messages, currentUserId],
  );

  const handlePlacePress = useCallback(
    (place: { placeId: string; name: string; imageUrl: string | null }) => {
      router.push({
        pathname: '/place-detail',
        params: { id: place.placeId, name: place.name, imageUrl: place.imageUrl ?? '' },
      });
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: ChatRow }) => (
      <MessageRow
        row={item}
        isGroup={isGroup}
        otherAvatar={headerAvatar}
        otherName={headerName}
        onOpenMedia={setViewerMedia}
        onPlacePress={handlePlacePress}
      />
    ),
    [headerAvatar, headerName, handlePlacePress, isGroup],
  );

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
            disabled={isGroup}
            onPress={() => !isGroup && otherUserId && openUserProfile(router, otherUserId, currentUserId)}
          >
            {isGroup ? (
              <View style={styles.headerGroupGlyph}>
                <Ionicons name="people" size={20} color={colors.white} />
              </View>
            ) : (
              <Avatar
                uri={headerAvatar}
                name={headerName}
                size={34}
                online={presence.isOnline(otherUserId)}
              />
            )}
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerName}
              </Text>
              {isGroup && memberCount ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {memberCount} members
                </Text>
              ) : !isGroup && presence.isOnline(otherUserId) ? (
                <Text style={[styles.headerSubtitle, styles.headerOnline]} numberOfLines={1}>
                  Online
                </Text>
              ) : null}
            </View>
          </Pressable>
          {!isGroup ? (
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
          ) : null}
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
              data={rows}
              keyExtractor={(item) => item.message.id}
              contentContainerStyle={styles.list}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              inverted
              renderItem={renderRow}
              initialNumToRender={18}
              maxToRenderPerBatch={12}
              windowSize={11}
              removeClippedSubviews
            />
          )}

          {otherTyping ? <Text style={styles.typing}>{headerName} is typing…</Text> : null}

          <View
            style={[
              styles.inputBar,
              { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) },
            ]}
          >
            <Pressable
              onPress={handlePickMedia}
              disabled={isSending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Attach photo or video"
              style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
            >
              <Ionicons name="image" size={24} color={colors.brand} />
            </Pressable>
            <Pressable
              onPress={() => setPlacePickerVisible(true)}
              disabled={isSending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share a place"
              style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
            >
              <Ionicons name="location" size={24} color={colors.brand} />
            </Pressable>
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
      <MediaViewerModal media={viewerMedia} onClose={() => setViewerMedia(null)} />
      <PlacePickerModal
        visible={placePickerVisible}
        onClose={() => setPlacePickerVisible(false)}
        onSelect={handleSharePlace}
      />
    </View>
  );
}

type MessageRowProps = {
  row: ChatRow;
  isGroup: boolean;
  otherAvatar: string | null;
  otherName: string;
  onOpenMedia: (media: OpenableMedia) => void;
  onPlacePress: (place: { placeId: string; name: string; imageUrl: string | null }) => void;
};

const MessageRow = memo(function MessageRow({
  row,
  isGroup,
  otherAvatar,
  otherName,
  onOpenMedia,
  onPlacePress,
}: MessageRowProps) {
  const { message, mine, isFirstInGroup, isLastInGroup } = row;
  const time = formatClock(message.createdAt);
  // In group chats each message carries its own sender identity.
  const avatarUri = isGroup ? message.senderAvatar : otherAvatar;
  const displayName = isGroup ? message.senderName ?? 'Member' : otherName;

  return (
    <View
      style={[
        styles.bubbleRow,
        mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        isFirstInGroup && styles.bubbleRowGroupStart,
      ]}
    >
      {!mine ? (
        isLastInGroup ? (
          <Avatar uri={avatarUri} name={displayName} size={28} />
        ) : (
          <View style={styles.avatarSpacer} />
        )
      ) : null}

      <View style={[styles.bubbleGroup, mine ? styles.bubbleGroupMine : styles.bubbleGroupTheirs]}>
        {isGroup && !mine && isFirstInGroup ? (
          <Text style={styles.senderName} numberOfLines={1}>
            {displayName}
          </Text>
        ) : null}
        {message.sharedPlace ? (
          <Pressable
            onPress={() =>
              onPlacePress({
                placeId: message.sharedPlace!.placeId,
                name: message.sharedPlace!.name,
                imageUrl: message.sharedPlace!.imageUrl,
              })
            }
            style={({ pressed }) => [styles.placeCard, pressed && styles.pressed]}
          >
            {message.sharedPlace.imageUrl ? (
              <Image source={{ uri: message.sharedPlace.imageUrl }} style={styles.placeImage} />
            ) : (
              <View style={[styles.placeImage, styles.placeImagePlaceholder]}>
                <Ionicons name="location" size={28} color={colors.brand} />
              </View>
            )}
            <View style={styles.placeCardBody}>
              <Text style={styles.placeCardLabel}>SHARED PLACE</Text>
              <Text style={styles.placeCardName} numberOfLines={2}>
                {message.sharedPlace.name}
              </Text>
              <View style={styles.placeCardCta}>
                <Text style={styles.placeCardCtaText}>View place</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.brand} />
              </View>
            </View>
          </Pressable>
        ) : null}

        {message.media ? <ChatMediaBubble media={message.media} onOpen={onOpenMedia} /> : null}

        {message.text ? (
          <View
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
              message.sharedPlace ? styles.bubbleWithCard : null,
            ]}
          >
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
          </View>
        ) : null}

        {isLastInGroup ? (
          <View style={[styles.metaRow, mine ? styles.metaRowMine : styles.metaRowTheirs]}>
            <Text style={styles.metaTime}>{time}</Text>
            {mine && !isGroup ? (
              <Ionicons
                name={message.read ? 'checkmark-done' : 'checkmark'}
                size={15}
                color={message.read ? TICK_READ : colors.labelGray}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});

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
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  headerOnline: {
    color: '#22C55E',
    fontWeight: '700',
  },
  headerGroupGlyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
    paddingHorizontal: 4,
    marginBottom: 1,
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
    alignItems: 'flex-end',
    gap: 6,
    marginVertical: 1,
  },
  bubbleRowGroupStart: {
    marginTop: 10,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  avatarSpacer: {
    width: 28,
  },
  bubbleGroup: {
    maxWidth: '76%',
    gap: 3,
  },
  bubbleGroupMine: {
    alignItems: 'flex-end',
  },
  bubbleGroupTheirs: {
    alignItems: 'flex-start',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
    paddingHorizontal: 4,
  },
  metaRowMine: {
    alignSelf: 'flex-end',
  },
  metaRowTheirs: {
    alignSelf: 'flex-start',
  },
  metaTime: {
    fontSize: 11,
    color: colors.labelGray,
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
  attachButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
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
