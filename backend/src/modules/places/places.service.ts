import { getPlacesProvider } from './places.provider';
import type { PlaceDetailDTO, PlaceDTO } from './place.types';

type PlacesResult = {
  places: PlaceDTO[];
  locationBased: boolean;
  provider: string;
  /** True when more places are available beyond this page (for lazy loading). */
  hasMore: boolean;
  /** Total places in the current result pool. */
  total: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;

// Size of the result "pool" fetched once per location/query and then paginated
// in-memory. Providers cap this internally (e.g. Google ~20, Foursquare ~50), so
// the effective pool is whatever the active provider can return in one pass.
const POOL_SIZE = 50;
const MAX_PAGE_LIMIT = 30;

type PlacesPool = { places: PlaceDTO[]; locationBased: boolean };

const cache = new Map<string, { expiresAt: number; value: PlacesPool }>();

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

function getCachedPool(key: string): PlacesPool | null {
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

function setCachedPool(key: string, value: PlacesPool): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function paginate(
  pool: PlacesPool,
  provider: string,
  offset: number,
  limit: number,
): PlacesResult {
  const start = Math.min(offset, pool.places.length);
  const slice = pool.places.slice(start, start + limit);
  return {
    places: slice,
    locationBased: pool.locationBased,
    provider,
    hasMore: start + slice.length < pool.places.length,
    total: pool.places.length,
  };
}

export async function listPlaces(params: {
  lat?: number;
  lon?: number;
  limit?: number;
  offset?: number;
}): Promise<PlacesResult> {
  const provider = getPlacesProvider();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), MAX_PAGE_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);
  const hasLocation = typeof params.lat === 'number' && typeof params.lon === 'number';

  const roundedLat = hasLocation ? Number(params.lat!.toFixed(2)) : undefined;
  const roundedLon = hasLocation ? Number(params.lon!.toFixed(2)) : undefined;
  const key = cacheKey([provider.name, 'pool', roundedLat, roundedLon]);

  let pool = getCachedPool(key);
  if (!pool) {
    let places: PlaceDTO[] = [];
    let locationBased = false;

    if (hasLocation) {
      places = await provider.getNearby({ lat: params.lat!, lon: params.lon!, limit: POOL_SIZE });
      locationBased = places.length > 0;
    }

    // Fall back to (shuffled) top-rated places when there are no nearby results
    // (or no location at all) so the UI never ends up empty.
    if (places.length === 0) {
      const topRated = await provider.getTopRated({ limit: POOL_SIZE });
      places = shuffle(topRated);
    }

    pool = { places, locationBased };
    setCachedPool(key, pool);
  }

  return paginate(pool, provider.name, offset, limit);
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

const searchCache = new Map<string, { expiresAt: number; value: PlacesPool }>();

export async function searchPlaces(params: {
  query: string;
  lat?: number;
  lon?: number;
  limit?: number;
  offset?: number;
}): Promise<PlacesResult> {
  const provider = getPlacesProvider();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), MAX_PAGE_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const hasLocation = typeof params.lat === 'number' && typeof params.lon === 'number';
  const roundedLat = hasLocation ? Number(params.lat!.toFixed(2)) : undefined;
  const roundedLon = hasLocation ? Number(params.lon!.toFixed(2)) : undefined;
  const normalizedQuery = params.query.trim().toLowerCase();
  const key = cacheKey([provider.name, 'search', normalizedQuery, roundedLat, roundedLon]);

  const entry = searchCache.get(key);
  let pool = entry && entry.expiresAt >= Date.now() ? entry.value : null;
  if (!pool) {
    const places = await provider.search({
      query: params.query,
      limit: POOL_SIZE,
      lat: params.lat,
      lon: params.lon,
    });
    pool = { places, locationBased: false };
    searchCache.set(key, { value: pool, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return paginate(pool, provider.name, offset, limit);
}

/** Drops all cached places/details so a provider/key change takes effect now. */
export function clearPlacesCache(): void {
  cache.clear();
  searchCache.clear();
  detailsCache.clear();
}
