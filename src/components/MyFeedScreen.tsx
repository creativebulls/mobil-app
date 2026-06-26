import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { FeedHeaderActions } from './FeedHeaderActions';
import { FeedSearchInput } from './FeedSearchInput';
import { LatestPostsSection } from './LatestPostsSection';
import { MeetFriendsSection } from './MeetFriendsSection';
import { MeetPeopleSection } from './MeetPeopleSection';
import { RecommendedPlacesByFriendsSection } from './RecommendedPlacesByFriendsSection';
import { SearchResults } from './SearchResults';
import { FeedVideoPlaybackProvider, useFeedVideoPlayback } from '../feed/FeedVideoPlaybackContext';
import { useUnreadMessageCount } from '../hooks/useUnreadMessageCount';

// Logo/actions row height.
const FEED_HEADER_HEIGHT = 56;
// Search bar region height (input + its bottom padding).
const SEARCH_REGION_HEIGHT = 60;
// Full top bar (logo row + search) that scrolls up out of view as the page
// scrolls down and returns when scrolled back to the top.
const TOP_BAR_HEIGHT = FEED_HEADER_HEIGHT + SEARCH_REGION_HEIGHT;
// Width of notification + messages buttons in the header actions row.
const HEADER_ICON_SLOT_WIDTH = 90;
// Vertical position of the floating icon row at rest (header) and when collapsed (search).
const HEADER_ICONS_TOP = 8;
const SEARCH_ICONS_TOP = FEED_HEADER_HEIGHT + (SEARCH_REGION_HEIGHT - 40) / 2;
const ICON_SEARCH_GAP = 12;
const SEARCH_RESERVE_RIGHT = HEADER_ICON_SLOT_WIDTH + ICON_SEARCH_GAP;
// How far the user scrolls before the header fully collapses (lower = snappier).
const COLLAPSE_SCROLL = 18;
const COLLAPSE_INPUT = [0, COLLAPSE_SCROLL * 0.45, COLLAPSE_SCROLL] as const;

/** Ease-out curve — most of the motion finishes in the first half of the scroll. */
function easeOutOutputs(from: number, to: number): number[] {
  const delta = to - from;
  return [from, from + delta * 0.82, to];
}

function collapseInterp(scrollY: Animated.Value, from: number, to: number) {
  return scrollY.interpolate({
    inputRange: [...COLLAPSE_INPUT],
    outputRange: easeOutOutputs(from, to),
    extrapolate: 'clamp',
  });
}

export function MyFeedScreen() {
  const [feedFocused, setFeedFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFeedFocused(true);
      return () => setFeedFocused(false);
    }, []),
  );

  return (
    <FeedVideoPlaybackProvider enabled={feedFocused}>
      <MyFeedScreenContent />
    </FeedVideoPlaybackProvider>
  );
}

function MyFeedScreenContent() {
  const router = useRouter();
  const { requestEvaluate } = useFeedVideoPlayback();
  const unreadMessages = useUnreadMessageCount();
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

  const headerContentTranslateY = useMemo(
    () => collapseInterp(scrollY, 0, -FEED_HEADER_HEIGHT),
    [scrollY],
  );
  const headerOpacity = useMemo(() => collapseInterp(scrollY, 1, 0), [scrollY]);
  const iconsTranslateY = useMemo(
    () => collapseInterp(scrollY, 0, SEARCH_ICONS_TOP - HEADER_ICONS_TOP),
    [scrollY],
  );
  const iconsTranslateX = useMemo(() => collapseInterp(scrollY, -12, 0), [scrollY]);
  const searchTranslateX = useMemo(() => collapseInterp(scrollY, 8, 0), [scrollY]);
  const searchClipRight = useMemo(
    () => collapseInterp(scrollY, 0, SEARCH_RESERVE_RIGHT),
    [scrollY],
  );
  const dividerOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, COLLAPSE_SCROLL * 0.4],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY],
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
      requestEvaluate();
    }, [loadFriends, loadMeetPeople, requestEvaluate]),
  );

  useEffect(
    () =>
      onHomeReselect(() => {
        setSearchActive(false);
        setQuery('');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        scrollY.setValue(0);
        requestEvaluate();
      }),
    [requestEvaluate, scrollY],
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
        scrollEventThrottle={1}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: () => requestEvaluate(),
        })}
        onMomentumScrollEnd={() => requestEvaluate()}
        onScrollEndDrag={() => requestEvaluate()}
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

      <Animated.View style={styles.topBarClip} pointerEvents="box-none">
        <Animated.View
          style={[styles.topBarInner, { transform: [{ translateY: headerContentTranslateY }] }]}
          pointerEvents="box-none"
          shouldRasterizeIOS
          renderToHardwareTextureAndroid
        >
          <Animated.View
            style={[styles.headerRow, { opacity: headerOpacity }]}
            pointerEvents="box-none"
          >
            <FeedHeader showActions={false} messagesBadge={unreadMessages} />
          </Animated.View>

          <Animated.View style={styles.searchRow} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.searchClip,
                {
                  transform: [{ translateX: searchTranslateX }],
                  paddingRight: searchClipRight,
                },
              ]}
            >
              <Pressable style={styles.searchTrigger} onPress={() => setSearchActive(true)}>
                <View style={styles.searchTriggerInner}>
                  <Ionicons name="search-outline" size={20} color={colors.labelGray} />
                  <Text style={styles.searchTriggerText} numberOfLines={1}>
                    {searchPlaceholder}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </Animated.View>

          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.floatingActions,
              {
                transform: [{ translateY: iconsTranslateY }, { translateX: iconsTranslateX }],
              },
            ]}
          >
            <FeedHeaderActions side="both" messagesBadge={unreadMessages} />
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.topBarDivider, { opacity: dividerOpacity }]}
          />
        </Animated.View>
      </Animated.View>
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
  // Clipping window below the safe-area top edge. Only transforms are animated
  // (native driver) — height stays fixed to avoid layout thrashing / flicker.
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
  topBarInner: {
    height: TOP_BAR_HEIGHT,
  },
  headerRow: {
    height: FEED_HEADER_HEIGHT,
    backgroundColor: colors.white,
  },
  searchRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SEARCH_REGION_HEIGHT,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  searchClip: {
    flex: 1,
    overflow: 'hidden',
  },
  floatingActions: {
    position: 'absolute',
    top: HEADER_ICONS_TOP,
    right: 8,
    zIndex: 2,
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
    flex: 1,
    minWidth: 0,
  },
  searchTriggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchTriggerText: {
    flex: 1,
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
