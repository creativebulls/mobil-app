import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchFriends } from '../api/profileApi';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

type SelectableParticipant = {
  userId: string;
  name: string;
  avatarUri: string | null;
};

type AddParticipantsModalProps = {
  visible: boolean;
  remainingSlots: number;
  excludeUserIds: string[];
  onClose: () => void;
  onConfirm: (selected: SelectableParticipant[]) => void;
};

export function AddParticipantsModal({
  visible,
  remainingSlots,
  excludeUserIds,
  onClose,
  onConfirm,
}: AddParticipantsModalProps) {
  const [friends, setFriends] = useState<SelectableParticipant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchFriends();
      const exclude = new Set(excludeUserIds);
      setFriends(
        res.friends
          .filter((friend) => !exclude.has(friend.id))
          .map((friend) => ({ userId: friend.id, name: friend.name, avatarUri: friend.avatarUri })),
      );
    } catch {
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, [excludeUserIds]);

  useEffect(() => {
    if (visible) {
      setSelected(new Set());
      setQuery('');
      void load();
    }
  }, [visible, load]);

  const visibleFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return friends;
    }
    return friends.filter((friend) => friend.name.toLowerCase().includes(q));
  }, [friends, query]);

  const toggle = useCallback(
    (userId: string) => {
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(userId)) {
          next.delete(userId);
        } else if (next.size < remainingSlots) {
          next.add(userId);
        }
        return next;
      });
    },
    [remainingSlots],
  );

  const handleConfirm = useCallback(() => {
    if (selected.size === 0) {
      return;
    }
    onConfirm(friends.filter((friend) => selected.has(friend.userId)));
  }, [selected, friends, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Add to call</Text>
              <Text style={styles.subtitle}>
                {remainingSlots > 0
                  ? `Select up to ${remainingSlots} ${remainingSlots === 1 ? 'person' : 'people'}`
                  : 'Call is full'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.labelGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              placeholderTextColor={colors.labelGray}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.labelGray} />
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : friends.length === 0 ? (
            <Text style={styles.empty}>No friends available to add.</Text>
          ) : visibleFriends.length === 0 ? (
            <Text style={styles.empty}>No friends match "{query.trim()}".</Text>
          ) : (
            <FlatList
              data={visibleFriends}
              keyExtractor={(item) => item.userId}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected.has(item.userId);
                const disabled = !isSelected && selected.size >= remainingSlots;
                return (
                  <Pressable
                    onPress={() => toggle(item.userId)}
                    disabled={disabled}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.rowDisabled]}
                  >
                    <Avatar uri={item.avatarUri} name={item.name} size={48} />
                    <View style={styles.rowText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                      </Text>
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
              onPress={handleConfirm}
              disabled={selected.size === 0}
              style={({ pressed }) => [
                styles.confirmButton,
                selected.size === 0 && styles.confirmButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                Add{selected.size > 0 ? ` (${selected.size})` : ''}
              </Text>
              <Ionicons name="call" size={16} color={colors.white} />
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.inputGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
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
  rowDisabled: {
    opacity: 0.4,
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
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
});
