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
import { configureGoogleSignInFromConfig } from '../auth/googleSignInConfig';

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
  'welcome.skip_link': 'Skip',
  'welcome.headline_lines': 'Discover.\nPlan.\nExperience.\nRemember.',
  'welcome.headline_accent_line': 'Experience.',
  'welcome.body_text':
    'Crave is your home for\nreal-life experiences\nwith the people who matter.',
  'welcome.slide2.headline_lines': 'Connect.\nExplore.\nTogether.\nAnywhere.',
  'welcome.slide2.headline_accent_line': 'Together.',
  'welcome.slide2.body_text':
    'Meet friends nearby, plan outings together,\nand turn trips and nights out into\nmemories worth sharing on Crave.',
  'welcome.slide3.headline_lines': 'Find.\nLocal spots.\nShare.\nMoments.',
  'welcome.slide3.headline_accent_line': 'Share.',
  'welcome.slide3.body_text':
    'Discover places friends love,\nexplore top-rated spots near you,\nand save the meals and moments\nyou will crave again.',
  'welcome.next_button': 'Next',

  // Splash / first-run landing screen (one tagline per line).
  'splash.taglines': 'Real experiences.\nReal people.\nRemember more.',
  'splash.get_started_button': 'Get started',
  'splash.get_started_button_color': '#FD4301',
  'splash.explore_guest_link': 'Explore as guest',

  'sign_in.title': 'Welcome back 👋',
  'sign_in.subtitle': 'Log in to continue your journey.',
  'sign_in.apple_button': 'Continue with Apple',
  'sign_in.google_button': 'Continue with Google',
  'sign_in.divider': 'or',
  'sign_in.login_id_label': 'Email or phone number',
  'sign_in.login_id_placeholder': 'Enter your email or phone number',
  'sign_in.password_label': 'Password',
  'sign_in.password_placeholder': 'Enter your password',
  'sign_in.forgot_password': 'Forgot password?',
  'sign_in.submit_button': 'Log in',
  'sign_in.footer_text': "Don't have an account?",
  'sign_in.register_link': 'Register',
  'sign_in.social_unavailable':
    'Social sign-in is coming soon. Use email or phone for now.',

  'sign_up.title': 'Create your account',
  'sign_up.subtitle': "Let's get you set up.",
  'sign_up.progress_label': 'Step {step} of {total}',
  'sign_up.apple_button': 'Continue with Apple',
  'sign_up.google_button': 'Continue with Google',
  'sign_up.email_label': 'Email',
  'sign_up.email_placeholder': 'Enter your email',
  'sign_up.password_label': 'Password',
  'sign_up.password_placeholder': 'Create a password',
  'sign_up.confirm_password_label': 'Confirm password',
  'sign_up.confirm_password_placeholder': 'Re-enter your password',
  'sign_up.password_req_length': 'At least 8 characters',
  'sign_up.password_req_number': 'Includes a number',
  'sign_up.password_req_uppercase': 'Includes an uppercase letter',
  'sign_up.account_type_label': 'I am',
  'sign_up.individual_label': 'Individual',
  'sign_up.business_label': 'Business',
  'sign_up.consent_prefix': "I agree to Crave's",
  'sign_up.consent_terms': 'Terms of Service',
  'sign_up.consent_conjunction': 'and',
  'sign_up.consent_privacy': 'Privacy Policy',
  'sign_up.submit_button': 'Create account',
  'sign_up.continue_button': 'Continue',
  'sign_up.step1.title': 'Create your account',
  'sign_up.step1.subtitle': 'Enter your email to get started.',
  'sign_up.step2.title': 'Create a password',
  'sign_up.step2.subtitle': 'Choose a secure password for your account.',
  'sign_up.step3.title': 'Choose account type',
  'sign_up.step3.subtitle': 'Are you signing up as an individual or a business?',
  'sign_up.step4.title': 'Review and accept',
  'sign_up.step4.subtitle': 'Accept our terms to finish creating your account.',
  'sign_up.footer_text': 'Already have an account?',
  'sign_up.login_link': 'Log in',
  'sign_up.social_unavailable': 'Social sign-up is coming soon. Use email for now.',

  'registration.business_accounts_enabled': 'true',
  'registration.progress_step': '1',
  'registration.progress_total': '4',
  'registration.individual_info':
    'For personal use. Discover places, connect with friends, and share your experiences on Crave.',
  'registration.business_info':
    'For venues, brands, and teams. Promote your location and reach local customers on Crave.',
  'registration.business_unavailable_message': 'Business accounts are not available right now.',
  'registration.individual_label': 'Individual',
  'registration.business_label': 'Business',

  'auth.apple.enabled': 'false',
  'auth.apple.client_id': '',
  'auth.google.enabled': 'false',
  'auth.google.web_client_id': '',
  'auth.google.ios_client_id': '',
  'auth.google.android_client_id': '',

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
      configureGoogleSignInFromConfig(merged);
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
