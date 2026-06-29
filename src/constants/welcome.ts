export const WELCOME_STORAGE_KEY = '@welcome_completed';

export const WELCOME_TAGLINES = [
  'Discover cool new places',
  'Share the sports you love',
  'Meet with new people',
] as const;

export const WELCOME_SLIDE_COUNT = 3;

export type WelcomeSlideCopyDefaults = {
  headlineLines: readonly string[];
  accentLine: string;
  bodyText: string;
};

export const WELCOME_SLIDE_1: WelcomeSlideCopyDefaults = {
  headlineLines: ['Discover.', 'Plan.', 'Experience.', 'Remember.'],
  accentLine: 'Experience.',
  bodyText:
    'Crave is your home for\nreal-life experiences\nwith the people who matter.',
};

export const WELCOME_SLIDE_2: WelcomeSlideCopyDefaults = {
  headlineLines: ['Connect.', 'Explore.', 'Together.', 'Anywhere.'],
  accentLine: 'Together.',
  bodyText:
    'Meet friends nearby, plan outings together,\nand turn trips and nights out into\nmemories worth sharing on Crave.',
};

export const WELCOME_SLIDE_3: WelcomeSlideCopyDefaults = {
  headlineLines: ['Find.', 'Local spots.', 'Share.', 'Moments.'],
  accentLine: 'Share.',
  bodyText:
    'Discover places friends love,\nexplore top-rated spots near you,\nand save the meals and moments\nyou will crave again.',
};

export const WELCOME_SLIDE_DEFAULTS = [WELCOME_SLIDE_1, WELCOME_SLIDE_2, WELCOME_SLIDE_3] as const;

/** @deprecated Use WELCOME_SLIDE_1 */
export const WELCOME_HEADLINE_LINES = WELCOME_SLIDE_1.headlineLines;

/** @deprecated Use WELCOME_SLIDE_1 */
export const WELCOME_BODY_TEXT = WELCOME_SLIDE_1.bodyText;
