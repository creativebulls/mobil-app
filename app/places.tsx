import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppImage } from '../src/components/AppImage';

import { fetchPlaces, searchPlaces } from '../src/api/placesApi';
import { getErrorMessage, type Place } from '../src/api/types';
import { FeedSearchInput } from '../src/components/FeedSearchInput';
import { StackScreenLayout } from '../src/components/StackScreenLayout';
import { colors } from '../src/theme/colors';
import { hasLocationAccess } from '../src/utils/locationAccess';

const HORIZONTAL_PADDING = 20;
const SEARCH_DEBOUNCE_MS = 400;

function formatMeta(place: Place): string {
  const parts: string[] = [];
  if (typeof place.distanceKm === 'number') {
    parts.push(`${place.distanceKm.toFixed(place.distanceKm < 10 ? 1 : 0)} KM`);
  }
  if (place.address) {
    parts.push(place.address);
  } else if (place.category) {
    parts.push(place.category);
  }
  return parts.join(' · ');
}

async function resolveCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    if (!(await hasLocationAccess())) {
      return null;
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch {
    return null;
  }
}

export default function PlacesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string }>();
  const title = params.title ?? 'Places';

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const coordsReadyRef = useRef(false);

  // Pagination bookkeeping. `activeQueryRef` ties an in-flight "load more" to the
  // query that started it so stale pages aren't appended after the search changes.
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const activeQueryRef = useRef('');

  const PAGE_SIZE = 10;

  const fetchPage = useCallback(async (search: string, offset: number) => {
    const coords = coordsRef.current;
    const trimmed = search.trim();
    return trimmed
      ? searchPlaces(trimmed, { lat: coords?.lat, lon: coords?.lon, offset })
      : fetchPlaces({ lat: coords?.lat, lon: coords?.lon, limit: PAGE_SIZE, offset });
  }, []);

  const load = useCallback(
    async (search: string) => {
      setIsLoading(true);
      setError(null);
      activeQueryRef.current = search;
      offsetRef.current = 0;
      hasMoreRef.current = false;

      try {
        if (!coordsReadyRef.current) {
          coordsRef.current = await resolveCoords();
          coordsReadyRef.current = true;
        }

        const response = await fetchPage(search, 0);

        // Ignore the result if the query changed while we were loading.
        if (activeQueryRef.current !== search) {
          return;
        }

        setPlaces(response.places);
        offsetRef.current = response.places.length;
        hasMoreRef.current = response.hasMore;
        setHasMore(response.hasMore);
      } catch (err) {
        if (activeQueryRef.current === search) {
          setError(getErrorMessage(err, 'Could not load places'));
          setPlaces([]);
          setHasMore(false);
          hasMoreRef.current = false;
        }
      } finally {
        if (activeQueryRef.current === search) {
          setIsLoading(false);
        }
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    const search = activeQueryRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await fetchPage(search, offsetRef.current);

      // Drop the page if the query changed mid-flight.
      if (activeQueryRef.current !== search) {
        return;
      }

      offsetRef.current += response.places.length;
      hasMoreRef.current = response.hasMore;
      setHasMore(response.hasMore);
      setPlaces((prev) => {
        const seen = new Set(prev.map((place) => place.id));
        return [...prev, ...response.places.filter((place) => !seen.has(place.id))];
      });
    } catch {
      // Keep current results; user can scroll again to retry.
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, load]);

  return (
    <StackScreenLayout>
      <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <FeedSearchInput
          value={query}
          onChangeText={setQuery}
          onSubmit={setQuery}
          placeholder="Search places…"
        />

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : (
          <FlatList
            data={places}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator color={colors.brand} style={styles.footerLoader} />
              ) : null
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/place-detail',
                    params: { id: item.id, name: item.name, imageUrl: item.imageUrl ?? undefined },
                  })
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                {item.imageUrl ? (
                  <AppImage source={{ uri: item.imageUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={22} color={colors.labelGray} />
                  </View>
                )}

                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </Text>
                  {formatMeta(item) ? (
                    <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                      {formatMeta(item)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="location-outline" size={40} color={colors.labelGray} />
                <Text style={styles.emptyTitle}>
                  {error ? 'Something went wrong' : 'No places found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {error
                    ? error
                    : query.trim()
                      ? `No results for “${query.trim()}”.`
                      : 'Try searching for a place or category.'}
                </Text>
              </View>
            }
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
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    paddingVertical: 32,
  },
  footerLoader: {
    paddingVertical: 20,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.inputGray,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
