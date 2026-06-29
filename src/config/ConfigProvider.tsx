import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchAppConfig } from '../api/configApi';

const CACHE_KEY = '@whereabout/app_config';

/**
 * Default values for every admin-managed constant. These mirror the backend
 * seed config and are used as a fallback whenever a key is missing or the
 * network is unavailable, so the UI always renders sensible text.
 *
 * Keep this in sync with DEFAULT_APP_CONFIG in the backend admin.service.
 */
export const DEFAULT_APP_TEXT: Record<string, string> = {
  app_name: 'Crave',
  support_email: 'support@whereabout.app',
  about_text: 'Crave helps you discover places and friends around you.',
  maintenance_message: '',
  min_supported_version: '1.0.0',

  // Brand / accent colour (hex). Applied at startup from cache; see index.js.
  'theme.brand_color': '#52BAD7',

  terms_url: 'https://whereabout.app/terms',
  privacy_url: 'https://whereabout.app/privacy',
  help_url: 'https://whereabout.app/help',
  website_url: 'https://whereabout.app',

  'welcome.taglines': 'Discover cool new places\nShare the sports you love\nMeet with new people',
  'welcome.new_user_button': "I'm new to Crave",
  'welcome.existing_account_button': 'I have an account',

  'home.meet_friends_title': 'Meet Friends',
  'home.discover_title': 'Discover Top Places',
  'home.discover_near_title': 'Discover Places Near You',
  'home.discover_in_place_title': 'Discover Places in {place}',
  'home.latest_posts_title': 'Latest Posts',
  'home.recommended_places_title': 'Recommended Places by Friend',
  'home.meet_people_title': 'Meet People',
  'home.view_all_label': 'View all',
  'home.search_placeholder': 'Search friends, places, posts…',

  // Google Maps SDK keys (friends map). Loaded from admin maps-config.
  'maps.google_android_api_key': '',
  'maps.google_ios_api_key': '',
  // Map camera zoom when centered on the user (10–20). Loaded from admin maps-config.
  'maps.default_zoom': '16',
};

// Module-level snapshot so non-React code (e.g. event handlers, utilities) can
// read constants synchronously without the hook.
let activeConfig: Record<string, string> = { ...DEFAULT_APP_TEXT };

function mergeWithDefaults(config: Record<string, string>): Record<string, string> {
  return { ...DEFAULT_APP_TEXT, ...config };
}

/** Synchronous getter for use outside React components. */
export function getAppText(key: string, fallback?: string): string {
  return activeConfig[key] ?? fallback ?? DEFAULT_APP_TEXT[key] ?? '';
}

type ConfigContextValue = {
  config: Record<string, string>;
  ready: boolean;
};

const ConfigContext = createContext<ConfigContextValue>({
  config: { ...DEFAULT_APP_TEXT },
  ready: false,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Record<string, string>>(() => ({ ...DEFAULT_APP_TEXT }));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const apply = (next: Record<string, string>) => {
      const merged = mergeWithDefaults(next);
      activeConfig = merged;
      if (active) {
        setConfig(merged);
      }
    };

    // 1) Instant load from cache so text isn't blank on first paint.
    void AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            apply(JSON.parse(raw) as Record<string, string>);
          } catch {
            // ignore corrupt cache
          }
        }
      })
      .catch(() => undefined);

    // 2) Refresh from the backend and update the cache.
    void fetchAppConfig()
      .then((fresh) => {
        apply(fresh);
        return AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<ConfigContextValue>(() => ({ config, ready }), [config, ready]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** Reactive single-string lookup. */
export function useAppText(key: string, fallback?: string): string {
  const { config } = useContext(ConfigContext);
  return config[key] ?? fallback ?? DEFAULT_APP_TEXT[key] ?? '';
}

/** Reactive list lookup: splits a newline-separated value into trimmed lines. */
export function useAppList(key: string, fallback: readonly string[] = []): string[] {
  const { config } = useContext(ConfigContext);
  const raw = config[key] ?? DEFAULT_APP_TEXT[key];
  if (!raw) {
    return [...fallback];
  }
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [...fallback];
}

export function useAppConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
