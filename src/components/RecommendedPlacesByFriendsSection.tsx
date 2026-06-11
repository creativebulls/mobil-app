import { RECOMMENDED_PLACES_BY_FRIENDS_DUMMY } from '../constants/recommendedPlacesByFriends';
import type { DiscoverPlace } from '../constants/discoverPlaces';
import { DiscoverPlacesSection } from './DiscoverPlacesSection';

type RecommendedPlacesByFriendsSectionProps = {
  title?: string;
  places?: DiscoverPlace[];
  isLoading?: boolean;
  emptyText?: string;
  onViewAllPress?: () => void;
  onPlacePress?: (place: DiscoverPlace) => void;
  onFavoritePress?: (place: DiscoverPlace, isFavorite: boolean) => void;
};

export function RecommendedPlacesByFriendsSection({
  title = 'Recommended Places by Friend',
  places = RECOMMENDED_PLACES_BY_FRIENDS_DUMMY,
  isLoading,
  emptyText,
  onViewAllPress,
  onPlacePress,
  onFavoritePress,
}: RecommendedPlacesByFriendsSectionProps) {
  return (
    <DiscoverPlacesSection
      title={title}
      places={places}
      isLoading={isLoading}
      emptyText={emptyText}
      onViewAllPress={onViewAllPress}
      onPlacePress={onPlacePress}
      onFavoritePress={onFavoritePress}
    />
  );
}
