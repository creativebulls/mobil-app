import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fetchFeed } from '../api/postsApi';
import type { Post } from '../api/types';
import { useRealtimeEvent } from '../hooks/useRealtimeEvent';
import { getStoredUser } from '../storage/authSession';
import { getHiddenPostIds, hidePost } from '../storage/hiddenPosts';
import { FeedPostCard } from './FeedPostCard';
import { openUserProfile } from '../utils/openUserProfile';
import { SectionHeader } from './SectionHeader';
import { colors } from '../theme/colors';

export function LatestPostsSection({ title = 'Latest Posts' }: { title?: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const [feed, user, hiddenIds] = await Promise.all([
        fetchFeed(),
        getStoredUser(),
        getHiddenPostIds(),
      ]);
      const hidden = new Set(hiddenIds);
      setPosts(feed.posts.filter((post) => !hidden.has(post.id)));
      setCurrentUserId(user?.id ?? null);
    } catch {
      // keep existing posts on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFeed();
    }, [loadFeed]),
  );

  useRealtimeEvent<Post>('post:created', (newPost) => {
    setPosts((current) =>
      current.some((post) => post.id === newPost.id) ? current : [newPost, ...current],
    );
  });

  useRealtimeEvent<Post>('post:updated', (updated) => {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  });

  useRealtimeEvent<{ postId: string; commentsCount: number }>('comment:created', (payload) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === payload.postId ? { ...post, commentsCount: payload.commentsCount } : post,
      ),
    );
  });

  function handleChanged(updated: Post) {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  }

  function handleDeleted(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  function handleHidden(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId));
    void hidePost(postId);
  }

  function handleCommentPress(post: Post) {
    router.push({ pathname: '/comments', params: { postId: post.id } });
  }

  return (
    <View style={styles.section}>
      <SectionHeader title={title} accessibilityLabel="View all posts" />

      {isLoading && posts.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptySubtitle}>Tap the + button to share the first post.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
              onHidden={handleHidden}
              onCommentPress={handleCommentPress}
              onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    gap: 16,
  },
  list: {
    gap: 20,
  },
  loader: {
    paddingVertical: 24,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
