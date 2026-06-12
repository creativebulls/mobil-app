import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchUsers, sendFriendRequest } from '../src/api/profileApi';
import { getErrorMessage, type UserSearchResult } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { getStoredUser } from '../src/storage/authSession';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

export default function AddFriendsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));
  }, []);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError('');
    try {
      const response = await searchUsers(trimmed);
      setResults(response.users);
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Search failed'));
    } finally {
      setIsSearching(false);
    }
  }, []);

  async function handleAdd(user: UserSearchResult) {
    if (user.isFriend || user.friendRequestStatus === 'sent') {
      return;
    }

    if (user.friendRequestStatus === 'received') {
      setPendingIds((current) => new Set(current).add(user.id));
      try {
        // User would accept from notifications; search doesn't return request id
        setError('Check notifications to accept their request.');
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(user.id);
          return next;
        });
      }
      return;
    }

    setPendingIds((current) => new Set(current).add(user.id));
    try {
      await sendFriendRequest(user.id);
      setResults((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, friendRequestStatus: 'sent' as const } : item,
        ),
      );
    } catch (addError) {
      setError(getErrorMessage(addError, 'Could not send request'));
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  }

  function renderAction(user: UserSearchResult) {
    if (user.isFriend) {
      return <Text style={styles.friendsBadge}>Friends</Text>;
    }
    if (user.friendRequestStatus === 'sent') {
      return <Text style={styles.pendingBadge}>Pending</Text>;
    }
    if (user.friendRequestStatus === 'received') {
      return <Text style={styles.pendingBadge}>Respond in notifications</Text>;
    }

    const loading = pendingIds.has(user.id);
    return (
      <Pressable
        onPress={() => void handleAdd(user)}
        disabled={loading}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.addButtonText}>Add</Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Friends</Text>
          <Pressable
            onPress={() => router.push('/qr-connect')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Connect by QR code"
          >
            <Ionicons name="qr-code-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.labelGray} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              void runSearch(text);
            }}
            placeholder="Search by name or email"
            placeholderTextColor={colors.labelGray}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isSearching ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.trim().length >= 2 && !isSearching ? (
              <Text style={styles.empty}>No users found</Text>
            ) : (
              <Text style={styles.empty}>Type at least 2 characters to search</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                onPress={() => openUserProfile(router, item.id, currentUserId)}
                style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}'s profile`}
              >
                <Avatar uri={item.avatarUri} name={item.name} size={48} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.statusText ? (
                    <Text style={styles.status} numberOfLines={1}>
                      {item.statusText}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {renderAction(item)}
            </View>
          )}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  error: {
    color: colors.brand,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  loader: {
    marginVertical: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: 32,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  friendsBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  pendingBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
    maxWidth: 100,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.7,
  },
});
