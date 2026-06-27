import { useEffect, useState } from 'react';

import { fetchPlaceDetails } from '../api/placesApi';
import type { Place } from '../api/types';

type PlaceMapPhotos = {
  photoById: Record<string, string | null>;
  isLoading: boolean;
};

/**
 * Resolves place photo URLs for map markers — uses list `imageUrl` first, then
 * fetches place details from the backend (Google Places photos) when missing.
 */
export function usePlaceMapPhotos(places: Place[]): PlaceMapPhotos {
  const [photoById, setPhotoById] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    if (places.length === 0) {
      setPhotoById({});
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const initial: Record<string, string | null> = {};
    for (const place of places) {
      initial[place.id] = place.imageUrl;
    }
    setPhotoById(initial);

    const needDetails = places.filter((place) => !place.imageUrl);
    if (needDetails.length === 0) {
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const resolved = await Promise.all(
        needDetails.map(async (place) => {
          try {
            const detail = await fetchPlaceDetails(place.id);
            return { id: place.id, url: detail.imageUrl ?? detail.photos[0] ?? null };
          } catch {
            return { id: place.id, url: null };
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setPhotoById((prev) => {
        const merged = { ...prev };
        for (const { id, url } of resolved) {
          if (url) {
            merged[id] = url;
          }
        }
        return merged;
      });
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [places]);

  return { photoById, isLoading };
}
