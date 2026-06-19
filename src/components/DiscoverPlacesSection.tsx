import { ActivityIndicator, Dimensions, FlatList, StyleSheet, Text, View } from 'react-native';

import { DISCOVER_PLACES_DUMMY, type DiscoverPlace } from '../constants/discoverPlaces';
import { colors } from '../theme/colors';
import { DiscoverPlaceCard } from './DiscoverPlaceCard';
import { SectionHeader } from './SectionHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 20;
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

type DiscoverPlacesSectionProps = {
  title?: string;
  places?: DiscoverPlace[];
  isLoading?: boolean;
  /** True while appending more places (shows a trailing spinner). */
  isLoadingMore?: boolean;
  emptyText?: string;
  onViewAllPress?: () => void;
  onPlacePress?: (place: DiscoverPlace) => void;
  onFavoritePress?: (place: DiscoverPlace, isFavorite: boolean) => void;
  /** Called when the user scrolls near the end of the carousel. */
  onEndReached?: () => void;
};

function chunkPlaces(places: DiscoverPlace[]): DiscoverPlace[][] {
  const chunks: DiscoverPlace[][] = [];

  for (let index = 0; index < places.length; index += 2) {
    chunks.push(places.slice(index, index + 2));
  }

  return chunks;
}

export function DiscoverPlacesSection({
  title = 'Discover Places',
  places = DISCOVER_PLACES_DUMMY,
  isLoading = false,
  isLoadingMore = false,
  emptyText = 'No places to show right now.',
  onViewAllPress,
  onPlacePress,
  onFavoritePress,
  onEndReached,
}: DiscoverPlacesSectionProps) {
  const slides = chunkPlaces(places);

  function renderSlide({ item: pair }: { item: DiscoverPlace[] }) {
    return (
      <View style={styles.slide}>
        {pair.map((place) => (
          <DiscoverPlaceCard
            key={place.id}
            place={place}
            width={CARD_WIDTH}
            onPress={onPlacePress}
            onFavoritePress={onFavoritePress}
          />
        ))}

        {pair.length === 1 ? <View style={{ width: CARD_WIDTH }} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        onViewAllPress={onViewAllPress}
        accessibilityLabel="View all places"
      />

      {isLoading && places.length === 0 ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : places.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          data={slides}
          keyExtractor={(_, index) => `slide-${index}`}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="start"
          nestedScrollEnabled
          style={styles.list}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.brand} />
              </View>
            ) : null
          }
        />
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
    width: '100%',
  },
  slide: {
    width: SCREEN_WIDTH,
    flexDirection: 'row',
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: CARD_GAP,
  },
  footer: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
