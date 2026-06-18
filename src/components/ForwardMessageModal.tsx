import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchConversations, forwardMessages } from '../api/messagesApi';
import { fetchFriends } from '../api/profileApi';
import { getErrorMessage } from '../api/types';
import { Avatar } from './Avatar';
import { useDialog } from './dialog/DialogProvider';
import { colors } from '../theme/colors';

type ForwardTarget = {
  key: string;
  kind: 'conversation' | 'recipient';
  id: string;
  name: string;
  avatarUri: string | null;
  isGroup: boolean;
};

type ForwardMessageModalProps = {
  visible: boolean;
  sourceConversationId: string | null;
  messageIds: string[];
  onClose: () => void;
  onDone: () => void;
};

export function ForwardMessageModal({
  visible,
  sourceConversationId,
  messageIds,
  onClose,
  onDone,
}: ForwardMessageModalProps) {
  const dialog = useDialog();
  const [targets, setTargets] = useState<ForwardTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [conversationsRes, friendsRes] = await Promise.all([
        fetchConversations(),
        fetchFriends(),
      ]);

      const conversationTargets: ForwardTarget[] = conversationsRes.conversations
        .filter((conversation) => conversation.id !== sourceConversationId)
        .map((conversation) => ({
          key: `conversation:${conversation.id}`,
          kind: 'conversation' as const,
          id: conversation.id,
          name: conversation.name,
          avatarUri: conversation.avatarUri,
          isGroup: conversation.isGroup,
        }));

      // Skip friends who already have a 1:1 chat shown above to avoid duplicates.
      const existingUserIds = new Set(
        conversationsRes.conversations
          .filter((conversation) => !conversation.isGroup && conversation.user)
          .map((conversation) => conversation.user!.id),
      );

      const friendTargets: ForwardTarget[] = friendsRes.friends
        .filter((friend) => !existingUserIds.has(friend.id))
        .map((friend) => ({
          key: `recipient:${friend.id}`,
          kind: 'recipient' as const,
          id: friend.id,
          name: friend.name,
          avatarUri: friend.avatarUri,
          isGroup: false,
        }));

      setTargets([...conversationTargets, ...friendTargets]);
    } catch {
      setTargets([]);
    } finally {
      setIsLoading(false);
    }
  }, [sourceConversationId]);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      void load();
    }
  }, [visible, load]);

  const toggle = useCallback((key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectedCount = selected.size;

  const handleSend = useCallback(async () => {
    if (!sourceConversationId || selectedCount === 0 || isSending || messageIds.length === 0) {
      return;
    }
    setIsSending(true);
    try {
      const conversationIds: string[] = [];
      const recipientIds: string[] = [];
      for (const target of targets) {
        if (!selected.has(target.key)) {
          continue;
        }
        if (target.kind === 'conversation') {
          conversationIds.push(target.id);
        } else {
          recipientIds.push(target.id);
        }
      }

      await forwardMessages({
        sourceConversationId,
        messageIds,
        conversationIds,
        recipientIds,
      });
      onDone();
    } catch (error) {
      await dialog.alert({
        title: 'Could not forward',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }, [sourceConversationId, selectedCount, isSending, messageIds, targets, selected, onDone, dialog]);

  const messageCountLabel = useMemo(
    () => `${messageIds.length} ${messageIds.length === 1 ? 'message' : 'messages'}`,
    [messageIds.length],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Forward to</Text>
              <Text style={styles.subtitle}>{messageCountLabel} selected</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : targets.length === 0 ? (
            <Text style={styles.empty}>No chats or contacts to forward to yet.</Text>
          ) : (
            <FlatList
              data={targets}
              keyExtractor={(item) => item.key}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.key);
                return (
                  <Pressable
                    onPress={() => toggle(item.key)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Avatar uri={item.avatarUri} name={item.name} size={48} />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.isGroup ? <Text style={styles.meta}>Group</Text> : null}
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          <View style={styles.footer}>
            <Pressable
              onPress={handleSend}
              disabled={selectedCount === 0 || isSending}
              style={({ pressed }) => [
                styles.sendButton,
                (selectedCount === 0 || isSending) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {isSending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.sendButtonText}>
                    Forward{selectedCount > 0 ? ` (${selectedCount})` : ''}
                  </Text>
                  <Ionicons name="send" size={16} color={colors.white} />
                </>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '55%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  loader: {
    marginTop: 30,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingHorizontal: 30,
    paddingVertical: 30,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
    marginTop: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
  },
  sendButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
});
