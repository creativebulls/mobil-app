import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from './Avatar';
import { FeedSearchInput } from './FeedSearchInput';
import { colors } from '../theme/colors';

export type UserListItem = {
  id: string;
  name: string;
  avatarUri: string | null;
  subtitle?: string | null;
};

type UserListSheetProps = {
  visible: boolean;
  title: string;
  load: () => Promise<UserListItem[]>;
  /** Changing this value re-triggers the load when the sheet is open. */
  reloadKey?: string | number;
  onClose: () => void;
  onUserPress?: (userId: string) => void;
  emptyText?: string;
  searchPlaceholder?: string;
};

export function UserListSheet({
  visible,
  title,
  load,
  reloadKey,
  onClose,
  onUserPress,
  emptyText = 'Nobody here yet.',
  searchPlaceholder = 'Search people…',
}: UserListSheetProps) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Keep the latest loader without making it an effect dependency (parents pass
  // inline arrows that change every render).
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery('');

    loadRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setUsers(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load this list. Please try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, reloadKey]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(trimmed));
  }, [users, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <FeedSearchInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateText}>
                {users.length === 0 ? emptyText : 'No people match your search.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => onUserPress?.(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                >
                  <Avatar uri={item.avatarUri} name={item.name} size={44} presenceUserId={item.id} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stateBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
