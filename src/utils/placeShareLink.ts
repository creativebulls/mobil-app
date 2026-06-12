/**
 * Public base URL for WhereAbout. Shared place links point here; opening one
 * deep-links into the place detail screen inside the app.
 */
export const WEB_BASE_URL = 'https://mobilevps.tech';

export function buildPlaceShareUrl(placeId: string): string {
  return `${WEB_BASE_URL}/places/${encodeURIComponent(placeId)}`;
}

export function buildPlaceShareMessage(name: string, placeId: string): string {
  return `Check out ${name} on WhereAbout!\n${buildPlaceShareUrl(placeId)}`;
}
