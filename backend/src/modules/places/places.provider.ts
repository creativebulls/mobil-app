import { env, isDevelopment } from '../../config/env';
import {
  foursquareIdsForKeys,
  googleTypesForKeys,
  sanitizeCategoryKeys,
} from './place.categories';
import type { PlacesProvider } from './place.types';
import { FoursquareProvider } from './providers/foursquare.provider';
import { GooglePlacesProvider } from './providers/google.provider';
import { OpenTripMapProvider } from './providers/openTripMap.provider';
import { SampleProvider } from './providers/sample.provider';

export type PlacesProviderName = 'foursquare' | 'google' | 'opentripmap' | 'sample';

let provider: PlacesProvider | null = null;

// Admin-selected active provider. When set it overrides PLACES_PROVIDER so the
// integration can be switched entirely from the admin UI without editing env.
let providerOverride: PlacesProviderName | null = null;

// Foursquare key configured at runtime from the admin panel. When set it takes
// precedence over the env var.
let foursquareKeyOverride: string | null = null;

// Admin override for the Foursquare "Pro fields" (photos/ratings) toggle.
let foursquareProOverride: boolean | null = null;

// Google Places key configured at runtime from the admin panel.
let googleKeyOverride: string | null = null;

// Admin-selected place category keys to restrict results to. Empty = all types.
let categoryKeys: string[] = [];

/** The active provider (admin override wins over env). */
export function getEffectiveProvider(): PlacesProviderName {
  return providerOverride ?? (env.PLACES_PROVIDER as PlacesProviderName);
}

/** Sets (or clears with null) the admin-selected provider and rebuilds it. */
export function setProviderOverride(name: PlacesProviderName | null): void {
  providerOverride = name;
  provider = null;
}

/** Returns the active Foursquare key (admin override wins over env). */
export function getEffectiveFoursquareKey(): string | null {
  return foursquareKeyOverride ?? env.FOURSQUARE_API_KEY ?? null;
}

/** Whether Pro fields (photos/ratings) are enabled (admin override wins over env). */
export function getEffectiveFoursquareProFields(): boolean {
  return foursquareProOverride ?? env.FOURSQUARE_ENABLE_PRO_FIELDS === 'true';
}

/** Sets (or clears with null) the admin Pro-fields toggle and rebuilds the provider. */
export function setFoursquareProOverride(enabled: boolean | null): void {
  foursquareProOverride = enabled;
  provider = null;
}

/** Source of the active Foursquare key, for admin display. */
export function getFoursquareKeySource(): 'admin' | 'env' | null {
  if (foursquareKeyOverride) {
    return 'admin';
  }
  if (env.FOURSQUARE_API_KEY) {
    return 'env';
  }
  return null;
}

/**
 * Sets (or clears with null) the admin-managed Foursquare key and forces the
 * cached provider to be rebuilt on next use.
 */
export function setFoursquareKeyOverride(key: string | null): void {
  const trimmed = key?.trim();
  foursquareKeyOverride = trimmed ? trimmed : null;
  provider = null;
}

/** Returns the active Google Places key (admin override wins over env). */
export function getEffectiveGoogleKey(): string | null {
  return googleKeyOverride ?? env.GOOGLE_PLACES_API_KEY ?? null;
}

/** Source of the active Google Places key, for admin display. */
export function getGoogleKeySource(): 'admin' | 'env' | null {
  if (googleKeyOverride) {
    return 'admin';
  }
  if (env.GOOGLE_PLACES_API_KEY) {
    return 'env';
  }
  return null;
}

/**
 * Sets (or clears with null) the admin-managed Google Places key and forces the
 * cached provider to be rebuilt on next use.
 */
export function setGoogleKeyOverride(key: string | null): void {
  const trimmed = key?.trim();
  googleKeyOverride = trimmed ? trimmed : null;
  provider = null;
}

/** The selected place category keys (empty = fetch all types). */
export function getPlaceCategoryKeys(): string[] {
  return categoryKeys;
}

/** Sets the selected place category keys and rebuilds the provider. */
export function setPlaceCategoryKeys(keys: string[]): void {
  categoryKeys = sanitizeCategoryKeys(keys);
  provider = null;
}

function buildFoursquare(): PlacesProvider {
  const proFields = getEffectiveFoursquareProFields();
  const key = getEffectiveFoursquareKey();
  if (key) {
    return new FoursquareProvider(key, {
      proFields,
      categoryIds: foursquareIdsForKeys(categoryKeys),
    });
  }
  if (isDevelopment) {
    console.warn('[places] No Foursquare key set — falling back to the sample provider.');
  }
  return new SampleProvider();
}

function buildGoogle(): PlacesProvider {
  const key = getEffectiveGoogleKey();
  if (key) {
    return new GooglePlacesProvider(key, { includedTypes: googleTypesForKeys(categoryKeys) });
  }
  if (isDevelopment) {
    console.warn('[places] No Google Places key set — falling back to the sample provider.');
  }
  return new SampleProvider();
}

function createProvider(): PlacesProvider {
  switch (getEffectiveProvider()) {
    case 'foursquare':
      return buildFoursquare();
    case 'google':
      return buildGoogle();
    case 'opentripmap': {
      if (env.OPENTRIPMAP_API_KEY) {
        return new OpenTripMapProvider(env.OPENTRIPMAP_API_KEY);
      }
      if (isDevelopment) {
        console.warn(
          '[places] OPENTRIPMAP_API_KEY is not set — falling back to the sample provider.',
        );
      }
      return new SampleProvider();
    }
    case 'sample':
    default:
      return new SampleProvider();
  }
}

export function getPlacesProvider(): PlacesProvider {
  if (!provider) {
    provider = createProvider();
  }
  return provider;
}
