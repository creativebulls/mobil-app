import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FriendSummary } from '../api/profileApi';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

type FriendsHorizontalListProps = {
  friends: FriendSummary[];
  onAddPress: () => void;
  onFriendPress?: (friend: FriendSummary) => void;
};

export function FriendsHorizontalList({ friends, onAddPress, onFriendPress }: FriendsHorizontalListProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>My Friends</Text>
        <Pressable onPress={onAddPress} hitSlop={8} accessibilityLabel="Add friends">
          <Ionicons name="person-add-outline" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Pressable
          onPress={onAddPress}
          style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add friend"
        >
          <View style={styles.addIconWrap}>
            <Ionicons name="add" size={28} color={colors.brand} />
          </View>
          <Text style={styles.friendName}>Add</Text>
        </Pressable>

        {friends.map((friend) => (
          <Pressable
            key={friend.id}
            onPress={() => onFriendPress?.(friend)}
            style={({ pressed }) => [styles.friendCard, pressed && styles.pressed]}
          >
            <Avatar uri={friend.avatarUri} name={friend.name} size={64} />
            <Text style={styles.friendName} numberOfLines={1}>
              {friend.name.split(' ')[0]}
            </Text>
          </Pressable>
        ))}

        {friends.length === 0 ? (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyText}>No friends yet — tap Add to find people</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  addCard: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  addIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.brand,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
  },
  friendCard: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 72,
    textAlign: 'center',
  },
  emptyHint: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    maxWidth: 200,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
