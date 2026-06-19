import { env, isDevelopment } from '../../config/env';
import type { PlacesProvider } from './place.types';
import { FoursquareProvider } from './providers/foursquare.provider';
import { OpenTripMapProvider } from './providers/openTripMap.provider';
import { SampleProvider } from './providers/sample.provider';

let provider: PlacesProvider | null = null;

// Foursquare key configured at runtime from the admin panel. When set it takes
// precedence over the env var and forces the Foursquare provider, so the
// integration can be managed entirely from the admin UI without editing env.
let foursquareKeyOverride: string | null = null;

/** Returns the active Foursquare key (admin override wins over env). */
export function getEffectiveFoursquareKey(): string | null {
  return foursquareKeyOverride ?? env.FOURSQUARE_API_KEY ?? null;
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

function createProvider(): PlacesProvider {
  // An admin-configured key always wins and forces the Foursquare provider so
  // the key can be managed from the admin panel without touching env vars.
  if (foursquareKeyOverride) {
    return new FoursquareProvider(foursquareKeyOverride);
  }

  switch (env.PLACES_PROVIDER) {
    case 'foursquare': {
      if (env.FOURSQUARE_API_KEY) {
        return new FoursquareProvider(env.FOURSQUARE_API_KEY);
      }
      if (isDevelopment) {
        console.warn(
          '[places] FOURSQUARE_API_KEY is not set — falling back to the sample provider.',
        );
      }
      return new SampleProvider();
    }
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
    case 'google': {
      // Placeholder for a future GooglePlacesProvider implementation.
      if (isDevelopment) {
        console.warn(
          '[places] Google Places provider is not implemented yet — using the sample provider.',
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
