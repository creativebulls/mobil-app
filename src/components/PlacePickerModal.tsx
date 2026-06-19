import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchPlaces, searchPlaces } from '../api/placesApi';
import type { Place } from '../api/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { colors } from '../theme/colors';

type SelectedPlace = { placeId: string; name: string; imageUrl: string | null };

type PlacePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (place: SelectedPlace) => void;
};

export function PlacePickerModal({ visible, onClose, onSelect }: PlacePickerModalProps) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setPlaces([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);

    void (async () => {
      try {
        const result =
          debouncedQuery.length >= 2
            ? await searchPlaces(debouncedQuery)
            : await fetchPlaces({ limit: 20 });
        if (id === requestId.current) {
          setPlaces(result.places);
        }
      } catch {
        if (id === requestId.current) {
          setPlaces([]);
        }
      } finally {
        if (id === requestId.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [debouncedQuery, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Share a place</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.labelGray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search places"
              placeholderTextColor={colors.labelGray}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </View>

          {isLoading && places.length === 0 ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : (
            <FlatList
              data={places}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No places found.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() =>
                    onSelect({ placeId: item.id, name: item.name, imageUrl: item.imageUrl ?? null })
                  }
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="image-outline" size={20} color={colors.labelGray} />
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {item.category ?? item.address ?? 'Place'}
                    </Text>
                  </View>
                  <Ionicons name="send" size={18} color={colors.brand} />
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: '60%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  loader: {
    marginTop: 30,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: 30,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.inputGray,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
