export type DiscoverPlace = {
  id: string;
  imageUri: string;
  companyName: string;
  distanceKm: number | null;
  location: string;
};

export const DISCOVER_PLACES_DUMMY: DiscoverPlace[] = [
  {
    id: '1',
    imageUri: 'https://picsum.photos/seed/discover-cafe/600/400',
    companyName: 'Brew & Co.',
    distanceKm: 1.2,
    location: 'Downtown',
  },
  {
    id: '2',
    imageUri: 'https://picsum.photos/seed/discover-gym/600/400',
    companyName: 'Urban Fitness',
    distanceKm: 2.4,
    location: 'West Side',
  },
  {
    id: '3',
    imageUri: 'https://picsum.photos/seed/discover-bowl/600/400',
    companyName: 'Green Bowl',
    distanceKm: 0.8,
    location: 'Market St',
  },
  {
    id: '4',
    imageUri: 'https://picsum.photos/seed/discover-cinema/600/400',
    companyName: 'Cinema Plus',
    distanceKm: 3.6,
    location: 'City Center',
  },
  {
    id: '5',
    imageUri: 'https://picsum.photos/seed/discover-park/600/400',
    companyName: 'Sunset Park',
    distanceKm: 4.1,
    location: 'Riverside',
  },
  {
    id: '6',
    imageUri: 'https://picsum.photos/seed/discover-bakery/600/400',
    companyName: 'Crumb Bakery',
    distanceKm: 1.9,
    location: 'Old Town',
  },
];
