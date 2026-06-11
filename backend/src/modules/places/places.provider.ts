import { env, isDevelopment } from '../../config/env';
import type { PlacesProvider } from './place.types';
import { OpenTripMapProvider } from './providers/openTripMap.provider';
import { SampleProvider } from './providers/sample.provider';

let provider: PlacesProvider | null = null;

function createProvider(): PlacesProvider {
  switch (env.PLACES_PROVIDER) {
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
