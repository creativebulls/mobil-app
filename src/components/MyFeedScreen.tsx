import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlaces } from '../hooks/usePlaces';
import { colors } from '../theme/colors';
import { placeToDiscoverPlace } from '../utils/places';
import { DiscoverPlacesSection } from './DiscoverPlacesSection';
import { FeedHeader } from './FeedHeader';
import { FeedSearchInput } from './FeedSearchInput';
import { LatestPostsSection } from './LatestPostsSection';
import { MeetFriendsSection } from './MeetFriendsSection';
import { MeetPeopleSection } from './MeetPeopleSection';
import { RecommendedPlacesByFriendsSection } from './RecommendedPlacesByFriendsSection';

export function MyFeedScreen() {
  const router = useRouter();
  const { places, isLoading, locationBased, placeName } = usePlaces(16);

  function openPlaces(sectionTitle: string) {
    router.push({ pathname: '/places', params: { title: sectionTitle } });
  }

  function openPlaceDetail(place: { id: string; companyName: string; imageUri: string }) {
    router.push({
      pathname: '/place-detail',
      params: { id: place.id, name: place.companyName, imageUrl: place.imageUri },
    });
  }

  const discoverTitle = locationBased
    ? placeName
      ? `Discover Places in ${placeName}`
      : 'Discover Places Near You'
    : 'Discover Top Places';

  const discoverPlaces = useMemo(
    () => places.map(placeToDiscoverPlace),
    [places],
  );

  // Until a friends graph exists, surface a different slice of the same
  // real places for the "recommended" section.
  const recommendedPlaces = useMemo(
    () => [...discoverPlaces].reverse(),
    [discoverPlaces],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FeedHeader />
      <FeedSearchInput />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 32,
    gap: 28,
  },
});
