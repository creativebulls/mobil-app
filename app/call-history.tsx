import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchCallHistory, type CallHistoryEntry } from '../src/api/callsApi';
import { useCall } from '../src/calls/CallProvider';
import { Avatar } from '../src/components/Avatar';
import { ScreenSafeArea, STACK_SCREEN_EDGES } from '../src/components/ScreenSafeArea';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { colors } from '../src/theme/colors';

type Filter = 'all' | 'missed';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function describeCall(entry: CallHistoryEntry): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  missed: boolean;
} {
  const incoming = entry.direction === 'incoming';

  switch (entry.status) {
    case 'completed':
      return {
        label: formatDuration(entry.durationSeconds),
        icon: incoming ? 'arrow-down-outline' : 'arrow-up-outline',
        missed: false,
      };
    case 'rejected':
      return {
        label: incoming ? 'Declined' : 'Declined',
        icon: incoming ? 'arrow-down-outline' : 'arrow-up-outline',
        missed: false,
      };
    case 'cancelled':
      return incoming
        ? { label: 'Missed call', icon: 'arrow-down-outline', missed: true }
        : { label: 'Cancelled', icon: 'arrow-up-outline', missed: false };
    case 'missed':
    default:
      return incoming
        ? { label: 'Missed call', icon: 'arrow-down-outline', missed: true }
        : { label: 'No answer', icon: 'arrow-up-outline', missed: false };
  }
}

export default function CallHistoryScreen() {
  const router = useRouter();
  const call = useCall();
  const [entries, setEntries] = useState<CallHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const result = await fetchCallHistory();
      setEntries(result);
    } catch {
      // Keep what we have; empty state covers first-load failure.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRealtimeEvent('call:history:updated', () => {
    void load();
  });

  const visible = useMemo(() => {
    if (filter === 'missed') {
      return entries.filter((e) => describeCall(e).missed);
    }
    return entries;
  }, [entries, filter]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function openChat(entry: CallHistoryEntry) {
    router.push({
      pathname: '/chat',
      params: {
        conversationId: entry.conversationId ?? '',
        userId: entry.peer.id,
        name: entry.peer.name,
        avatarUri: entry.peer.avatarUri ?? '',
      },
    });
  }

  function callBack(entry: CallHistoryEntry) {
    if (call.status !== 'idle') {
      return;
    }
    void call.startCall({
      userId: entry.peer.id,
      name: entry.peer.name,
      avatarUri: entry.peer.avatarUri,
      conversationId: entry.conversationId,
    });
  }

  return (
    <ScreenSafeArea edges={STACK_SCREEN_EDGES} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Calls</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.segment}>
        {(['all', 'missed'] as Filter[]).map((key) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {key === 'all' ? 'Recent' : 'Missed'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="call-outline" size={48} color={colors.labelGray} />
          <Text style={styles.emptyTitle}>
            {filter === 'missed' ? 'No missed calls' : 'No calls yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'missed'
              ? 'Missed calls will appear here.'
              : 'Start a voice call from any chat.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => {
            const info = describeCall(item);
            return (
              <Pressable
                onPress={() => openChat(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar uri={item.peer.avatarUri} name={item.peer.name} size={52} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, info.missed && styles.nameMissed]} numberOfLines={1}>
                    {item.peer.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons
                      name={info.icon}
                      size={14}
                      color={info.missed ? colors.danger : colors.labelGray}
                    />
                    <Text style={[styles.meta, info.missed && styles.metaMissed]} numberOfLines={1}>
                      {info.label} · {item.timeAgo}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => callBack(item)}
                  disabled={call.status !== 'idle'}
                  hitSlop={8}
                  style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${item.peer.name}`}
                >
                  <Ionicons name="call" size={22} color={colors.brand} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentButtonActive: {
    backgroundColor: colors.white,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.labelGray,
  },
  segmentTextActive: {
    color: colors.text,
  },
  loader: {
    marginTop: 40,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
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
  nameMissed: {
    color: colors.danger,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  metaMissed: {
    color: colors.danger,
    fontWeight: '600',
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputGray,
  },
});
