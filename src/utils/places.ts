import type { Place } from '../api/types';
import type { DiscoverPlace } from '../constants/discoverPlaces';

export function placeToDiscoverPlace(place: Place): DiscoverPlace {
  const location =
    place.address ?? place.category ?? (place.rating ? `${place.rating.toFixed(1)} rating` : 'Nearby');

  return {
    id: place.id,
    imageUri: place.imageUrl,
    companyName: place.name,
    distanceKm: place.distanceKm,
    location,
  };
}
