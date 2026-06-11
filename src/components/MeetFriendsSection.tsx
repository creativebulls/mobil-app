import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { MEET_FRIENDS_DUMMY, type MeetFriend } from '../constants/meetFriends';
import { SectionHeader } from './SectionHeader';
import { colors } from '../theme/colors';

type MeetFriendsSectionProps = {
  title?: string;
  friends?: MeetFriend[];
  onViewAllPress?: () => void;
  onFriendPress?: (friend: MeetFriend) => void;
};

function formatDistance(km: number): string {
  return `${km.toFixed(km < 10 ? 1 : 0)} KM`;
}

export function MeetFriendsSection({
  title = 'Meet Friends',
  friends = MEET_FRIENDS_DUMMY,
  onViewAllPress,
  onFriendPress,
}: MeetFriendsSectionProps) {
  function renderFriend({ item }: { item: MeetFriend }) {
    return (
      <Pressable
        onPress={() => onFriendPress?.(item)}
        style={({ pressed }) => [styles.friendItem, pressed && styles.friendItemPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatDistance(item.distanceKm)} away`}
      >
        <Image source={{ uri: item.avatarUri }} style={styles.avatar} resizeMode="cover" />

        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>

        <Text style={styles.distance} numberOfLines={1} ellipsizeMode="tail">
          {formatDistance(item.distanceKm)}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        onViewAllPress={onViewAllPress}
        accessibilityLabel="View all friends"
      />

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />
    </View>
  );
}

const AVATAR_SIZE = 72;
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
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.inputGray,
  },
  name: {
    width: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  distance: {
    width: '100%',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
