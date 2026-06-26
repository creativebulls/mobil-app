import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Post } from '../api/types';
import { Avatar } from './Avatar';
import { RichPostText } from './RichPostText';
import { openPlaceFromPost } from '../utils/openPlaceFromPost';
import { colors } from '../theme/colors';

type ProfileTextPostsListProps = {
  posts: Post[];
  onPostPress: (post: Post) => void;
};

function buildStatsLine(post: Post): string | null {
  const parts: string[] = [];
  const likes = post.likesCount ?? 0;
  const comments = post.commentsCount ?? 0;

  if (likes > 0) {
    parts.push(`${likes} ${likes === 1 ? 'like' : 'likes'}`);
  }
  if (comments > 0) {
    parts.push(`${comments} ${comments === 1 ? 'comment' : 'comments'}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function ProfileTextPostCard({ post, onPress }: { post: Post; onPress: () => void }) {
  const router = useRouter();
  const statsLine = buildStatsLine(post);
  const hasPlace = !!post.place?.name;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="View text post"
    >
      {hasPlace ? (
        <Pressable
          onPress={() => openPlaceFromPost(router, post.place!)}
          style={({ pressed }) => [styles.placeRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`View ${post.place!.name}`}
        >
          <Avatar uri={post.place!.logoUri} name={post.place!.name} size={32} />
          <Text style={styles.placeName} numberOfLines={1}>
            {post.place!.name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.labelGray} />
        </Pressable>
      ) : null}

      {post.text ? (
        <RichPostText text={post.text} style={styles.text} numberOfLines={5} />
      ) : (
        <Text style={styles.placeholder}>Text post</Text>
      )}

      <View style={styles.footer}>
        {statsLine ? <Text style={styles.stats}>{statsLine}</Text> : <View style={styles.footerSpacer} />}
        {post.timeAgo ? <Text style={styles.timeAgo}>{post.timeAgo}</Text> : null}
      </View>
    </Pressable>
  );
}

export function ProfileTextPostsList({ posts, onPostPress }: ProfileTextPostsListProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {posts.map((post) => (
        <ProfileTextPostCard key={post.id} post={post} onPress={() => onPostPress(post)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  placeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    letterSpacing: -0.2,
  },
  placeholder: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  footerSpacer: {
    flex: 1,
  },
  stats: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.labelGray,
  },
  pressed: {
    opacity: 0.92,
  },
});
