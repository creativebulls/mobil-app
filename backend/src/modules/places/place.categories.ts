/**
 * Curated catalog of place categories the admin can allow. Each entry maps a
 * stable `key` (stored in the DB / sent to the admin UI) to provider-specific
 * type identifiers:
 *   - `google`: Google Places (New) "Table A" types used as `includedTypes`.
 *   - `foursquare`: classic Foursquare category IDs used as `fsq_category_ids`.
 *
 * When no categories are selected, providers fetch everything (no filter).
 */
export type PlaceCategory = {
  key: string;
  label: string;
  google: string[];
  foursquare: string[];
};

export const PLACE_CATEGORIES: PlaceCategory[] = [
  {
    key: 'restaurant',
    label: 'Restaurants',
    google: ['restaurant'],
    foursquare: ['4d4b7105d754a06374d81259'],
  },
  {
    key: 'dining',
    label: 'Dining (fast food, bakery)',
    google: ['meal_takeaway', 'bakery', 'fast_food_restaurant'],
    foursquare: ['4bf58dd8d48988d16e941735', '4bf58dd8d48988d16a941735'],
  },
  {
    key: 'cafe',
    label: 'Cafés & Coffee',
    google: ['cafe', 'coffee_shop'],
    foursquare: ['4bf58dd8d48988d16d941735', '4bf58dd8d48988d1e0931735'],
  },
  {
    key: 'bar',
    label: 'Bars & Nightlife',
    google: ['bar', 'night_club'],
    foursquare: ['4d4b7105d754a06376d81259'],
  },
  {
    key: 'hotel',
    label: 'Hotels & Lodging',
    google: ['hotel', 'lodging'],
    foursquare: ['4bf58dd8d48988d1fa931735'],
  },
  {
    key: 'party_hall',
    label: 'Party / Event halls',
    google: ['event_venue', 'banquet_hall', 'wedding_venue'],
    foursquare: ['4bf58dd8d48988d171941735', '4bf58dd8d48988d1ed941735'],
  },
  {
    key: 'tourist',
    label: 'Tourist attractions',
    google: ['tourist_attraction'],
    foursquare: ['4d4b7105d754a06377d81259'],
  },
  {
    key: 'park',
    label: 'Parks & Outdoors',
    google: ['park'],
    foursquare: ['4bf58dd8d48988d163941735'],
  },
  {
    key: 'shopping',
    label: 'Shopping malls',
    google: ['shopping_mall'],
    foursquare: ['4bf58dd8d48988d1fd941735'],
  },
  {
    key: 'movie',
    label: 'Cinemas',
    google: ['movie_theater'],
    foursquare: ['4bf58dd8d48988d17f941735'],
  },
  {
    key: 'gym',
    label: 'Gyms & Fitness',
    google: ['gym', 'fitness_center'],
    foursquare: ['4bf58dd8d48988d175941735'],
  },
];

const BY_KEY = new Map(PLACE_CATEGORIES.map((category) => [category.key, category]));

export function isValidCategoryKey(key: string): boolean {
  return BY_KEY.has(key);
}

/** Filters a list of keys down to the ones we recognise. */
export function sanitizeCategoryKeys(keys: string[]): string[] {
  return Array.from(new Set(keys.filter((key) => BY_KEY.has(key))));
}

/** Resolves selected category keys into Google Places `includedTypes`. */
export function googleTypesForKeys(keys: string[]): string[] {
  const set = new Set<string>();
  for (const key of keys) {
    BY_KEY.get(key)?.google.forEach((type) => set.add(type));
  }
  return Array.from(set);
}

/** Resolves selected category keys into Foursquare category IDs. */
export function foursquareIdsForKeys(keys: string[]): string[] {
  const set = new Set<string>();
  for (const key of keys) {
    BY_KEY.get(key)?.foursquare.forEach((id) => set.add(id));
  }
  return Array.from(set);
}

/** Lightweight catalog (key + label) for the admin UI. */
export function listCategoryOptions(): Array<{ key: string; label: string }> {
  return PLACE_CATEGORIES.map(({ key, label }) => ({ key, label }));
}
