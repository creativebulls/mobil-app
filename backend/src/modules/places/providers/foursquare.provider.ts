import { env } from '../../../config/env';
import {
  fallbackImage,
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
// credit-less account returns HTTP 429, so they are gated behind an env flag.
const PRO_SEARCH_FIELDS = ['photos', 'rating'];
const PRO_DETAIL_EXTRAS = ['description', 'hours'];

const proFieldsEnabled = env.FOURSQUARE_ENABLE_PRO_FIELDS === 'true';

const SEARCH_FIELDS = [
  ...CORE_SEARCH_FIELDS,
  ...(proFieldsEnabled ? PRO_SEARCH_FIELDS : []),
].join(',');

const DETAIL_FIELDS = [
  ...CORE_SEARCH_FIELDS,
  ...CORE_DETAIL_EXTRAS,
  ...(proFieldsEnabled ? [...PRO_SEARCH_FIELDS, ...PRO_DETAIL_EXTRAS] : []),
].join(',');

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

function photoUrl(photos: FsqPhoto[] | undefined, seed: string): string {
  const photo = photos?.find((p) => p.prefix && p.suffix);
  if (photo?.prefix && photo.suffix) {
    return `${photo.prefix}original${photo.suffix}`;
  }
  return fallbackImage(seed);
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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'X-Places-Api-Version': env.FOURSQUARE_API_VERSION,
      Accept: 'application/json',
    };
  }

  private toDto(place: FsqPlace, hasOrigin: boolean): PlaceDTO {
    const id = place.fsq_place_id ?? '';
    return {
      id,
      name: place.name ?? 'Unknown place',
      category: categoryName(place.categories),
      imageUrl: photoUrl(place.photos, id || place.name || 'place'),
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

  private async fetchSearch(params: URLSearchParams): Promise<FsqPlace[]> {
    try {
      const response = await fetch(`${FSQ_BASE}/search?${params.toString()}`, {
        headers: this.headers,
      });
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
      fields: SEARCH_FIELDS,
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
      fields: SEARCH_FIELDS,
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
      fields: SEARCH_FIELDS,
    });
    const results = await this.fetchSearch(params);
    return results.map((place) => this.toDto(place, hasOrigin));
  }

  async getDetails(id: string): Promise<PlaceDetailDTO | null> {
    try {
      const params = new URLSearchParams({ fields: DETAIL_FIELDS });
      const response = await fetch(
        `${FSQ_BASE}/${encodeURIComponent(id)}?${params.toString()}`,
        { headers: this.headers },
      );
      if (!response.ok) {
        return null;
      }
      const place = (await response.json()) as FsqPlace;
      if (!place.fsq_place_id || !place.name) {
        return null;
      }

      const base = this.toDto(place, false);
      return {
        ...base,
        description: place.description ?? null,
        website: place.website ?? place.social_media?.website ?? null,
        wikipediaUrl: null,
      };
    } catch {
      return null;
    }
  }
}
