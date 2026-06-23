import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchPlaces } from '../api/placesApi';
import { getErrorMessage, type Place } from '../api/types';
import { readCache, writeCache } from '../storage/offlineCache';
import { hasLocationAccess } from '../utils/locationAccess';

type CachedPlaces = {
  places: Place[];
  locationBased: boolean;
  placeName: string | null;
  hasMore: boolean;
};

type UsePlacesState = {
  places: Place[];
  isLoading: boolean;
  /** True while an additional page is being appended. */
  isLoadingMore: boolean;
  /** True when more places can be lazily loaded. */
  hasMore: boolean;
  error: string | null;
  /** True when results are based on the user's current location. */
  locationBased: boolean;
  /**
   * Whether the user has granted location access. Places are only shown when
   * this is true; when false the feed hides places entirely.
   */
  locationGranted: boolean;
  /**
   * The user's resolved coordinates, if location access is granted and a fix
   * was obtained. Exposed primarily for debug tooling.
   */
  coords: { lat: number; lon: number } | null;
  /** Human-readable name of the user's area (e.g. city), if resolved. */
  placeName: string | null;
  refresh: () => void;
  /** Loads and appends the next page of places. */
  loadMore: () => void;
};

async function resolveCoords(): Promise<{ lat: number; lon: number } | null> {
  try {
    if (!(await hasLocationAccess())) {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return { lat: position.coords.latitude, lon: position.coords.longitude };
  } catch {
    return null;
  }
}

async function resolvePlaceName(coords: { lat: number; lon: number }): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });

    const place = results[0];
    if (!place) {
      return null;
    }

    return place.city || place.district || place.subregion || place.region || place.country || null;
  } catch {
    return null;
  }
}

export function usePlaces(limit = 12): UsePlacesState {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationBased, setLocationBased] = useState(false);
  const [locationGranted, setLocationGranted] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Coordinates resolved on the initial load and reused for paging.
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  // Backend pool offset reached so far (sum of items received).
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const cacheKey = `places:${limit}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      offsetRef.current = 0;

      // Places are location-gated: without location access we show nothing.
      const granted = await hasLocationAccess();
      if (!cancelled) {
        setLocationGranted(granted);
      }

      if (!granted) {
        if (!cancelled) {
          coordsRef.current = null;
          offsetRef.current = 0;
          hasMoreRef.current = false;
          setPlaces([]);
          setLocationBased(false);
          setCoords(null);
          setPlaceName(null);
          setHasMore(false);
          setError(null);
          setIsLoading(false);
        }
        return;
      }

      // Show the last-known places instantly (and keep them if we're offline).
      const cached = await readCache<CachedPlaces>(cacheKey);
      if (!cancelled && cached) {
        setPlaces(cached.data.places);
        setLocationBased(cached.data.locationBased);
        setPlaceName(cached.data.placeName);
        setHasMore(cached.data.hasMore ?? false);
        hasMoreRef.current = cached.data.hasMore ?? false;
        setIsLoading(false);
      }

      try {
        const coords = await resolveCoords();
        coordsRef.current = coords;
        if (!cancelled) {
          setCoords(coords);
        }
        const [response, resolvedName] = await Promise.all([
          fetchPlaces({ lat: coords?.lat, lon: coords?.lon, limit, offset: 0 }),
          coords ? resolvePlaceName(coords) : Promise.resolve(null),
        ]);

        const placeNameValue = response.locationBased ? resolvedName : null;

        if (!cancelled) {
          setPlaces(response.places);
          setLocationBased(response.locationBased);
          setPlaceName(placeNameValue);
          setHasMore(response.hasMore);
          hasMoreRef.current = response.hasMore;
          offsetRef.current = response.places.length;
          setError(null);
        }

        void writeCache<CachedPlaces>(cacheKey, {
          places: response.places,
          locationBased: response.locationBased,
          placeName: placeNameValue,
          hasMore: response.hasMore,
        });
      } catch (err) {
        if (!cancelled) {
          // Offline / failed fetch: keep cached places if we have them.
          if (!cached) {
            setError(getErrorMessage(err, 'Could not load places'));
            setPlaces([]);
            setHasMore(false);
            hasMoreRef.current = false;
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [limit, reloadKey, cacheKey]);

  // Re-check when the app returns to the foreground so granting (or revoking)
  // location access in Settings is reflected without restarting the app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const coords = coordsRef.current;
      const response = await fetchPlaces({
        lat: coords?.lat,
        lon: coords?.lon,
        limit,
        offset: offsetRef.current,
      });

      offsetRef.current += response.places.length;
      hasMoreRef.current = response.hasMore;
      setHasMore(response.hasMore);
      setPlaces((prev) => {
        const seen = new Set(prev.map((place) => place.id));
        return [...prev, ...response.places.filter((place) => !seen.has(place.id))];
      });
    } catch {
      // Keep what we have; let the user retry by scrolling again.
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [limit]);

  return {
    places,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    locationBased,
    locationGranted,
    coords,
    placeName,
    refresh,
    loadMore,
  };
}
