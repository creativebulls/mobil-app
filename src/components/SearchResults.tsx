import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppImage } from './AppImage';
import { searchPlaces } from '../api/placesApi';
import { searchUsers } from '../api/profileApi';
import { searchPosts } from '../api/postsApi';
import type { Place, Post, UserSearchResult } from '../api/types';
import { useMediaUrl } from '../hooks/useMediaUrl';
import { openUserProfile } from '../utils/openUserProfile';
import { colors } from '../theme/colors';
import { Avatar } from './Avatar';

type Filter = 'all' | 'people' | 'places' | 'posts';
const MIN_QUERY = 2;
const PREVIEW_COUNT = 3;

type SearchResultsProps = {
  query: string;
  currentUserId: string | null;
};

export function SearchResults({ query, currentUserId }: SearchResultsProps) {
  const router = useRouter();
  const [people, setPeople] = useState<UserSearchResult[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const requestId = useRef(0);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) {
      setPeople([]);
      setPlaces([]);
      setPosts([]);
      setIsLoading(false);
      setError('');
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    setError('');

    void (async () => {
      const [usersRes, placesRes, postsRes] = await Promise.allSettled([
        searchUsers(trimmed),
        searchPlaces(trimmed),
        searchPosts(trimmed),
      ]);

      // Drop stale responses — only the latest query may update the UI.
      if (id !== requestId.current) {
        return;
      }

      setPeople(usersRes.status === 'fulfilled' ? usersRes.value.users : []);
      setPlaces(placesRes.status === 'fulfilled' ? placesRes.value.places : []);
      setPosts(postsRes.status === 'fulfilled' ? postsRes.value.posts : []);

      if (
        usersRes.status === 'rejected' &&
        placesRes.status === 'rejected' &&
        postsRes.status === 'rejected'
      ) {
        setError('Search failed. Check your connection and try again.');
      }
      setIsLoading(false);
    })();
  }, [trimmed]);

  const totalResults = people.length + places.length + posts.length;

  const filters = useMemo(
    () =>
      [
        { key: 'all' as const, label: 'All', count: totalResults },
        { key: 'people' as const, label: 'People', count: people.length },
        { key: 'places' as const, label: 'Places', count: places.length },
        { key: 'posts' as const, label: 'Posts', count: posts.length },
      ].filter((item) => item.key === 'all' || item.count > 0),
    [people.length, places.length, posts.length, totalResults],
  );

  function openPerson(user: UserSearchResult) {
    openUserProfile(router, user.id, currentUserId);
  }

  function openPlace(place: Place) {
    router.push({
      pathname: '/place-detail',
      params: { id: place.id, name: place.name, imageUrl: place.imageUrl },
    });
  }

  function openPost(post: Post) {
    router.push({ pathname: '/comments', params: { postId: post.id } });
  }

  if (trimmed.length < MIN_QUERY) {
    return (
      <View style={styles.hint}>
        <Ionicons name="search" size={40} color={colors.labelGray} />
        <Text style={styles.hintTitle}>Search WhereAbout</Text>
        <Text style={styles.hintText}>
          Find friends, places, and posts. Type at least {MIN_QUERY} characters to begin.
        </Text>
      </View>
    );
  }

  if (isLoading && totalResults === 0) {
    return <ActivityIndicator color={colors.brand} style={styles.loader} />;
  }

  if (error && totalResults === 0) {
    return (
      <View style={styles.hint}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.labelGray} />
        <Text style={styles.hintText}>{error}</Text>
      </View>
    );
  }

  if (!isLoading && totalResults === 0) {
    return (
      <View style={styles.hint}>
        <Ionicons name="sad-outline" size={40} color={colors.labelGray} />
        <Text style={styles.hintTitle}>No results</Text>
        <Text style={styles.hintText}>Nothing matched “{trimmed}”.</Text>
      </View>
    );
  }

  const showPeople = filter === 'all' || filter === 'people';
  const showPlaces = filter === 'all' || filter === 'places';
  const showPosts = filter === 'all' || filter === 'posts';
  const limit = (items: unknown[]) => (filter === 'all' ? items.slice(0, PREVIEW_COUNT) : items);

  return (
    <View style={styles.flex}>
      <View style={styles.filterRow}>
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
                {item.key !== 'all' ? ` ${item.count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {showPeople && people.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="People"
              count={people.length}
              showSeeAll={filter === 'all' && people.length > PREVIEW_COUNT}
              onSeeAll={() => setFilter('people')}
            />
            {(limit(people) as UserSearchResult[]).map((user) => (
              <Pressable
                key={user.id}
                onPress={() => openPerson(user)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar uri={user.avatarUri} name={user.name} size={48} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {user.name}
                  </Text>
                  {user.statusText ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {user.statusText}
                    </Text>
                  ) : null}
                </View>
                {user.isFriend ? (
                  <Text style={styles.friendBadge}>Friend</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.labelGray} />
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {showPlaces && places.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Places"
              count={places.length}
              showSeeAll={filter === 'all' && places.length > PREVIEW_COUNT}
              onSeeAll={() => setFilter('places')}
            />
            {(limit(places) as Place[]).map((place) => (
              <Pressable
                key={place.id}
                onPress={() => openPlace(place)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Thumb uri={place.imageUrl} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {place.category ?? place.address ?? 'Place'}
                  </Text>
                </View>
                {place.rating ? (
                  <View style={styles.rating}>
                    <Ionicons name="star" size={13} color="#F5A623" />
                    <Text style={styles.ratingText}>{place.rating.toFixed(1)}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.labelGray} />
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {showPosts && posts.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Posts"
              count={posts.length}
              showSeeAll={filter === 'all' && posts.length > PREVIEW_COUNT}
              onSeeAll={() => setFilter('posts')}
            />
            {(limit(posts) as Post[]).map((post) => (
              <Pressable
                key={post.id}
                onPress={() => openPost(post)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                {post.imageUri ? (
                  <Thumb uri={post.imageUri} />
                ) : (
                  <Avatar uri={post.author.avatarUri} name={post.author.name} size={48} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {post.author.name}
                  </Text>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {post.text ?? (post.place ? `📍 ${post.place.name}` : 'Post')}
                  </Text>
                </View>
                <Text style={styles.rowTime}>{post.timeAgo}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Thumb({ uri }: { uri: string | null }) {
  const resolved = useMediaUrl(uri);
  return (
    <AppImage source={resolved ? { uri: resolved } : undefined} style={styles.placeThumb} />
  );
}

function SectionHeader({
  title,
  count,
  showSeeAll,
  onSeeAll,
}: {
  title: string;
  count: number;
  showSeeAll: boolean;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={6}>
          <Text style={styles.seeAll}>See all {count}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.inputGray,
  },
  chipActive: {
    backgroundColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  content: {
    paddingBottom: 32,
  },
  loader: {
    marginTop: 48,
  },
  hint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 10,
  },
  hintTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.labelGray,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowTime: {
    fontSize: 12,
    color: colors.labelGray,
  },
  placeThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.inputGray,
  },
  friendBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
