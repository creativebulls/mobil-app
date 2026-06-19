import { env } from '../../../config/env';
import {
  haversineKm,
  humanizeCategory,
  type NearbyParams,
  type PlaceDetailDTO,
  type PlaceDTO,
  type PlacesProvider,
  type SearchParams,
  type TopRatedParams,
} from '../place.types';

// Google Places API (New) — https://developers.google.com/maps/documentation/places/web-service
const GOOGLE_BASE = 'https://places.googleapis.com/v1';

// Requested image size when resolving Google photo media URLs.
const PHOTO_MAX_WIDTH = 800;
const PHOTO_MAX_HEIGHT = 600;

// searchNearby / searchText cap results at 20 per request.
const MAX_RESULTS = 20;

// Field masks keep responses (and billing SKUs) lean. List/search use the
// `places.` prefix; the Place Details GET uses bare field names.
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.photos',
].join(',');

const DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'primaryTypeDisplayName',
  'rating',
  'photos',
  'websiteUri',
  'editorialSummary',
].join(',');

type GoogleLatLng = { latitude?: number; longitude?: number };
type GoogleLocalizedText = { text?: string };
type GooglePhoto = { name?: string };

type GooglePlace = {
  id?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
  types?: string[];
  primaryTypeDisplayName?: GoogleLocalizedText;
  rating?: number;
  photos?: GooglePhoto[];
  websiteUri?: string;
  editorialSummary?: GoogleLocalizedText;
};

type GoogleSearchResponse = { places?: GooglePlace[] };

function toRating(rating: number | undefined): number | null {
  return typeof rating === 'number' && Number.isFinite(rating)
    ? Number(rating.toFixed(1))
    : null;
}

function categoryName(place: GooglePlace): string | null {
  if (place.primaryTypeDisplayName?.text) {
    return place.primaryTypeDisplayName.text;
  }
  const first = place.types?.find(Boolean);
  return first ? humanizeCategory(first) : null;
}

export class GooglePlacesProvider implements PlacesProvider {
  readonly name = 'google';

  private readonly apiKey: string;

  // Google Places "Table A" types to restrict results to. Empty = no filter.
  private readonly includedTypes: string[];

  constructor(apiKey: string, options: { includedTypes?: string[] } = {}) {
    this.apiKey = apiKey;
    this.includedTypes = options.includedTypes ?? [];
  }

  /** Keeps only places whose types intersect the configured allow-list. */
  private filterByTypes(places: GooglePlace[]): GooglePlace[] {
    if (this.includedTypes.length === 0) {
      return places;
    }
    const allowed = new Set(this.includedTypes);
    return places.filter((place) => (place.types ?? []).some((type) => allowed.has(type)));
  }

