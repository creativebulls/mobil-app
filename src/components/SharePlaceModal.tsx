import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchFriends, type FriendSummary } from '../api/profileApi';
import { sharePlaceWithContacts } from '../api/messagesApi';
import { getErrorMessage } from '../api/types';
import { Avatar } from './Avatar';
import { useDialog } from './dialog/DialogProvider';
import { buildPlaceShareMessage, buildPlaceShareUrl } from '../utils/placeShareLink';
import { colors } from '../theme/colors';

type SharePlaceModalProps = {
  visible: boolean;
  place: { placeId: string; name: string; imageUrl?: string | null } | null;
  onClose: () => void;
};

export function SharePlaceModal({ visible, place, onClose }: SharePlaceModalProps) {
  const dialog = useDialog();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const loadFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchFriends();
      setFriends(result.friends);
    } catch {
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setNote('');
      void loadFriends();
    }
  }, [visible, loadFriends]);

  async function handleShareExternally() {
    if (!place) {
      return;
    }
    try {
      await Share.share({
        message: buildPlaceShareMessage(place.name, place.placeId),
        url: buildPlaceShareUrl(place.placeId),
      });
    } catch {
      // User dismissed the share sheet.
    }
  }

  async function handleCopyLink() {
    if (!place) {
      return;
    }
    const url = buildPlaceShareUrl(place.placeId);
    try {
      // Lazy require so a stale build without the native module degrades
      // gracefully instead of crashing at import time.
      const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
      await Clipboard.setStringAsync(url);
      await dialog.alert({ title: 'Link copied', message: 'The place link is on your clipboard.' });
    } catch {
      // Native clipboard module unavailable (dev client not rebuilt) — fall back
      // to the OS share sheet so the link can still be sent.
      try {
        await Share.share({ message: url, url });
      } catch {
        await dialog.alert({ title: 'Place link', message: url });
      }
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSend() {
    if (!place || selected.size === 0 || isSending) {
      return;
    }
    setIsSending(true);
    try {
      await sharePlaceWithContacts({
        placeId: place.placeId,
        name: place.name,
        imageUrl: place.imageUrl,
        recipientIds: Array.from(selected),
        note,
      });
      onClose();
      await dialog.alert({
        title: 'Shared',
        message: `${place.name} was sent to ${selected.size} ${selected.size === 1 ? 'contact' : 'contacts'}.`,
      });
    } catch (error) {
      await dialog.alert({
        title: 'Could not share',
        message: getErrorMessage(error, 'Try again later'),
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                Share {place?.name ?? 'place'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.quickActions}>
              <Pressable
                onPress={handleCopyLink}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <View style={styles.quickIcon}>
                  <Ionicons name="link-outline" size={22} color={colors.brand} />
                </View>
                <Text style={styles.quickLabel}>Copy link</Text>
              </Pressable>
              <Pressable
                onPress={handleShareExternally}
                style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
              >
                <View style={styles.quickIcon}>
                  <Ionicons name="share-social-outline" size={22} color={colors.brand} />
                </View>
                <Text style={styles.quickLabel}>More apps</Text>
              </Pressable>
            </View>

            <Text style={styles.contactsHeading}>Send to contacts</Text>

            {isLoading ? (
              <ActivityIndicator color={colors.brand} style={styles.loader} />
            ) : friends.length === 0 ? (
              <Text style={styles.empty}>
                You have no contacts yet. Add friends to share places with them.
              </Text>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <Pressable
                      onPress={() => toggle(item.id)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    >
                      <Avatar uri={item.avatarUri} name={item.name} size={48} />
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                        {isSelected ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}

            <View style={styles.footer}>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a message (optional)…"
                placeholderTextColor={colors.labelGray}
                value={note}
                onChangeText={setNote}
                multiline
              />
              <Pressable
                onPress={handleSend}
                disabled={selected.size === 0 || isSending}
                style={({ pressed }) => [
                  styles.sendButton,
                  (selected.size === 0 || isSending) && styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {isSending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>
                    Send{selected.size > 0 ? ` (${selected.size})` : ''}
                  </Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
  },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  contactsHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.labelGray,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingBottom: 6,
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
  pressed: {
    opacity: 0.7,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  noteInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: colors.inputGray,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
});
