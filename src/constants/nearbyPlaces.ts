export type NearbyPlaceSlide = {
  id: string;
  imageUri: string;
  logoUri: string;
  companyName: string;
  subtitle: string;
};

export const NEARBY_PLACE_SLIDES: NearbyPlaceSlide[] = [
  {
    id: '1',
    imageUri: 'https://picsum.photos/seed/whereabout-cafe/800/480',
    logoUri: 'https://picsum.photos/seed/cafe-logo/96/96',
    companyName: 'Brew & Co.',
    subtitle: 'Artisan coffee & fresh pastries',
  },
  {
    id: '2',
    imageUri: 'https://picsum.photos/seed/whereabout-gym/800/480',
    logoUri: 'https://picsum.photos/seed/gym-logo/96/96',
    companyName: 'Urban Fitness',
    subtitle: '24/7 gym & wellness studio',
  },
  {
    id: '3',
    imageUri: 'https://picsum.photos/seed/whereabout-bowl/800/480',
    logoUri: 'https://picsum.photos/seed/bowl-logo/96/96',
    companyName: 'Green Bowl',
    subtitle: 'Healthy bowls & smoothies',
  },
  {
    id: '4',
    imageUri: 'https://picsum.photos/seed/whereabout-cinema/800/480',
    logoUri: 'https://picsum.photos/seed/cinema-logo/96/96',
    companyName: 'Cinema Plus',
    subtitle: 'Latest movies & premium snacks',
  },
];