  private headers(fieldMask: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': fieldMask,
    };
  }

  /**
   * Resolves a Google photo resource (`places/.../photos/...`) into a usable
   * image URL. Uses `skipHttpRedirect=true` so Google returns a JSON body with a
   * direct `photoUri` (a key-less googleusercontent URL) — this keeps the API
   * key on the server instead of embedding it in client-visible image URLs.
   */
  private async resolvePhoto(name: string | undefined): Promise<string | null> {
    if (!name) {
      return null;
    }
    try {
      const url =
        `${GOOGLE_BASE}/${name}/media` +
        `?maxWidthPx=${PHOTO_MAX_WIDTH}&maxHeightPx=${PHOTO_MAX_HEIGHT}&skipHttpRedirect=true`;
      const response = await fetch(url, {
        headers: { 'X-Goog-Api-Key': this.apiKey },
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as { photoUri?: string };
      return data.photoUri ?? null;
    } catch {
      return null;
    }
  }

  private async toDto(
    place: GooglePlace,
    origin: { lat: number; lon: number } | null,
  ): Promise<PlaceDTO> {
    const lat = place.location?.latitude ?? 0;
    const lon = place.location?.longitude ?? 0;
    const imageUrl = await this.resolvePhoto(place.photos?.[0]?.name);

    return {
      id: place.id ?? '',
      name: place.displayName?.text ?? 'Unknown place',
      category: categoryName(place),
      imageUrl,
      rating: toRating(place.rating),
      distanceKm: origin ? Number(haversineKm(origin, { lat, lon }).toFixed(2)) : null,
      lat,
      lon,
      address: place.formattedAddress ?? null,
      source: this.name,
    };
  }

  private async mapPlaces(
    places: GooglePlace[],
    origin: { lat: number; lon: number } | null,
  ): Promise<PlaceDTO[]> {
    const valid = places.filter((place) => place.id && place.displayName?.text);
    return Promise.all(valid.map((place) => this.toDto(place, origin)));
  }

  private async runSearch(url: string, body: Record<string, unknown>): Promise<GooglePlace[]> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(SEARCH_FIELD_MASK),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as GoogleSearchResponse;
      return Array.isArray(data.places) ? data.places : [];
    } catch {
      return [];
    }
  }

  async getNearby({ lat, lon, radiusKm = 5, limit }: NearbyParams): Promise<PlaceDTO[]> {
    const body: Record<string, unknown> = {
      maxResultCount: Math.min(limit, MAX_RESULTS),
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius: Math.min(Math.round(radiusKm * 1000), 50000),
        },
      },
    };
    if (this.includedTypes.length > 0) {
      body.includedTypes = this.includedTypes;
    }
    const places = this.filterByTypes(await this.runSearch(`${GOOGLE_BASE}/places:searchNearby`, body));
    return this.mapPlaces(places, { lat, lon });
  }

  async getTopRated({ limit }: TopRatedParams): Promise<PlaceDTO[]> {
    const body: Record<string, unknown> = {
      maxResultCount: Math.min(limit, MAX_RESULTS),
      rankPreference: 'POPULARITY',
      locationRestriction: {
        circle: {
          center: { latitude: env.PLACES_DEFAULT_LAT, longitude: env.PLACES_DEFAULT_LON },
          radius: 20000,
        },
      },
    };
    if (this.includedTypes.length > 0) {
      body.includedTypes = this.includedTypes;
    }
    const places = this.filterByTypes(await this.runSearch(`${GOOGLE_BASE}/places:searchNearby`, body));
    // Google doesn't sort by rating server-side; do it here for a "top rated" feel.
    const sorted = places.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return this.mapPlaces(sorted, null);
  }

  async search({ query, limit, lat, lon }: SearchParams): Promise<PlaceDTO[]> {
    const hasOrigin = typeof lat === 'number' && typeof lon === 'number';
    const body: Record<string, unknown> = {
      textQuery: query,
      maxResultCount: Math.min(limit, MAX_RESULTS),
    };
    if (hasOrigin) {
      body.locationBias = {
        circle: { center: { latitude: lat, longitude: lon }, radius: 20000 },
      };
    }
    // Text Search only accepts a single `includedType`, so restrict client-side
    // to honour the full multi-category allow-list.
    const places = this.filterByTypes(await this.runSearch(`${GOOGLE_BASE}/places:searchText`, body));
    return this.mapPlaces(places, hasOrigin ? { lat: lat!, lon: lon! } : null);
  }

  async getDetails(id: string): Promise<PlaceDetailDTO | null> {
    try {
      const response = await fetch(`${GOOGLE_BASE}/places/${encodeURIComponent(id)}`, {
        headers: this.headers(DETAIL_FIELD_MASK),
      });
      if (!response.ok) {
        return null;
      }
      const place = (await response.json()) as GooglePlace;
      if (!place.id) {
        return null;
      }

      const photoNames = (place.photos ?? []).slice(0, 6).map((photo) => photo.name);
      const photos = (await Promise.all(photoNames.map((name) => this.resolvePhoto(name)))).filter(
        (url): url is string => Boolean(url),
      );

      const lat = place.location?.latitude ?? 0;
      const lon = place.location?.longitude ?? 0;

      return {
        id: place.id,
        name: place.displayName?.text ?? 'Unknown place',
        category: categoryName(place),
        imageUrl: photos[0] ?? null,
        rating: toRating(place.rating),
        distanceKm: null,
        lat,
        lon,
        address: place.formattedAddress ?? null,
        source: this.name,
        description: place.editorialSummary?.text ?? null,
        website: place.websiteUri ?? null,
        wikipediaUrl: null,
        photos,
      };
    } catch {
      return null;
    }
  }
}
