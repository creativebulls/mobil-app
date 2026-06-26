import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchSavedPosts } from '../src/api/postsApi';
import type { Post } from '../src/api/types';
import { FeedPostCard } from '../src/components/FeedPostCard';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { getStoredUser } from '../src/storage/authSession';
import { readCache, writeCache } from '../src/storage/offlineCache';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

export default function SavedPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      const [result, user] = await Promise.all([fetchSavedPosts(), getStoredUser()]);
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setCurrentUserId(user?.id ?? null);
      void writeCache('feed:savedPosts', result.posts);
    } catch {
      // keep existing posts on error
    } finally {
      setIsLoading(false);
      if (refresh) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    void readCache<Post[]>('feed:savedPosts').then((cached) => {
      if (cached && cached.data.length > 0) {
        setPosts((current) => (current.length > 0 ? current : cached.data));
        setIsLoading(false);
      }
    });
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));
  }, []);

  function handleChanged(updated: Post) {
    setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)));
  }

  function handleDeleted(postId: string) {
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  function handleUnsaved(updated: Post) {
    if (!updated.savedByMe) {
      setPosts((current) => current.filter((post) => post.id !== updated.id));
    } else {
      handleChanged(updated);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await load(true);
  }

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const result = await fetchSavedPosts(nextCursor);
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        const merged = [...current];
        for (const post of result.posts) {
          if (!seen.has(post.id)) {
            merged.push(post);
          }
        }
        return merged;
      });
      setNextCursor(result.nextCursor);
    } catch {
      // ignore
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleCommentPress(post: Post) {
    router.push({ pathname: '/comments', params: { postId: post.id } });
  }

  return (
    <StackScreenLayout>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved posts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && posts.length === 0 ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : posts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color={colors.labelGray} />
          <Text style={styles.emptyTitle}>No saved posts yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the bookmark icon on a post to save it here for later.
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => (
            <FeedPostCard
              post={item}
              currentUserId={currentUserId}
              onChanged={handleUnsaved}
              onDeleted={handleDeleted}
              onCommentPress={handleCommentPress}
              onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />
          }
          onEndReached={() => void handleLoadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator color={colors.brand} style={styles.footerLoader} /> : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </StackScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    marginTop: 32,
  },
  footerLoader: {
    paddingVertical: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
