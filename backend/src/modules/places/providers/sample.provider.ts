import {
  fallbackImage,
  haversineKm,
  type NearbyParams,
  type PlaceDetailDTO,
  type PlaceDTO,
  type PlacesProvider,
  type SearchParams,
  type TopRatedParams,
} from '../place.types';

type SamplePlace = {
  id: string;
  name: string;
  category: string;
  rating: number;
  lat: number;
  lon: number;
  address: string;
};

// Curated places (centred around New Delhi) used when no external provider key
// is configured, or as an offline/dev fallback.
const SAMPLE_PLACES: SamplePlace[] = [
  { id: 'sample-1', name: 'Brew & Co. Coffee', category: 'Cafe', rating: 4.7, lat: 28.6219, lon: 77.2095, address: 'Connaught Place' },
  { id: 'sample-2', name: 'Urban Fitness Studio', category: 'Gym', rating: 4.5, lat: 28.6304, lon: 77.2177, address: 'Barakhamba Road' },
  { id: 'sample-3', name: 'Green Bowl', category: 'Restaurant', rating: 4.6, lat: 28.6128, lon: 77.2295, address: 'India Gate' },
  { id: 'sample-4', name: 'Cinema Plus', category: 'Cinema', rating: 4.3, lat: 28.6035, lon: 77.2065, address: 'Janpath' },
  { id: 'sample-5', name: 'Sunset Park', category: 'Park', rating: 4.8, lat: 28.6129, lon: 77.2025, address: 'Lodhi Gardens' },
  { id: 'sample-6', name: 'Crumb Bakery', category: 'Bakery', rating: 4.4, lat: 28.6358, lon: 77.2245, address: 'Daryaganj' },
  { id: 'sample-7', name: 'The Art House', category: 'Museum', rating: 4.6, lat: 28.6118, lon: 77.2193, address: 'Mandi House' },
  { id: 'sample-8', name: 'Riverside Bistro', category: 'Restaurant', rating: 4.5, lat: 28.6562, lon: 77.241, address: 'Red Fort' },
];

function toDTO(place: SamplePlace, distanceKm: number | null): PlaceDTO {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    imageUrl: fallbackImage(place.id),
    rating: place.rating,
    distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
    lat: place.lat,
    lon: place.lon,
    address: place.address,
    source: 'sample',
  };
}

export class SampleProvider implements PlacesProvider {
  readonly name = 'sample';

  async getNearby({ lat, lon, limit }: NearbyParams): Promise<PlaceDTO[]> {
    return SAMPLE_PLACES.map((place) => ({
      place,
      distanceKm: haversineKm({ lat, lon }, { lat: place.lat, lon: place.lon }),
    }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
      .map(({ place, distanceKm }) => toDTO(place, distanceKm));
  }

  async getTopRated({ limit }: TopRatedParams): Promise<PlaceDTO[]> {
    return SAMPLE_PLACES.slice()
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map((place) => toDTO(place, null));
  }

  async getDetails(id: string): Promise<PlaceDetailDTO | null> {
    const place = SAMPLE_PLACES.find((item) => item.id === id);
    if (!place) {
      return null;
    }

    return {
      ...toDTO(place, null),
      description: `${place.name} is a popular ${place.category.toLowerCase()} located at ${place.address}. A favourite spot among locals and visitors alike.`,
      website: null,
      wikipediaUrl: null,
    };
  }

  async search({ query, limit }: SearchParams): Promise<PlaceDTO[]> {
    const needle = query.trim().toLowerCase();

    return SAMPLE_PLACES.filter(
      (place) =>
        place.name.toLowerCase().includes(needle) ||
        place.category.toLowerCase().includes(needle),
    )
      .slice(0, limit)
      .map((place) => toDTO(place, null));
  }
}
