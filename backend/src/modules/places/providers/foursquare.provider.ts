import { env } from '../../../config/env';
import {
  type NearbyParams,
  type PlaceDetailDTO,
  type PlaceDTO,
  type PlacesProvider,
  type SearchParams,
  type TopRatedParams,
} from '../place.types';

const FSQ_BASE = 'https://places-api.foursquare.com/places';

// "Core" fields are free on every Foursquare tier.
const CORE_SEARCH_FIELDS = [
  'fsq_place_id',
  'name',
  'latitude',
  'longitude',
  'categories',
  'distance',
  'location',
];

// `website`, `tel` and `social_media` come back on the free tier too.
const CORE_DETAIL_EXTRAS = ['website', 'tel', 'social_media'];

// "Pro" fields are billed and require account credits. Requesting them on a
// credit-less account returns HTTP 429/4xx, so they are gated behind a toggle
// (env default, overridable from the admin panel) and a graceful fallback.
const PRO_SEARCH_FIELDS = ['photos', 'rating'];
const PRO_DETAIL_EXTRAS = ['description', 'hours'];

// Requested image size for Foursquare photo URLs (prefix + size + suffix).
const PHOTO_SIZE = '800x600';

type FsqIcon = { prefix?: string; suffix?: string };

type FsqCategory = {
  fsq_category_id?: string;
  name?: string;
  short_name?: string;
  plural_name?: string;
  icon?: FsqIcon;
};

type FsqPhoto = {
  prefix?: string;
  suffix?: string;
  width?: number;
  height?: number;
};

type FsqLocation = {
  formatted_address?: string;
  address?: string;
  locality?: string;
  region?: string;
  country?: string;
};

type FsqPlace = {
  fsq_place_id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  categories?: FsqCategory[];
  distance?: number;
  location?: FsqLocation;
  photos?: FsqPhoto[];
  rating?: number;
  website?: string;
  tel?: string;
  description?: string;
  social_media?: { website?: string };
};

type FsqSearchResponse = { results?: FsqPlace[] };

function buildPhotoUrl(photo: FsqPhoto | undefined): string | null {
  if (photo?.prefix && photo.suffix) {
    return `${photo.prefix}${PHOTO_SIZE}${photo.suffix}`;
  }
  return null;
}

/** First usable real photo URL from a list, or null (no dummy fallback). */
function photoUrl(photos: FsqPhoto[] | undefined): string | null {
  return buildPhotoUrl(photos?.find((p) => p.prefix && p.suffix));
}

function categoryName(categories: FsqCategory[] | undefined): string | null {
  const first = categories?.find((c) => c.name || c.short_name);
  return first?.name ?? first?.short_name ?? null;
}

