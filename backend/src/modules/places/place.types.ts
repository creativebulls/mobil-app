export type PlaceDTO = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string;
  rating: number | null;
  distanceKm: number | null;
  lat: number;
  lon: number;
  address: string | null;
  source: string;
};

export type PlaceDetailDTO = PlaceDTO & {
  description: string | null;
  website: string | null;
  wikipediaUrl: string | null;
};

export type NearbyParams = {
  lat: number;
  lon: number;
  radiusKm?: number;
  limit: number;
};

export type TopRatedParams = {
  limit: number;
};

export type SearchParams = {
  query: string;
  limit: number;
  lat?: number;
  lon?: number;
};

/**
 * Abstraction over any places data source. Implement this interface to add a
 * new backend (e.g. Google Places) without touching the API/UI layers.
 */
export interface PlacesProvider {
  readonly name: string;
  getNearby(params: NearbyParams): Promise<PlaceDTO[]>;
  getTopRated(params: TopRatedParams): Promise<PlaceDTO[]>;
  search(params: SearchParams): Promise<PlaceDTO[]>;
  getDetails(id: string): Promise<PlaceDetailDTO | null>;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}

export function fallbackImage(seed: string): string {
  const safeSeed = encodeURIComponent(seed || 'place');
  return `https://picsum.photos/seed/${safeSeed}/600/400`;
}

export function humanizeCategory(kinds: string | null | undefined): string | null {
  if (!kinds) {
    return null;
  }

  const first = kinds.split(',')[0]?.trim();
  if (!first) {
    return null;
  }

  return first
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
