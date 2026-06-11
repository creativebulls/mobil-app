import { apiRequest } from './client';
import type {
  FeedResponse,
  PlaceComment,
  PlaceCommentsResponse,
  PlaceDetail,
  PlaceEngagement,
  PlacesResponse,
} from './types';

/**
 * Fetch places from the backend. When `lat`/`lon` are provided the backend
 * returns nearby places; otherwise it returns top-rated places. The underlying
 * data source (OpenTripMap today, Google Places later) is swapped server-side.
 */
export async function fetchPlaces(input?: {
  lat?: number | null;
  lon?: number | null;
  limit?: number;
}): Promise<PlacesResponse> {
  const params = new URLSearchParams();

  if (typeof input?.lat === 'number' && typeof input?.lon === 'number') {
    params.set('lat', String(input.lat));
    params.set('lon', String(input.lon));
  }

  if (input?.limit) {
    params.set('limit', String(input.limit));
  }

  const query = params.toString();
  return apiRequest<PlacesResponse>(`/places${query ? `?${query}` : ''}`);
}

export async function fetchPlaceDetails(id: string): Promise<PlaceDetail> {
  return apiRequest<PlaceDetail>(`/places/${encodeURIComponent(id)}`);
}

export async function fetchPlaceEngagement(id: string): Promise<PlaceEngagement> {
  return apiRequest<PlaceEngagement>(`/places/${encodeURIComponent(id)}/engagement`);
}

export async function togglePlaceLike(
  id: string,
): Promise<{ liked: boolean; likeCount: number }> {
  return apiRequest(`/places/${encodeURIComponent(id)}/like`, { method: 'POST', body: {} });
}

export async function recordPlaceVisit(id: string): Promise<{ visitorCount: number }> {
  return apiRequest(`/places/${encodeURIComponent(id)}/visit`, { method: 'POST', body: {} });
}

export async function fetchPlaceComments(
  id: string,
  cursor?: string | null,
): Promise<PlaceCommentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (cursor) {
    params.set('before', cursor);
  }
  return apiRequest<PlaceCommentsResponse>(
    `/places/${encodeURIComponent(id)}/comments?${params.toString()}`,
  );
}

export async function addPlaceComment(
  id: string,
  text: string,
): Promise<{ comment: PlaceComment; commentCount: number }> {
  return apiRequest(`/places/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: { text },
  });
}

export async function fetchPlacePosts(
  id: string,
  cursor?: string | null,
): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set('limit', '20');
  if (cursor) {
    params.set('before', cursor);
  }
  return apiRequest<FeedResponse>(
    `/places/${encodeURIComponent(id)}/posts?${params.toString()}`,
  );
}

export async function searchPlaces(
  query: string,
  location?: { lat?: number | null; lon?: number | null },
): Promise<PlacesResponse> {
  const params = new URLSearchParams();
  params.set('q', query);

  if (typeof location?.lat === 'number' && typeof location?.lon === 'number') {
    params.set('lat', String(location.lat));
    params.set('lon', String(location.lon));
  }

  return apiRequest<PlacesResponse>(`/places/search?${params.toString()}`);
}
