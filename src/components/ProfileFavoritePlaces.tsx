import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { FavoritePlace } from '../api/profileApi';
import { colors } from '../theme/colors';

type ProfileFavoritePlacesProps = {
  places: FavoritePlace[];
  onPlacePress?: (place: FavoritePlace) => void;
};

export function ProfileFavoritePlaces({ places, onPlacePress }: ProfileFavoritePlacesProps) {
  if (places.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Favorite Places</Text>
        <Text style={styles.emptyText}>Like places or post with positive reactions to see them here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>My Favorite Places</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {places.map((place) => (
          <Pressable
            key={`${place.id}-${place.name}`}
            onPress={() => onPlacePress?.(place)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            {place.imageUrl ? (
              <Image source={{ uri: place.imageUrl }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Ionicons name="location" size={28} color={colors.primary} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {place.name}
            </Text>
            {place.reaction === 'love' ? (
              <Ionicons name="heart" size={14} color={colors.brand} style={styles.reactionIcon} />
            ) : (
              <Ionicons name="thumbs-up" size={14} color={colors.brand} style={styles.reactionIcon} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 140;

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scroll: {
    gap: 12,
    paddingRight: 8,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.inputGray,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  image: {
    width: CARD_WIDTH,
    height: 100,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    padding: 10,
    paddingRight: 28,
    minHeight: 52,
  },
  reactionIcon: {
    position: 'absolute',
    bottom: 12,
    right: 10,
  },
  pressed: {
    opacity: 0.85,
  },
});
