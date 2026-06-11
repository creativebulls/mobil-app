import { getPlacesProvider } from './places.provider';
import type { PlaceDetailDTO, PlaceDTO } from './place.types';

type PlacesResult = {
  places: PlaceDTO[];
  locationBased: boolean;
  provider: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: PlacesResult }>();

function cacheKey(parts: Array<string | number | undefined>): string {
  return parts.map((part) => part ?? '').join(':');
}

function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getCached(key: string): PlacesResult | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key: string, value: PlacesResult): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function listPlaces(params: {
  lat?: number;
  lon?: number;
  limit?: number;
}): Promise<PlacesResult> {
  const provider = getPlacesProvider();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 30);
  const hasLocation = typeof params.lat === 'number' && typeof params.lon === 'number';

  const roundedLat = hasLocation ? Number(params.lat!.toFixed(2)) : undefined;
  const roundedLon = hasLocation ? Number(params.lon!.toFixed(2)) : undefined;
  const key = cacheKey([provider.name, 'list', roundedLat, roundedLon, limit]);

  const cached = getCached(key);
  if (cached) {
    return cached;
  }

  let places: PlaceDTO[] = [];
  let locationBased = false;

  if (hasLocation) {
    places = await provider.getNearby({ lat: params.lat!, lon: params.lon!, limit });
    locationBased = places.length > 0;
  }

  // Fall back to random top-rated places when there are no nearby results (or
  // no location at all) so the UI never ends up empty.
  if (places.length === 0) {
    const topRated = await provider.getTopRated({ limit: limit * 2 });
    places = shuffle(topRated).slice(0, limit);
  }

  const result: PlacesResult = { places, locationBased, provider: provider.name };
  setCached(key, result);
  return result;
}

const detailsCache = new Map<string, { expiresAt: number; value: PlaceDetailDTO }>();

export async function getPlaceDetails(id: string): Promise<PlaceDetailDTO | null> {
  const provider = getPlacesProvider();
  const key = cacheKey([provider.name, 'detail', id]);

  const cached = detailsCache.get(key);
  if (cached && cached.expiresAt >= Date.now()) {
    return cached.value;
  }

  const details = await provider.getDetails(id);
  if (details) {
    detailsCache.set(key, { value: details, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return details;
}

export async function searchPlaces(params: {
  query: string;
  lat?: number;
  lon?: number;
  limit?: number;
}): Promise<PlacesResult> {
  const provider = getPlacesProvider();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 30);

  const places = await provider.search({
    query: params.query,
    limit,
    lat: params.lat,
    lon: params.lon,
  });

  return { places, locationBased: false, provider: provider.name };
}
