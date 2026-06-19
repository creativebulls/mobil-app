import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DiscoverPlace } from '../constants/discoverPlaces';
import { colors } from '../theme/colors';

type DiscoverPlaceCardProps = {
  place: DiscoverPlace;
  width: number;
  isFavorite?: boolean;
  onPress?: (place: DiscoverPlace) => void;
  onFavoritePress?: (place: DiscoverPlace, isFavorite: boolean) => void;
};

function formatDistance(km: number | null): string | null {
  if (km === null) {
    return null;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} KM`;
}

export function DiscoverPlaceCard({
  place,
  width,
  isFavorite: isFavoriteProp,
  onPress,
  onFavoritePress,
}: DiscoverPlaceCardProps) {
  const [isFavoriteInternal, setIsFavoriteInternal] = useState(false);
  const isFavorite = isFavoriteProp ?? isFavoriteInternal;

  const distanceLabel = formatDistance(place.distanceKm);
  const metaLabel = distanceLabel ? `${distanceLabel} · ${place.location}` : place.location;

  function handleFavoritePress() {
    const next = !isFavorite;
    if (isFavoriteProp === undefined) {
      setIsFavoriteInternal(next);
    }
    onFavoritePress?.(place, next);
  }

  return (
    <Pressable
      onPress={() => onPress?.(place)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${place.companyName}, ${metaLabel}`}
    >
      <View style={styles.imageWrap}>
        {place.imageUri ? (
          <Image source={{ uri: place.imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color={colors.labelGray} />
          </View>
        )}

        <Pressable
          onPress={handleFavoritePress}
          style={({ pressed }) => [styles.heartButton, pressed && styles.heartButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          hitSlop={8}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? colors.brand : colors.white}
          />
        </Pressable>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.companyName} numberOfLines={1} ellipsizeMode="tail">
          {place.companyName}
        </Text>

        <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
          {metaLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const IMAGE_HEIGHT = 140;

const styles = StyleSheet.create({
  card: {
    gap: 8,
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.92,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.inputGray,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputGray,
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  textBlock: {
    width: '100%',
    minWidth: 0,
    gap: 4,
  },
  companyName: {
    width: '100%',
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    width: '100%',
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
