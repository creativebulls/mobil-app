import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchPlaces, searchPlaces } from '../api/placesApi';
import type { Place } from '../api/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { AppImage } from './AppImage';
import { Avatar } from './Avatar';
import { colors } from '../theme/colors';

export type TaggedPlace = {
  placeId: string;
  name: string;
  imageUrl: string | null;
};

type CreatePostPlaceFieldProps = {
  value: TaggedPlace | null;
  onChange: (place: TaggedPlace | null) => void;
};

export function CreatePostPlaceField({ value, onChange }: CreatePostPlaceFieldProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const requestId = useRef(0);

  useEffect(() => {
    if (value) {
      setQuery('');
      setResults([]);
      setIsFocused(false);
    }
  }, [value]);

  useEffect(() => {
    if (value) {
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);

    void (async () => {
      try {
        const response =
          debouncedQuery.length >= 2
            ? await searchPlaces(debouncedQuery)
            : await fetchPlaces({ limit: 12 });
        if (id === requestId.current) {
          setResults(response.places);
        }
      } catch {
        if (id === requestId.current) {
          setResults([]);
        }
      } finally {
        if (id === requestId.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [debouncedQuery, value]);

  const showResults = !value && (isFocused || query.length > 0);

  if (value) {
    return (
      <View style={styles.selectedCard}>
        <Avatar uri={value.imageUrl} name={value.name} size={44} />
        <View style={styles.selectedText}>
          <Text style={styles.selectedLabel}>You are at</Text>
          <Text style={styles.selectedName} numberOfLines={2}>
            {value.name}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(null)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove selected place"
          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Which place you are at now</Text>
      <Text style={styles.sectionHint}>Required — search and select where you are</Text>

      <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
        <Ionicons name="search-outline" size={18} color={colors.labelGray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search where you are…"
          placeholderTextColor={colors.labelGray}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 180)}
          returnKeyType="search"
          autoCorrect={false}
        />
        {isLoading ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      </View>

      {showResults ? (
        <View style={styles.resultsPanel}>
          {results.length === 0 && !isLoading ? (
            <Text style={styles.emptyResults}>
              {debouncedQuery.length >= 2 ? 'No places found.' : 'Start typing to search places.'}
            </Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.resultsScroll}
              showsVerticalScrollIndicator={false}
            >
              {results.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() =>
                    onChange({
                      placeId: place.id,
                      name: place.name,
                      imageUrl: place.imageUrl ?? null,
                    })
                  }
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  {place.imageUrl ? (
                    <AppImage source={{ uri: place.imageUrl }} style={styles.resultThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.resultThumb, styles.resultThumbPlaceholder]}>
                      <Ionicons name="location-outline" size={18} color={colors.labelGray} />
                    </View>
                  )}
                  <View style={styles.resultText}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                      {place.category ?? place.address ?? 'Place'}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  searchBoxFocused: {
    borderColor: colors.brand,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  resultsPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  resultsScroll: {
    maxHeight: 220,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.inputGray,
  },
  resultThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  resultSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyResults: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceMutedBorder,
  },
  selectedText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
