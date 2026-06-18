import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchFriends, fetchMeetPeople, type FriendSummary, type MeetPerson } from '../api/profileApi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePlaces } from '../hooks/usePlaces';
import { onHomeReselect } from '../navigation/tabEvents';
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

export function MyFeedScreen() {
  const router = useRouter();
  const { places, isLoading, locationBased, placeName } = usePlaces(16);

  const [query, setQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [meetPeople, setMeetPeople] = useState<MeetPerson[]>([]);
  const debouncedQuery = useDebouncedValue(query, 300);

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

  useEffect(() => {
    void getStoredUser().then((user) => setCurrentUserId(user?.id ?? null));
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const result = await fetchFriends();
      setFriends(result.friends);
      seedPresence(result.friends.filter((friend) => friend.isOnline).map((friend) => friend.id));
    } catch {
      // Keep whatever friends were already shown.
    }
  }, []);

  const loadMeetPeople = useCallback(async () => {
    try {
      const result = await fetchMeetPeople();
      setMeetPeople(result.people);
    } catch {
      // Keep whatever suggestions were already shown.
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
      <View style={styles.container}>
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
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <MeetFriendsSection
          friends={meetFriends}
          onViewAllPress={() => router.push('/friends')}
          onFriendPress={(friend) => openUserProfile(router, friend.id, currentUserId)}
        />
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
        <MeetPeopleSection
          people={meetPeopleItems}
          onViewAllPress={() => router.push('/add-friends')}
          onPersonPress={(person) => openUserProfile(router, person.id, currentUserId)}
        />
      </Animated.ScrollView>

      <View style={styles.topBarClip} pointerEvents="box-none">
        <Animated.View
          style={[styles.topBar, { transform: [{ translateY: headerTranslateY }] }]}
          pointerEvents="box-none"
        >
          <FeedHeader />
          <Pressable style={styles.searchTrigger} onPress={() => setSearchActive(true)}>
            <View style={styles.searchTriggerInner}>
              <Ionicons name="search-outline" size={20} color={colors.labelGray} />
              <Text style={styles.searchTriggerText}>Search friends, places, posts…</Text>
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
