import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
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

import { fetchFriends, type FriendSummary } from '../src/api/profileApi';
import { Avatar } from '../src/components/Avatar';
import { usePresence } from '../src/realtime/PresenceProvider';
import { getStoredUser } from '../src/storage/authSession';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

export default function FriendsScreen() {
  const router = useRouter();
  const presence = usePresence();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [result, me] = await Promise.all([fetchFriends(), getStoredUser()]);
      setFriends(result.friends);
      setCurrentUserId(me?.id ?? null);
      // Seed presence with whoever the server reported as online.
      presence.seed(result.friends.filter((friend) => friend.isOnline).map((friend) => friend.id));
    } catch {
      // Empty state covers load failure.
    } finally {
      setIsLoading(false);
    }
  }, [presence]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? friends.filter((friend) => friend.name.toLowerCase().includes(q)) : friends;
    // Online friends bubble to the top.
    return [...list].sort((a, b) => {
      const aOnline = presence.isOnline(a.id) ? 1 : 0;
      const bOnline = presence.isOnline(b.id) ? 1 : 0;
      return bOnline - aOnline;
    });
  }, [friends, search, presence]);

  const onlineCount = friends.filter((friend) => presence.isOnline(friend.id)).length;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Friends</Text>
          <View style={styles.headerSpacer} />
        </View>

        {onlineCount > 0 ? (
          <View style={styles.onlineSummary}>
            <View style={styles.summaryDot} />
            <Text style={styles.onlineSummaryText}>{onlineCount} online</Text>
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.labelGray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends"
            placeholderTextColor={colors.labelGray}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : friends.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.labelGray} />
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Pressable onPress={() => router.push('/add-friends')}>
              <Text style={styles.addLink}>Add friends</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const online = presence.isOnline(item.id);
              return (
                <Pressable
                  onPress={() => openUserProfile(router, item.id, currentUserId)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <Avatar uri={item.avatarUri} name={item.name} size={52} online={online} />
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.status, online && styles.statusOnline]} numberOfLines={1}>
                      {online ? 'Online' : item.statusText ?? 'Offline'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.labelGray} />
                </Pressable>
              );
            }}
          />
        )}
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  onlineSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  onlineSummaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22C55E',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    height: 44,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  addLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  status: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusOnline: {
    color: '#22C55E',
    fontWeight: '700',
  },
});