function formatAddress(location: FsqLocation | undefined): string | null {
  if (!location) {
    return null;
  }
  if (location.formatted_address) {
    return location.formatted_address;
  }
  const parts = [location.address, location.locality, location.region, location.country].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

function toRating(rating: number | undefined): number | null {
  return typeof rating === 'number' && Number.isFinite(rating)
    ? Number(rating.toFixed(1))
    : null;
}

export class FoursquareProvider implements PlacesProvider {
  readonly name = 'foursquare';

  private readonly apiKey: string;

  private readonly proFields: boolean;

  constructor(apiKey: string, options: { proFields?: boolean } = {}) {
    this.apiKey = apiKey;
    this.proFields = options.proFields ?? false;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-Places-Api-Version': env.FOURSQUARE_API_VERSION,
      Accept: 'application/json',
    };
  }

  private searchFields(pro: boolean): string {
    return [...CORE_SEARCH_FIELDS, ...(pro ? PRO_SEARCH_FIELDS : [])].join(',');
  }

  private detailFields(pro: boolean): string {
    return [
      ...CORE_SEARCH_FIELDS,
      ...CORE_DETAIL_EXTRAS,
      ...(pro ? [...PRO_SEARCH_FIELDS, ...PRO_DETAIL_EXTRAS] : []),
    ].join(',');
  }

  private toDto(place: FsqPlace, hasOrigin: boolean): PlaceDTO {
    const id = place.fsq_place_id ?? '';
    return {
      id,
      name: place.name ?? 'Unknown place',
      category: categoryName(place.categories),
      imageUrl: photoUrl(place.photos),
      rating: toRating(place.rating),
      distanceKm:
        hasOrigin && typeof place.distance === 'number'
          ? Number((place.distance / 1000).toFixed(2))
          : null,
      lat: place.latitude ?? 0,
      lon: place.longitude ?? 0,
      address: formatAddress(place.location),
      source: this.name,
    };
  }

  // Runs the search request with the requested fields. When Pro fields are
  // enabled but the request fails (e.g. no credits → 429/4xx), it retries once
  // with free Core fields so places keep working (just without photos/ratings).
  private async fetchSearch(base: URLSearchParams): Promise<FsqPlace[]> {
    const run = async (pro: boolean): Promise<Response> => {
      const params = new URLSearchParams(base);
      params.set('fields', this.searchFields(pro));
      return fetch(`${FSQ_BASE}/search?${params.toString()}`, { headers: this.headers });
    };

    try {
      let response = await run(this.proFields);
      if (!response.ok && this.proFields) {
        response = await run(false);
      }
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as FsqSearchResponse;
      const results = Array.isArray(data.results) ? data.results : [];
      return results.filter((place) => place.fsq_place_id && place.name);
    } catch {
      return [];
    }
  }

  async getNearby({ lat, lon, radiusKm = 5, limit }: NearbyParams): Promise<PlaceDTO[]> {
    const params = new URLSearchParams({
      ll: `${lat},${lon}`,
      radius: String(Math.min(Math.round(radiusKm * 1000), 100000)),
      sort: 'DISTANCE',
      limit: String(Math.min(limit, 50)),
    });
    const results = await this.fetchSearch(params);
    return results.map((place) => this.toDto(place, true));
  }

  async getTopRated({ limit }: TopRatedParams): Promise<PlaceDTO[]> {
    const params = new URLSearchParams({
      ll: `${env.PLACES_DEFAULT_LAT},${env.PLACES_DEFAULT_LON}`,
      radius: '22000',
      sort: 'RATING',
      limit: String(Math.min(limit, 50)),
    });
    const results = await this.fetchSearch(params);
    return results.map((place) => this.toDto(place, false));
  }

  async search({ query, limit, lat, lon }: SearchParams): Promise<PlaceDTO[]> {
    const hasOrigin = typeof lat === 'number' && typeof lon === 'number';
    const params = new URLSearchParams({
      query,
      ll: hasOrigin ? `${lat},${lon}` : `${env.PLACES_DEFAULT_LAT},${env.PLACES_DEFAULT_LON}`,
      sort: 'RELEVANCE',
      limit: String(Math.min(limit, 50)),
    });
    const results = await this.fetchSearch(params);
    return results.map((place) => this.toDto(place, hasOrigin));
  }

  /**
   * Fetches real photos from the dedicated Place Photos endpoint
   * (https://docs.foursquare.com/.../place-photos). Billed "Pro", so it is only
   * called when Pro fields are enabled; failures degrade to an empty gallery.
   */
  private async fetchPhotos(id: string, limit = 10): Promise<string[]> {
    if (!this.proFields) {
      return [];
    }
    try {
      const params = new URLSearchParams({ limit: String(Math.min(limit, 50)), sort: 'POPULAR' });
      const response = await fetch(
        `${FSQ_BASE}/${encodeURIComponent(id)}/photos?${params.toString()}`,
        { headers: this.headers },
      );
      if (!response.ok) {
        return [];
      }
      // The endpoint returns a bare array; tolerate a wrapped shape too.
      const data = (await response.json()) as FsqPhoto[] | { results?: FsqPhoto[] };
      const photos = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
      return photos
        .map((photo) => buildPhotoUrl(photo))
        .filter((url): url is string => Boolean(url));
    } catch {
      return [];
    }
  }

  async getDetails(id: string): Promise<PlaceDetailDTO | null> {
    const run = async (pro: boolean): Promise<Response> => {
      const params = new URLSearchParams({ fields: this.detailFields(pro) });
      return fetch(`${FSQ_BASE}/${encodeURIComponent(id)}?${params.toString()}`, {
        headers: this.headers,
      });
    };

    try {
      const [detailResult, galleryPhotos] = await Promise.all([
        (async () => {
          let response = await run(this.proFields);
          if (!response.ok && this.proFields) {
            response = await run(false);
          }
          return response;
        })(),
        this.fetchPhotos(id),
      ]);

      if (!detailResult.ok) {
        return null;
      }
      const place = (await detailResult.json()) as FsqPlace;
      if (!place.fsq_place_id || !place.name) {
        return null;
      }

      const base = this.toDto(place, false);
      // Prefer real gallery photos; fall back to the inline search-field photo.
      const photos = galleryPhotos.length > 0 ? galleryPhotos : base.imageUrl ? [base.imageUrl] : [];

      return {
        ...base,
        imageUrl: photos[0] ?? base.imageUrl,
        photos,
        description: place.description ?? null,
        website: place.website ?? place.social_media?.website ?? null,
        wikipediaUrl: null,
      };
    } catch {
      return null;
    }
  }
}
