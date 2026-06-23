import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchFriends, fetchMeetPeople, type FriendSummary, type MeetPerson } from '../api/profileApi';
import { useAppText } from '../config/ConfigProvider';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePlaces } from '../hooks/usePlaces';
import { onHomeReselect } from '../navigation/tabEvents';
import { readCache, writeCache } from '../storage/offlineCache';
import { seedPresence } from '../realtime/presenceStore';
import { getStoredUser } from '../storage/authSession';
import { colors } from '../theme/colors';
import { openUserProfile } from '../utils/openUserProfile';
import { placeToDiscoverPlace } from '../utils/places';
import { DiscoverPlacesSection } from './DiscoverPlacesSection';
import { FeedHeader } from './FeedHeader';
import { FeedSearchInput } from './FeedSearchInput';
import { LatestPostsSection } from './LatestPostsSection';
import { MeetFriendsSection } from './MeetFriendsSection';
import { MeetPeopleSection } from './MeetPeopleSection';
import { RecommendedPlacesByFriendsSection } from './RecommendedPlacesByFriendsSection';
import { SearchResults } from './SearchResults';

// Logo/actions row height.
const FEED_HEADER_HEIGHT = 56;
// Search bar region height (input + its bottom padding).
const SEARCH_REGION_HEIGHT = 60;
// Full collapsible header (logo row + search). The whole thing slides up out of
// view on scroll down and slides back in on scroll up.
const TOP_BAR_HEIGHT = FEED_HEADER_HEIGHT + SEARCH_REGION_HEIGHT;

// On iOS the top bar stays static (always visible) instead of collapsing on
// scroll. Android keeps the show-on-scroll-up collapsing behavior.
const IS_IOS = Platform.OS === 'ios';

