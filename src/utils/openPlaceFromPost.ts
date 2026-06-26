import type { useRouter } from 'expo-router';

import { searchPlaces } from '../api/placesApi';
import type { PostPlace } from '../api/types';

type Router = ReturnType<typeof useRouter>;

export function openPlaceFromPost(
  router: Router,
  place: Pick<PostPlace, 'placeId' | 'name' | 'logoUri'>,
): void {
  if (place.placeId) {
    router.push({
      pathname: '/place-detail',
      params: {
        id: place.placeId,
        name: place.name,
        imageUrl: place.logoUri ?? '',
      },
    });
    return;
  }

  void (async () => {
    try {
      const result = await searchPlaces(place.name);
      const match =
        result.places.find((item) => item.name.toLowerCase() === place.name.toLowerCase()) ??
        result.places[0];

      if (!match) {
        return;
      }

      router.push({
        pathname: '/place-detail',
        params: {
          id: match.id,
          name: match.name,
          imageUrl: match.imageUrl ?? place.logoUri ?? '',
        },
      });
    } catch {
      // Ignore lookup failures for legacy posts without a stored place id.
    }
  })();
}
