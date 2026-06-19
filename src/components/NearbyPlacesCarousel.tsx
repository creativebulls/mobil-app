import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';

import { AppImage } from './AppImage';
import { NEARBY_PLACE_SLIDES, type NearbyPlaceSlide } from '../constants/nearbyPlaces';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 24;
const SLIDE_WIDTH = SCREEN_WIDTH;
const CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

type NearbyPlacesCarouselProps = {
  slides?: NearbyPlaceSlide[];
};

export function NearbyPlacesCarousel({ slides = NEARBY_PLACE_SLIDES }: NearbyPlacesCarouselProps) {
  const flatListRef = useRef<FlatList<NearbyPlaceSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  }

  function renderSlide({ item }: { item: NearbyPlaceSlide }) {
    return (
      <View style={styles.slide}>
        <View style={styles.slideCard}>
          <AppImage source={{ uri: item.imageUri }} style={styles.slideImage} resizeMode="cover" />

          <View style={styles.companyRow}>
            <AppImage source={{ uri: item.logoUri }} style={styles.companyLogo} resizeMode="cover" />

            <View style={styles.companyText}>
              <Text style={styles.companyName}>{item.companyName}</Text>
              <Text style={styles.companySubtitle}>{item.subtitle}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        snapToInterval={SLIDE_WIDTH}
        snapToAlignment="start"
        contentContainerStyle={styles.listContent}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
      />

      <View style={styles.pagination}>
        {slides.map((slide, index) => (
          <View
            key={slide.id}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 20,
  },
  listContent: {
    paddingVertical: 4,
  },
  slide: {
    width: SLIDE_WIDTH,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  slideCard: {
    width: CARD_WIDTH,
    gap: 16,
  },
  slideImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.inputGray,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  companyLogo: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  companyText: {
    flex: 1,
    gap: 4,
  },
  companyName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  companySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.brand,
  },
});
