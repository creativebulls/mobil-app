import { env } from '../../../config/env';
import {
  fallbackImage,
  humanizeCategory,
  type NearbyParams,
  type PlaceDetailDTO,
  type PlaceDTO,
  type PlacesProvider,
  type SearchParams,
  type TopRatedParams,
} from '../place.types';

const OTM_BASE = 'https://api.opentripmap.com/0.1/en/places';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

type OtmRadiusItem = {
  xid: string;
  name: string;
  dist?: number;
  rate?: number;
  kinds?: string;
  point: { lon: number; lat: number };
};

type OtmDetails = {
  xid: string;
  name: string;
  rate?: number | string;
  kinds?: string;
  preview?: { source?: string };
  image?: string;
  point?: { lon: number; lat: number };
  address?: Record<string, string>;
  url?: string;
  otm?: string;
  wikipedia?: string;
  info?: { descr?: string };
  wikipedia_extracts?: { text?: string };
};

type NominatimItem = {
  osm_type?: string;
  osm_id?: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  category?: string;
};

function formatAddress(address?: Record<string, string>): string | null {
  if (!address) {
    return null;
  }

  const parts = [
    address.neighbourhood ?? address.suburb ?? address.road,
    address.city ?? address.town ?? address.village ?? address.state,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

function toRating(rate: number | string | undefined): number | null {
  if (rate === undefined) {
    return null;
  }
  const numeric = typeof rate === 'string' ? parseFloat(rate) : rate;
  return Number.isFinite(numeric) ? numeric : null;
}

export class OpenTripMapProvider implements PlacesProvider {
  readonly name = 'opentripmap';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchRadius(
    lat: number,
    lon: number,
    radiusKm: number,
    limit: number,
  ): Promise<OtmRadiusItem[]> {
    const url = new URL(`${OTM_BASE}/radius`);
    url.searchParams.set('radius', String(Math.round(radiusKm * 1000)));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('rate', '2');
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit * 3));
    url.searchParams.set('apikey', this.apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OtmRadiusItem[];
    return Array.isArray(data) ? data.filter((item) => item.name && item.xid) : [];
  }

  private async fetchDetails(xid: string): Promise<OtmDetails | null> {
    try {
      const url = `${OTM_BASE}/xid/${encodeURIComponent(xid)}?apikey=${this.apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as OtmDetails;
    } catch {
      return null;
    }
  }

  private async enrich(item: OtmRadiusItem, origin?: { lat: number; lon: number }): Promise<PlaceDTO> {
    const details = await this.fetchDetails(item.xid);
    const image = details?.preview?.source || details?.image || fallbackImage(item.xid);

    return {
      id: item.xid,
      name: details?.name || item.name,
      category: humanizeCategory(details?.kinds ?? item.kinds),
      imageUrl: image,
      rating: toRating(details?.rate ?? item.rate),
      distanceKm:
        origin && typeof item.dist === 'number' ? Number((item.dist / 1000).toFixed(2)) : null,
      lat: item.point.lat,
      lon: item.point.lon,
      address: formatAddress(details?.address),
      source: this.name,
    };
  }

  private async buildPlaces(
    items: OtmRadiusItem[],
    limit: number,
    origin?: { lat: number; lon: number },
  ): Promise<PlaceDTO[]> {
    const ranked = items
      .slice()
      .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
      .slice(0, limit);

    return Promise.all(ranked.map((item) => this.enrich(item, origin)));
  }

  async getNearby({ lat, lon, radiusKm = 5, limit }: NearbyParams): Promise<PlaceDTO[]> {
    const items = await this.fetchRadius(lat, lon, radiusKm, limit);
    return this.buildPlaces(items, limit, { lat, lon });
  }

  async getTopRated({ limit }: TopRatedParams): Promise<PlaceDTO[]> {
    const items = await this.fetchRadius(
      env.PLACES_DEFAULT_LAT,
      env.PLACES_DEFAULT_LON,
      20,
      limit,
    );
    return this.buildPlaces(items, limit);
  }

  async getDetails(id: string): Promise<PlaceDetailDTO | null> {
    const details = await this.fetchDetails(id);
    if (!details || !details.name) {
      return null;
    }

    const point = details.point;
    const imageUrl = details.preview?.source || details.image || fallbackImage(id);

    return {
      id: details.xid ?? id,
      name: details.name,
      category: humanizeCategory(details.kinds),
      imageUrl,
      rating: toRating(details.rate),
      distanceKm: null,
      lat: point?.lat ?? 0,
      lon: point?.lon ?? 0,
      address: formatAddress(details.address),
      source: this.name,
      description: details.wikipedia_extracts?.text ?? details.info?.descr ?? null,
      website: details.url ?? details.otm ?? null,
      wikipediaUrl: details.wikipedia ?? null,
      photos: imageUrl ? [imageUrl] : [],
    };
  }

  async search({ query, limit }: SearchParams): Promise<PlaceDTO[]> {
    const url = new URL(NOMINATIM_BASE);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': env.PLACES_USER_AGENT },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as NominatimItem[];
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item) => {
      const id = `${item.osm_type ?? 'osm'}-${item.osm_id ?? item.display_name}`;
      const name = item.name || item.display_name.split(',')[0];

      return {
        id,
        name,
        category: humanizeCategory(item.type ?? item.category ?? null),
        imageUrl: fallbackImage(id),
        rating: null,
        distanceKm: null,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        address: item.display_name,
        source: 'nominatim',
      };
    });
  }
}