export function MyFeedScreen() {
  const router = useRouter();
  const {
    places,
    isLoading,
    isLoadingMore,
    locationBased,
    locationGranted,
    coords,
    placeName,
    loadMore,
  } = usePlaces(16);

  const [query, setQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [meetPeople, setMeetPeople] = useState<MeetPerson[]>([]);
  const debouncedQuery = useDebouncedValue(query, 300);

  // Admin-editable home screen labels.
  const meetFriendsTitle = useAppText('home.meet_friends_title', 'Meet Friends');
  const latestPostsTitle = useAppText('home.latest_posts_title', 'Latest Posts');
  const recommendedTitle = useAppText('home.recommended_places_title', 'Recommended Places by Friend');
  const meetPeopleTitle = useAppText('home.meet_people_title', 'Meet People');
  const discoverTopTitle = useAppText('home.discover_title', 'Discover Top Places');
  const discoverNearTitle = useAppText('home.discover_near_title', 'Discover Places Near You');
  const discoverInPlaceTemplate = useAppText('home.discover_in_place_title', 'Discover Places in {place}');
  const searchPlaceholder = useAppText('home.search_placeholder', 'Search friends, places, posts…');

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  // diffClamp tracks scroll direction: scrolling down pushes the value toward
  // TOP_BAR_HEIGHT (header slides up/out), scrolling up pulls it back to 0
  // (header slides back in). This gives the show-on-scroll-up animation.
  const clampedScroll = useMemo(
    () => Animated.diffClamp(scrollY, 0, TOP_BAR_HEIGHT),
    [scrollY],
  );
  const headerTranslateY = useMemo(
    () =>
      clampedScroll.interpolate({
        inputRange: [0, TOP_BAR_HEIGHT],
        outputRange: [0, -TOP_BAR_HEIGHT],
        extrapolate: 'clamp',
      }),
    [clampedScroll],
  );
  const dividerOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 12],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY],
  );
  // iOS: hide only the logo/actions row on scroll while the search bar stays
  // pinned at the top (just below the system status bar). diffClamp tracks
  // scroll direction over the header height, so scrolling down slides the logo
  // row up/out and scrolling up animates it back down.
  const iosClampedScroll = useMemo(
    () => Animated.diffClamp(scrollY, 0, FEED_HEADER_HEIGHT),
    [scrollY],
  );
  const iosHeaderTranslateY = useMemo(
    () =>
      iosClampedScroll.interpolate({
        inputRange: [0, FEED_HEADER_HEIGHT],
        outputRange: [0, -FEED_HEADER_HEIGHT],
        extrapolate: 'clamp',
      }),
    [iosClampedScroll],
  );

  useEffect(() => {
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));

    // Hydrate from the offline cache so the feed isn't empty on a cold/offline start.
    void readCache<FriendSummary[]>('feed:friends').then((cached) => {
      if (cached && cached.data.length > 0) {
        setFriends((current) => (current.length > 0 ? current : cached.data));
      }
    });
    void readCache<MeetPerson[]>('feed:meetPeople').then((cached) => {
      if (cached && cached.data.length > 0) {
        setMeetPeople((current) => (current.length > 0 ? current : cached.data));
      }
    });
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const result = await fetchFriends();
      setFriends(result.friends);
      seedPresence(result.friends.filter((friend) => friend.isOnline).map((friend) => friend.id));
      void writeCache('feed:friends', result.friends);
    } catch {
      // Keep whatever friends were already shown (cached or in-memory).
    }
  }, []);

  const loadMeetPeople = useCallback(async () => {
    try {
      const result = await fetchMeetPeople();
      setMeetPeople(result.people);
      void writeCache('feed:meetPeople', result.people);
    } catch {
      // Keep whatever suggestions were already shown (cached or in-memory).
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
      void loadMeetPeople();
    }, [loadFriends, loadMeetPeople]),
  );

  useEffect(
    () =>
      onHomeReselect(() => {
        setSearchActive(false);
        setQuery('');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        scrollY.setValue(0);
      }),
    [scrollY],
  );

  const meetFriends = useMemo(
    () =>
      friends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        avatarUri: friend.avatarUri,
        subtitle: friend.statusText,
      })),
    [friends],
  );

  const meetPeopleItems = useMemo(
    () =>
      meetPeople.map((person) => ({
        id: person.id,
        name: person.name,
        avatarUri: person.avatarUri,
        subtitle: person.subtitle,
      })),
    [meetPeople],
  );

  function openPlaces(sectionTitle: string) {
    router.push({ pathname: '/places', params: { title: sectionTitle } });
  }

  function openPlaceDetail(place: { id: string; companyName: string; imageUri: string | null }) {
    router.push({
      pathname: '/place-detail',
      params: { id: place.id, name: place.companyName, imageUrl: place.imageUri ?? undefined },
    });
  }

  function closeSearch() {
    setSearchActive(false);
    setQuery('');
  }

  const discoverTitle = locationBased
    ? placeName
      ? discoverInPlaceTemplate.replace('{place}', placeName)
      : discoverNearTitle
    : discoverTopTitle;

  const discoverPlaces = useMemo(() => places.map(placeToDiscoverPlace), [places]);

  // Until a friends graph exists, surface a different slice of the same
  // real places for the "recommended" section.
  const recommendedPlaces = useMemo(() => [...discoverPlaces].reverse(), [discoverPlaces]);

  if (searchActive) {
    return (
      <View style={styles.container}>
        <View style={styles.searchActiveRow}>
          <View style={styles.searchActiveInput}>
            <FeedSearchInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder={searchPlaceholder}
            />
          </View>
          <Pressable onPress={closeSearch} hitSlop={8} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        <SearchResults query={debouncedQuery} currentUserId={currentUserId} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // iOS adds the safe-area inset to scroll content automatically; the
        // screen is already wrapped in a SafeAreaView, so let the layout own the
        // inset to avoid duplicated/growing top spacing on pull-to-refresh.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {__DEV__ && locationGranted && coords ? (
          <View style={styles.debugLocation}>
            <Ionicons name="location" size={14} color={colors.brand} />
            <Text style={styles.debugLocationText}>
              {`Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)}`}
              {placeName ? ` · ${placeName}` : ''}
            </Text>
          </View>
        ) : null}
        <MeetFriendsSection
          title={meetFriendsTitle}
          friends={meetFriends}
          onViewAllPress={() => router.push('/friends')}
          onFriendPress={(friend) => openUserProfile(router, friend.id, currentUserId)}
        />
        {locationGranted ? (
          <DiscoverPlacesSection
            title={discoverTitle}
            places={discoverPlaces}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            emptyText="No places found nearby."
            onViewAllPress={() => openPlaces(discoverTitle)}
            onPlacePress={openPlaceDetail}
            onEndReached={loadMore}
          />
        ) : null}
        <LatestPostsSection title={latestPostsTitle} />
        {locationGranted ? (
          <RecommendedPlacesByFriendsSection
            title={recommendedTitle}
            places={recommendedPlaces}
            isLoading={isLoading}
            emptyText="No recommendations yet."
            onViewAllPress={() => openPlaces(recommendedTitle)}
            onPlacePress={openPlaceDetail}
          />
        ) : null}
        <MeetPeopleSection
          title={meetPeopleTitle}
          people={meetPeopleItems}
          onViewAllPress={() => router.push('/add-friends')}
          onPersonPress={(person) => openUserProfile(router, person.id, currentUserId)}
        />
      </Animated.ScrollView>

      <View style={styles.topBarClip} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.topBar,
            { transform: [{ translateY: IS_IOS ? iosHeaderTranslateY : headerTranslateY }] },
          ]}
          pointerEvents="box-none"
        >
          <FeedHeader />
          <Pressable style={styles.searchTrigger} onPress={() => setSearchActive(true)}>
            <View style={styles.searchTriggerInner}>
              <Ionicons name="search-outline" size={20} color={colors.labelGray} />
              <Text style={styles.searchTriggerText}>{searchPlaceholder}</Text>
            </View>
          </Pressable>
          <Animated.View
            pointerEvents="none"
            style={[styles.topBarDivider, { opacity: dividerOpacity }]}
          />
        </Animated.View>
      </View>
    </View>
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
  // Dev-only readout of the resolved location. Stripped from release builds via
  // the `__DEV__` guard at the call site.
  debugLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: -8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.inputGray,
  },
  debugLocationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
  },
  // Clipping window pinned to the safe-area top edge. The header slides within
  // it and is clipped before it can reach the system status bar.
  topBarClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOP_BAR_HEIGHT,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 4,
  },
  topBar: {
    backgroundColor: colors.white,
  },
  topBarDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
