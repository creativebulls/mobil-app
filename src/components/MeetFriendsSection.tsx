import { memo, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { isUserOnline } from '../realtime/presenceStore';
import { useIsOnline, usePresenceVersion } from '../realtime/PresenceProvider';
import { Avatar } from './Avatar';
import { SectionHeader } from './SectionHeader';
import { colors } from '../theme/colors';

export type MeetFriendItem = {
  id: string;
  name: string;
  avatarUri: string | null;
  subtitle?: string | null;
};

type MeetFriendsSectionProps = {
  title?: string;
  friends?: MeetFriendItem[];
  onViewAllPress?: () => void;
  onFriendPress?: (friend: MeetFriendItem) => void;
};

const FriendCard = memo(function FriendCard({
  item,
  onPress,
}: {
  item: MeetFriendItem;
  onPress?: (friend: MeetFriendItem) => void;
}) {
  const isOnline = useIsOnline(item.id);
  const subtitle = item.subtitle?.trim() || (isOnline ? 'Online' : null);

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.friendItem, pressed && styles.friendItemPressed]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${item.name}, ${subtitle}` : item.name}
    >
      <Avatar uri={item.avatarUri} name={item.name} size={72} presenceUserId={item.id} />

      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {item.name.split(' ')[0]}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, isOnline && styles.subtitleOnline]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
});

export function MeetFriendsSection({
  title = 'Meet Friends',
  friends = [],
  onViewAllPress,
  onFriendPress,
}: MeetFriendsSectionProps) {
  const presenceVersion = usePresenceVersion();

  const sortedFriends = useMemo(
    () =>
      [...friends].sort(
        (a, b) => Number(isUserOnline(b.id)) - Number(isUserOnline(a.id)),
      ),
    [friends, presenceVersion],
  );

  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        onViewAllPress={onViewAllPress}
        accessibilityLabel="View all friends"
      />

      {sortedFriends.length === 0 ? (
        <Text style={styles.empty}>Add friends to see them here.</Text>
      ) : (
        <FlatList
          data={sortedFriends}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FriendCard item={item} onPress={onFriendPress} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.listContent}
          style={styles.list}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

const ITEM_WIDTH = 88;

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: 16,
  },
  list: {
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  friendItem: {
    width: ITEM_WIDTH,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  friendItemPressed: {
    opacity: 0.85,
  },
  name: {
    width: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    width: '100%',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subtitleOnline: {
    color: '#22C55E',
  },
  empty: {
    paddingHorizontal: 20,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
