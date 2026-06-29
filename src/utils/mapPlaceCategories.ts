import type { Place } from '../api/types';

export type MapFilterTab = 'all' | 'friends' | 'restaurants' | 'bars' | 'events';

export const MAP_FILTER_TABS: { id: MapFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'friends', label: 'Friends' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'bars', label: 'Bars' },
  { id: 'events', label: 'Events' },
];

const RESTAURANT_PATTERN =
  /restaurant|dining|food|caf[eé]|coffee|bakery|fast food|meal|bistro|grill|pizzeria|sushi|diner/i;
const BAR_PATTERN = /bar|pub|nightclub|night club|brewery|wine|cocktail|lounge|tavern/i;
const EVENT_PATTERN =
  /event|venue|hall|wedding|banquet|concert|festival|party|stadium|arena|theater|theatre/i;

function placeHaystack(place: Place): string {
  return `${place.category ?? ''} ${place.name}`;
}

export function placeMatchesMapTab(place: Place, tab: MapFilterTab): boolean {
  if (tab === 'all' || tab === 'friends') {
    return true;
  }

  const haystack = placeHaystack(place);
  switch (tab) {
    case 'restaurants':
      return RESTAURANT_PATTERN.test(haystack);
    case 'bars':
      return BAR_PATTERN.test(haystack);
    case 'events':
      return EVENT_PATTERN.test(haystack);
    default:
      return true;
  }
}

export function showsFriendsOnMap(tab: MapFilterTab): boolean {
  return tab === 'all' || tab === 'friends';
}

export function showsPlacesOnMap(tab: MapFilterTab): boolean {
  return tab !== 'friends';
}
