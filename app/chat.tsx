import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  blockUser,
  deleteConversationHistory,
  deleteMessage,
  fetchMessages,
  markConversationRead,
  openConversationWith,
  sendMediaMessage,
  sendMessage,
  sharePlaceInConversation,
} from '../src/api/messagesApi';
import { reportUser } from '../src/api/moderationApi';
import type { ChatMessage, CallLog } from '../src/api/types';
import { getErrorMessage } from '../src/api/types';
import { useCall } from '../src/calls/CallProvider';
import { AppImage } from '../src/components/AppImage';
import { Avatar } from '../src/components/Avatar';
import { CameraCaptureModal, type CapturedMedia } from '../src/components/CameraCaptureModal';
import { ChatMediaBubble, MediaViewerModal, type OpenableMedia } from '../src/components/ChatMedia';
import { ForwardMessageModal } from '../src/components/ForwardMessageModal';
import { PlacePickerModal } from '../src/components/PlacePickerModal';
import { TAB_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { useIsOnline } from '../src/realtime/PresenceProvider';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { useKeyboardInset } from '../src/hooks/useKeyboardInset';
import { getRealtimeSocket } from '../src/realtime/socket';
import { getStoredUser } from '../src/storage/authSession';
import { readCache, writeCache } from '../src/storage/offlineCache';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

const TICK_READ = '#34B7F1';
const CALL_MISSED_COLOR = '#EF4444';

const REPORT_OTHER = 'Something else';
const REPORT_REASONS = [
  'Spam',
  'Nudity or sexual activity',
  'Hate speech or symbols',
  'Bullying or harassment',
  'Violence or dangerous organizations',
  'False information',
  'Scam or fraud',
  'Sale of illegal or regulated goods',
  REPORT_OTHER,
];

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  const insets = useSafeAreaInsets();
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
  const otherOnline = useIsOnline(isGroup ? null : otherUserId);
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
  const [groupAvatar, setGroupAvatar] = useState<string | null>(params.avatarUri || null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [placePickerVisible, setPlacePickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardVisible, setForwardVisible] = useState(false);
  const selectionMode = selectedIds.size > 0;
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraVisible, setCameraVisible] = useState(false);

  const headerName = (isGroup ? groupName : params.name) || (isGroup ? 'Group' : 'Chat');
  const headerAvatar = isGroup ? groupAvatar : params.avatarUri || null;

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

      // Show the last cached thread instantly (and keep it if we're offline).
      const cached = await readCache<ChatMessage[]>(`chat:${convId}`);
      if (cached && cached.data.length > 0) {
        setMessages((current) => (current.length > 0 ? current : cached.data));
        setIsLoading(false);
      }

      try {
        const result = await fetchMessages(convId);
        setMessages(result.messages);
        setNextCursor(result.nextCursor);
        if (result.conversation?.isGroup) {
          setGroupName(result.conversation.name);
          setGroupAvatar(result.conversation.avatarUri);
          setMemberCount(result.conversation.memberCount);
        } else if (result.user) {
          setOtherUserId(result.user.id);
        }
        // Cache the most recent page so it's available offline next time.
        void writeCache(`chat:${convId}`, result.messages);
        void markConversationRead(convId).catch(() => undefined);
      } catch (fetchError) {
        // If we have cached messages, stay on the thread; otherwise surface it.
        if (!cached || cached.data.length === 0) {
          throw fetchError;
        }
      }
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

  useEffect(
    () => () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    },
    [],
  );

  // Android edge-to-edge: lift the composer with keyboard height. iOS uses KeyboardAvoidingView.
  const { bottomInset: androidKeyboardInset, isOpen: keyboardOpen } = useKeyboardInset();

  // When the keyboard covers the navigation bar, drop the safe-area padding.
  const inputBottomInset = keyboardOpen ? 14 : Math.max(insets.bottom, 8) + 12;

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

  useRealtimeEvent<{ conversationId: string; messageId: string }>('message:deleted', (payload) => {
    if (!conversationId || payload.conversationId !== conversationId) {
      return;
    }
    setMessages((current) => current.filter((message) => message.id !== payload.messageId));
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

  useRealtimeEvent<{ conversationId: string }>('conversation:updated', (payload) => {
    if (!conversationId || payload.conversationId !== conversationId) {
      return;
    }
    void fetchMessages(conversationId).then((result) => {
      if (result.conversation?.isGroup) {
        setGroupAvatar(result.conversation.avatarUri);
        setGroupName(result.conversation.name);
        setMemberCount(result.conversation.memberCount);
      }
    });
  });

  useRealtimeEvent<{ conversationId: string }>('conversation:removed', (payload) => {
    if (conversationId && payload.conversationId === conversationId) {
      router.replace('/messages');
    }
  });

  async function handleDeleteHistory() {
    setMenuVisible(false);
    if (!conversationId) {
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Delete chat history?',
      message: 'This removes all messages in this chat for you.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteConversationHistory(conversationId);
      router.replace('/messages');
    } catch (error) {
      await dialog.alert({
        title: 'Could not delete chat',
        message: getErrorMessage(error, 'Try again later'),
      });
    }
  }

  async function handleBlock() {
    setMenuVisible(false);
    if (!otherUserId) {
      return;
    }
    const confirmed = await dialog.confirm({
      title: 'Block this person?',
      message: 'They will no longer be able to message you or see your profile.',
      confirmText: 'Block',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await blockUser(otherUserId);
      await dialog.alert({ title: 'Blocked', message: 'You have blocked this person.' });
      router.replace('/messages');
    } catch (error) {
      await dialog.alert({
        title: 'Could not block',
        message: getErrorMessage(error, 'Try again later'),
      });
    }
  }

  async function handleSubmitReport() {
    if (!otherUserId) {
      return;
    }
    if (!reportReason) {
      await dialog.alert({ title: 'Select a reason', message: 'Please choose why you are reporting.' });
      return;
    }
    let reason = reportReason;
    if (reportReason === REPORT_OTHER) {
      const custom = reportText.trim();
      if (!custom) {
        await dialog.alert({ title: 'Add details', message: 'Please describe the issue.' });
        return;
      }
      reason = custom;
    }
    setIsSubmittingReport(true);
    try {
      await reportUser({ reportedUserId: otherUserId, conversationId, reason });
      setReportVisible(false);
      setReportReason(null);
      setReportText('');
      await dialog.alert({
        title: 'Report submitted',
        message: 'Thanks. Our team will review this report.',
      });
    } catch (error) {
      await dialog.alert({
        title: 'Could not submit report',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }

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

  function stopRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function startRecording() {
    if (isSending || isRecording) {
      return;
    }
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        await dialog.alert({
          title: 'Microphone access',
          message: 'Allow microphone access to record voice messages.',
        });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordSeconds(0);
      setIsRecording(true);
      stopRecordTimer();
      recordTimerRef.current = setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    } catch {
      setIsRecording(false);
      stopRecordTimer();
      await dialog.alert({
        title: 'Could not start recording',
        message: 'Please try again.',
      });
    }
  }

  async function cancelRecording() {
    stopRecordTimer();
    setIsRecording(false);
    try {
      await audioRecorder.stop();
    } catch {
      // ignore
    }
  }

  async function stopAndSendRecording() {
    stopRecordTimer();
    setIsRecording(false);
    const durationMs = recordSeconds * 1000;
    try {
      await audioRecorder.stop();
    } catch {
      // ignore
    }
    const uri = audioRecorder.uri;
    if (!uri || durationMs < 500) {
      return;
    }
    await uploadVoiceNote(uri, durationMs);
  }

  async function uploadVoiceNote(uri: string, durationMs: number) {
    setIsSending(true);
    try {
      const result = await sendMediaMessage({
        conversationId: conversationId ?? undefined,
        recipientId: conversationId ? undefined : otherUserId ?? undefined,
        uri,
        mediaType: 'audio',
        mimeType: 'audio/m4a',
        fileName: `voice-${Date.now()}.m4a`,
        durationMs,
      });
      setConversationId(result.conversationId);
      setMessages((current) =>
        current.some((message) => message.id === result.message.id)
          ? current
          : [...current, result.message],
      );
    } catch (error) {
      await dialog.alert({
        title: 'Could not send voice message',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }

  async function handlePickFile() {
    if (isSending) {
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      setIsSending(true);
      try {
        const sent = await sendMediaMessage({
          conversationId: conversationId ?? undefined,
          recipientId: conversationId ? undefined : otherUserId ?? undefined,
          uri: asset.uri,
          mediaType: 'file',
          fileName: asset.name ?? undefined,
          mimeType: asset.mimeType ?? undefined,
          fileSize: asset.size ?? undefined,
        });
        setConversationId(sent.conversationId);
        setMessages((current) =>
          current.some((message) => message.id === sent.message.id)
            ? current
            : [...current, sent.message],
        );
      } catch (error) {
        await dialog.alert({
          title: 'Could not send file',
          message: getErrorMessage(error, 'Try again later'),
        });
      } finally {
        setIsSending(false);
      }
    } catch {
      // Picker dismissed / unavailable — nothing to do.
    }
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

  const exitSelection = useCallback(() => setSelectedIds(new Set()), []);

  const startSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (current.has(id)) {
        return current;
      }
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (!conversationId || selectedIds.size === 0) {
      return;
    }
    const ids = Array.from(selectedIds);
    const ownedIds = messages
      .filter((item) => ids.includes(item.id) && item.senderId === currentUserId)
      .map((item) => item.id);

    if (ownedIds.length === 0) {
      await dialog.alert({
        title: 'Cannot delete',
        message: 'You can only delete your own messages for everyone.',
      });
      return;
    }

    const hasOthers = ownedIds.length < ids.length;
    const confirmed = await dialog.confirm({
      title: ownedIds.length === 1 ? 'Delete message?' : `Delete ${ownedIds.length} messages?`,
      message: hasOthers
        ? 'Only your own messages will be deleted for everyone.'
        : 'This will be removed for everyone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setMessages((current) => current.filter((item) => !ownedIds.includes(item.id)));
    exitSelection();
    try {
      await Promise.all(ownedIds.map((id) => deleteMessage(conversationId, id)));
    } catch (error) {
      await dialog.alert({
        title: 'Could not delete messages',
        message: getErrorMessage(error, 'Try again later'),
      });
      void load();
    }
  }, [conversationId, selectedIds, messages, currentUserId, dialog, exitSelection, load]);

  const handleForwardDone = useCallback(async () => {
    setForwardVisible(false);
    const count = selectedIds.size;
    exitSelection();
    await dialog.alert({
      title: 'Forwarded',
      message: `Sent ${count} ${count === 1 ? 'message' : 'messages'}.`,
    });
  }, [selectedIds.size, exitSelection, dialog]);

  const handleCallBack = useCallback(() => {
    if (isGroup || !otherUserId || call.status !== 'idle') {
      return;
    }
    void call.startCall({
      userId: otherUserId,
      name: headerName,
      avatarUri: headerAvatar,
      conversationId,
    });
  }, [isGroup, otherUserId, call, headerName, headerAvatar, conversationId]);

  const renderRow = useCallback(
    ({ item }: { item: ChatRow }) => (
      <MessageRow
        row={item}
        isGroup={isGroup}
        otherAvatar={headerAvatar}
        otherName={headerName}
        onOpenMedia={setViewerMedia}
        onPlacePress={handlePlacePress}
        onCallBack={handleCallBack}
        selectionMode={selectionMode}
        selected={selectedIds.has(item.message.id)}
        onToggleSelect={toggleSelect}
        onLongPressSelect={startSelection}
      />
    ),
    [
      headerAvatar,
      headerName,
      handlePlacePress,
      handleCallBack,
      isGroup,
      selectionMode,
      selectedIds,
      toggleSelect,
      startSelection,
    ],
  );

  return (
    <>
      <StackScreenLayout edges={TAB_SCREEN_EDGES} style={styles.container}>
        <KeyboardAvoidingView
          style={[
            styles.flex,
            Platform.OS === 'android' && androidKeyboardInset > 0
              ? { paddingBottom: androidKeyboardInset }
              : null,
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        {selectionMode ? (
          <View style={styles.header}>
            <Pressable onPress={exitSelection} hitSlop={8}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.selectionCount}>{selectedIds.size}</Text>
            <View style={styles.flexFill} />
            <Pressable
              onPress={() => setForwardVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Forward"
              style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-redo-outline" size={23} color={colors.brand} />
            </Pressable>
            <Pressable
              onPress={handleBulkDelete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete"
              style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={22} color={CALL_MISSED_COLOR} />
            </Pressable>
          </View>
        ) : (
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerUser}
            disabled={!isGroup && !otherUserId}
            onPress={() => {
              if (isGroup) {
                if (conversationId) {
                  router.push({ pathname: '/group-info', params: { conversationId } });
                }
                return;
              }
              if (otherUserId) {
                openUserProfile(router, otherUserId, currentUserId);
              }
            }}
          >
            {isGroup ? (
              <Avatar uri={headerAvatar} name={headerName} size={34} />
            ) : (
              <Avatar
                uri={headerAvatar}
                name={headerName}
                size={34}
                presenceUserId={otherUserId}
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
              ) : !isGroup && otherOnline ? (
                <Text style={[styles.headerSubtitle, styles.headerOnline]} numberOfLines={1}>
                  Online
                </Text>
              ) : null}
            </View>
          </Pressable>
          {!isGroup ? (
            <>
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
              <Pressable
                onPress={() => setMenuVisible(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More options"
                style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() =>
                conversationId &&
                router.push({ pathname: '/group-info', params: { conversationId } })
              }
              disabled={!conversationId}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Group info"
              style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.brand} />
            </Pressable>
          )}
        </View>
        )}

        <View style={styles.flex}>
          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.message.id}
              style={styles.flex}
              contentContainerStyle={styles.list}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              inverted
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              renderItem={renderRow}
              initialNumToRender={18}
              maxToRenderPerBatch={12}
              windowSize={11}
              removeClippedSubviews
            />
          )}

          {otherTyping ? (
            <Text style={styles.typing}>{headerName} is typing…</Text>
          ) : null}

          <View style={[styles.inputBar, { paddingBottom: inputBottomInset }]}>
            {isRecording ? (
              <>
                <Pressable
                  onPress={() => void cancelRecording()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                  style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={24} color={colors.danger} />
                </Pressable>
                <View style={styles.recordingInfo}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording {formatDuration(recordSeconds)}</Text>
                </View>
                <Pressable
                  onPress={() => void stopAndSendRecording()}
                  disabled={isSending}
                  style={({ pressed }) => [
                    styles.sendButton,
                    isSending && styles.sendButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send voice message"
                >
                  <Ionicons name="send" size={20} color={colors.white} />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => setCameraVisible(true)}
                  disabled={isSending}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo or video"
                  style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
                >
                  <Ionicons name="camera" size={24} color={colors.brand} />
                </Pressable>
                <Pressable
                  onPress={handlePickMedia}
                  disabled={isSending}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Attach photo or video"
                  style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
                >
                  <Ionicons name="image" size={23} color={colors.brand} />
                </Pressable>
                <Pressable
                  onPress={() => void handlePickFile()}
                  disabled={isSending}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Attach a file"
                  style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
                >
                  <Ionicons name="attach" size={25} color={colors.brand} />
                </Pressable>
                <Pressable
                  onPress={() => setPlacePickerVisible(true)}
                  disabled={isSending}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Share a place"
                  style={({ pressed }) => [styles.attachButton, pressed && styles.pressed]}
                >
                  <Ionicons name="location" size={23} color={colors.brand} />
                </Pressable>
                <TextInput
                  style={styles.input}
                  placeholder="Message…"
                  placeholderTextColor={colors.labelGray}
                  value={draft}
                  onChangeText={handleChangeText}
                  multiline
                />
                {draft.trim() ? (
                  <Pressable
                    onPress={handleSend}
                    disabled={isSending}
                    style={({ pressed }) => [
                      styles.sendButton,
                      isSending && styles.sendButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                  >
                    <Ionicons name="send" size={20} color={colors.white} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void startRecording()}
                    disabled={isSending}
                    style={({ pressed }) => [
                      styles.sendButton,
                      isSending && styles.sendButtonDisabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Record voice message"
                  >
                    <Ionicons name="mic" size={22} color={colors.white} />
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
        </KeyboardAvoidingView>
      </StackScreenLayout>
      <MediaViewerModal media={viewerMedia} onClose={() => setViewerMedia(null)} />
      <ForwardMessageModal
        visible={forwardVisible}
        sourceConversationId={conversationId}
        messageIds={Array.from(selectedIds)}
        onClose={() => setForwardVisible(false)}
        onDone={handleForwardDone}
      />
      <PlacePickerModal
        visible={placePickerVisible}
        onClose={() => setPlacePickerVisible(false)}
        onSelect={handleSharePlace}
      />
      <CameraCaptureModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={(media: CapturedMedia) => {
          setCameraVisible(false);
          void uploadMedia({
            uri: media.uri,
            mediaType: media.mediaType,
            width: media.width,
            height: media.height,
          });
        }}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable style={styles.menuItem} onPress={() => void handleDeleteHistory()}>
              <Ionicons name="trash-outline" size={22} color={colors.text} />
              <Text style={styles.menuItemText}>Delete chat history</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => void handleBlock()}>
              <Ionicons name="ban-outline" size={22} color={colors.text} />
              <Text style={styles.menuItemText}>Block</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setReportReason(null);
                setReportText('');
                setReportVisible(true);
              }}
            >
              <Ionicons name="flag-outline" size={22} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Report</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={reportVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportVisible(false)}
      >
        <View style={styles.reportBackdrop}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Report {headerName}</Text>
            <Text style={styles.reportSubtitle}>
              Why are you reporting this? Your report is sent to our moderation team.
            </Text>
            <ScrollView style={styles.reportOptions} keyboardShouldPersistTaps="handled">
              {REPORT_REASONS.map((reason) => {
                const selected = reportReason === reason;
                return (
                  <Pressable
                    key={reason}
                    style={styles.reportOption}
                    onPress={() => setReportReason(reason)}
                  >
                    <Text style={styles.reportOptionText}>{reason}</Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.brand : colors.labelGray}
                    />
                  </Pressable>
                );
              })}
              {reportReason === REPORT_OTHER ? (
                <TextInput
                  style={styles.reportInput}
                  placeholder="Describe the issue…"
                  placeholderTextColor={colors.labelGray}
                  value={reportText}
                  onChangeText={setReportText}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                  autoFocus
                />
              ) : null}
            </ScrollView>
            <View style={styles.reportActions}>
              <Pressable
                style={styles.reportCancel}
                onPress={() => setReportVisible(false)}
                disabled={isSubmittingReport}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.reportSubmit, isSubmittingReport && styles.reportSubmitDisabled]}
                onPress={() => void handleSubmitReport()}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.reportSubmitText}>Submit report</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

type MessageRowProps = {
  row: ChatRow;
  isGroup: boolean;
  otherAvatar: string | null;
  otherName: string;
  onOpenMedia: (media: OpenableMedia) => void;
  onPlacePress: (place: { placeId: string; name: string; imageUrl: string | null }) => void;
  onCallBack: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onLongPressSelect: (id: string) => void;
};

function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function describeCallLog(callLog: CallLog, mine: boolean): { label: string; detail: string; missed: boolean } {
  switch (callLog.status) {
    case 'completed':
      return { label: 'Voice call', detail: formatCallDuration(callLog.durationSeconds), missed: false };
    case 'rejected':
      return { label: mine ? 'Call declined' : 'You declined', detail: '', missed: true };
    case 'missed':
    case 'cancelled':
    default:
      return { label: mine ? 'No answer' : 'Missed voice call', detail: '', missed: true };
  }
}

const CallLogBubble = memo(function CallLogBubble({
  callLog,
  mine,
  time,
  onCallBack,
}: {
  callLog: CallLog;
  mine: boolean;
  time: string;
  onCallBack: () => void;
}) {
  const { label, detail, missed } = describeCallLog(callLog, mine);
  const accent = missed ? CALL_MISSED_COLOR : colors.brand;
  return (
    <Pressable
      onPress={onCallBack}
      accessibilityRole="button"
      accessibilityLabel="Call back"
      style={({ pressed }) => [styles.callLogBubble, pressed && styles.pressed]}
    >
      <View style={[styles.callLogIconWrap, { backgroundColor: `${accent}1A` }]}>
        <Ionicons
          name={mine ? 'arrow-up' : missed ? 'arrow-down' : 'arrow-down'}
          size={14}
          color={accent}
          style={styles.callLogArrow}
        />
        <Ionicons name="call" size={15} color={accent} />
      </View>
      <View style={styles.callLogTextWrap}>
        <Text style={styles.callLogTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.callLogSub} numberOfLines={1}>
          {detail ? `${time} · ${detail}` : time}
        </Text>
      </View>
      <Ionicons name="call-outline" size={20} color={colors.brand} />
    </Pressable>
  );
});

const MessageRow = memo(function MessageRow({
  row,
  isGroup,
  otherAvatar,
  otherName,
  onOpenMedia,
  onPlacePress,
  onCallBack,
  selectionMode,
  selected,
  onToggleSelect,
  onLongPressSelect,
}: MessageRowProps) {
  const { message, mine, isFirstInGroup, isLastInGroup } = row;
  const time = formatClock(message.createdAt);
  // In group chats each message carries its own sender identity.
  const avatarUri = isGroup ? message.senderAvatar : otherAvatar;
  const displayName = isGroup ? message.senderName ?? 'Member' : otherName;
  // Long-press any message to enter multi-select mode.
  const handleLongPress = () => onLongPressSelect(message.id);
  // While selecting, the whole row toggles selection (inner controls pause).
  const rowOnPress = selectionMode ? () => onToggleSelect(message.id) : undefined;

  return (
    <Pressable
      onPress={rowOnPress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[
        styles.bubbleRow,
        mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        isFirstInGroup && styles.bubbleRowGroupStart,
        selected && styles.bubbleRowSelected,
      ]}
    >
      {selectionMode ? (
        <View style={[styles.selectCircle, selected && styles.selectCircleOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
        </View>
      ) : null}
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
        {message.callLog ? (
          <CallLogBubble callLog={message.callLog} mine={mine} time={time} onCallBack={onCallBack} />
        ) : null}
        {message.forwarded && !message.callLog ? (
          <View style={[styles.forwardedRow, mine ? styles.forwardedRowMine : null]}>
            <Ionicons name="arrow-redo-outline" size={13} color={colors.labelGray} />
            <Text style={styles.forwardedText}>Forwarded</Text>
          </View>
        ) : null}
        {message.sharedPlace ? (
          <Pressable
            onPress={() =>
              selectionMode
                ? onToggleSelect(message.id)
                : onPlacePress({
                    placeId: message.sharedPlace!.placeId,
                    name: message.sharedPlace!.name,
                    imageUrl: message.sharedPlace!.imageUrl,
                  })
            }
            onLongPress={handleLongPress}
            style={({ pressed }) => [styles.placeCard, pressed && styles.pressed]}
          >
            {message.sharedPlace.imageUrl ? (
              <AppImage source={{ uri: message.sharedPlace.imageUrl }} style={styles.placeImage} />
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

        {message.media ? (
          <ChatMediaBubble
            media={message.media}
            onOpen={selectionMode ? () => onToggleSelect(message.id) : onOpenMedia}
            onLongPress={handleLongPress}
          />
        ) : null}

        {message.text ? (
          <Pressable
            onPress={selectionMode ? () => onToggleSelect(message.id) : undefined}
            onLongPress={handleLongPress}
            delayLongPress={300}
            style={[
              styles.bubble,
              mine ? styles.bubbleMine : styles.bubbleTheirs,
              message.sharedPlace ? styles.bubbleWithCard : null,
            ]}
          >
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
          </Pressable>
        ) : null}

        {isLastInGroup && !message.callLog ? (
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
    </Pressable>
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
    position: 'relative',
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
  selectionCount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  flexFill: {
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
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  reportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  reportCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  reportSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  reportOptions: {
    maxHeight: 320,
    alignSelf: 'stretch',
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reportOptionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  reportInput: {
    minHeight: 90,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.inputGray,
    padding: 12,
    fontSize: 15,
    color: colors.text,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  reportCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  reportCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.labelGray,
  },
  reportSubmit: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 130,
    alignItems: 'center',
  },
  reportSubmitDisabled: {
    opacity: 0.6,
  },
  reportSubmitText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
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
  bubbleRowSelected: {
    backgroundColor: 'rgba(216, 70, 158, 0.10)',
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.labelGray,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  selectCircleOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  forwardedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forwardedRowMine: {
    justifyContent: 'flex-end',
  },
  forwardedText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.labelGray,
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
    paddingVertical: 4,
    fontSize: 12,
    color: colors.labelGray,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    marginHorizontal: 4,
    borderRadius: 21,
    backgroundColor: colors.inputGray,
    fontSize: 15,
    color: colors.text,
  },
  attachButton: {
    width: 36,
    height: 42,
    borderRadius: 18,
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
  recordingInfo: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: colors.inputGray,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
  },
  recordingText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  callLogBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F2F3F5',
    minWidth: 180,
  },
  callLogIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  callLogArrow: {
    marginRight: -2,
  },
  callLogTextWrap: {
    flex: 1,
  },
  callLogTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  callLogSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
});
