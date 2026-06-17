import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePlaces } from '../hooks/usePlaces';
import { getStoredUser } from '../storage/authSession';
import { colors } from '../theme/colors';
import { placeToDiscoverPlace } from '../utils/places';
import { DiscoverPlacesSection } from './DiscoverPlacesSection';
import { FeedHeader } from './FeedHeader';
import { FeedSearchInput } from './FeedSearchInput';
import { LatestPostsSection } from './LatestPostsSection';
import { MeetFriendsSection } from './MeetFriendsSection';
import { MeetPeopleSection } from './MeetPeopleSection';
import { RecommendedPlacesByFriendsSection } from './RecommendedPlacesByFriendsSection';
import { SearchResults } from './SearchResults';

// Height of the collapsible logo/actions row. It slides out of view as the
// user scrolls down while the search bar below it stays pinned to the top.
const FEED_HEADER_HEIGHT = 56;
// Search bar region height (input + its bottom padding).
const SEARCH_REGION_HEIGHT = 60;
const TOP_BAR_HEIGHT = FEED_HEADER_HEIGHT + SEARCH_REGION_HEIGHT;

export function MyFeedScreen() {
  const router = useRouter();
  const { places, isLoading, locationBased, placeName } = usePlaces(16);

  const [query, setQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useMemo(
    () =>
      Animated.diffClamp(scrollY, 0, FEED_HEADER_HEIGHT).interpolate({
        inputRange: [0, FEED_HEADER_HEIGHT],
        outputRange: [0, -FEED_HEADER_HEIGHT],
      }),
    [scrollY],
  );

  useEffect(() => {
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));
  }, []);

  function openPlaces(sectionTitle: string) {
    router.push({ pathname: '/places', params: { title: sectionTitle } });
  }

  function openPlaceDetail(place: { id: string; companyName: string; imageUri: string }) {
    router.push({
      pathname: '/place-detail',
      params: { id: place.id, name: place.companyName, imageUrl: place.imageUri },
    });
  }

  function closeSearch() {
    setSearchActive(false);
    setQuery('');
  }

  const discoverTitle = locationBased
    ? placeName
      ? `Discover Places in ${placeName}`
      : 'Discover Places Near You'
    : 'Discover Top Places';

  const discoverPlaces = useMemo(() => places.map(placeToDiscoverPlace), [places]);

  // Until a friends graph exists, surface a different slice of the same
  // real places for the "recommended" section.
  const recommendedPlaces = useMemo(() => [...discoverPlaces].reverse(), [discoverPlaces]);

  if (searchActive) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.searchActiveRow}>
          <View style={styles.searchActiveInput}>
            <FeedSearchInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search friends, places, posts…"
            />
          </View>
          <Pressable onPress={closeSearch} hitSlop={8} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        <SearchResults query={debouncedQuery} currentUserId={currentUserId} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <MeetFriendsSection />
        <DiscoverPlacesSection
          title={discoverTitle}
          places={discoverPlaces}
          isLoading={isLoading}
          emptyText="No places found nearby."
          onViewAllPress={() => openPlaces(discoverTitle)}
          onPlacePress={openPlaceDetail}
        />
        <LatestPostsSection />
        <RecommendedPlacesByFriendsSection
          places={recommendedPlaces}
          isLoading={isLoading}
          emptyText="No recommendations yet."
          onViewAllPress={() => openPlaces('Recommended Places')}
          onPlacePress={openPlaceDetail}
        />
        <MeetPeopleSection />
      </Animated.ScrollView>

      <Animated.View
        style={[styles.topBar, { transform: [{ translateY: headerTranslateY }] }]}
      >
        <FeedHeader />
        <Pressable style={styles.searchTrigger} onPress={() => setSearchActive(true)}>
          <View style={styles.searchTriggerInner}>
            <Ionicons name="search-outline" size={20} color={colors.labelGray} />
            <Text style={styles.searchTriggerText}>Search friends, places, posts…</Text>
          </View>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingTop: TOP_BAR_HEIGHT + 8,
    paddingBottom: 32,
    gap: 28,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    zIndex: 10,
    elevation: 4,
  },
  searchTrigger: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchTriggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchTriggerText: {
    fontSize: 16,
    color: colors.labelGray,
  },
  searchActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  searchActiveInput: {
    flex: 1,
  },
  cancelButton: {
    paddingRight: 20,
    paddingLeft: 4,
    paddingBottom: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
  },
});
