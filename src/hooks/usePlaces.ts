import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { fetchPlaces } from '../api/placesApi';
import { getErrorMessage, type Place } from '../api/types';
import { hasLocationAccess } from '../utils/locationAccess';

type UsePlacesState = {
  places: Place[];
  isLoading: boolean;
  error: string | null;
  /** True when results are based on the user's current location. */
  locationBased: boolean;
  /** Human-readable name of the user's area (e.g. city), if resolved. */
  placeName: string | null;
  refresh: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [locationBased, setLocationBased] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const coords = await resolveCoords();
        const [response, resolvedName] = await Promise.all([
          fetchPlaces({ lat: coords?.lat, lon: coords?.lon, limit }),
          coords ? resolvePlaceName(coords) : Promise.resolve(null),
        ]);

        if (!cancelled) {
          setPlaces(response.places);
          setLocationBased(response.locationBased);
          setPlaceName(response.locationBased ? resolvedName : null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Could not load places'));
          setPlaces([]);
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
  }, [limit, reloadKey]);

  return { places, isLoading, error, locationBased, placeName, refresh };
}
