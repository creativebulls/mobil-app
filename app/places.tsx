import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPlaces, searchPlaces } from '../src/api/placesApi';
import { getErrorMessage, type Place } from '../src/api/types';
import { FeedSearchInput } from '../src/components/FeedSearchInput';
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
  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const coordsReadyRef = useRef(false);

  const load = useCallback(async (search: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!coordsReadyRef.current) {
        coordsRef.current = await resolveCoords();
        coordsReadyRef.current = true;
      }

      const coords = coordsRef.current;
      const trimmed = search.trim();

      const response = trimmed
        ? await searchPlaces(trimmed, { lat: coords?.lat, lon: coords?.lon })
        : await fetchPlaces({ lat: coords?.lat, lon: coords?.lon, limit: 30 });

      setPlaces(response.places);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load places'));
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, load]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/place-detail',
                    params: { id: item.id, name: item.name, imageUrl: item.imageUrl },
                  })
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} resizeMode="cover" />

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

                {typeof item.rating === 'number' ? (
                  <View style={styles.ratingPill}>
                    <Ionicons name="star" size={12} color={colors.brand} />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
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
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.brand,
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
