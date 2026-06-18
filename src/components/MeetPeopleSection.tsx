import type { MeetFriendItem } from './MeetFriendsSection';
import { MeetFriendsSection } from './MeetFriendsSection';

type MeetPeopleSectionProps = {
  title?: string;
  people?: MeetFriendItem[];
  onViewAllPress?: () => void;
  onPersonPress?: (person: MeetFriendItem) => void;
};

export function MeetPeopleSection({
  title = 'Meet People',
  people = [],
  onViewAllPress,
  onPersonPress,
}: MeetPeopleSectionProps) {
  return (
    <MeetFriendsSection
      title={title}
      friends={people}
      emptyText="No suggestions yet — add friends and visit places to meet people."
      onViewAllPress={onViewAllPress}
      onFriendPress={onPersonPress}
    />
  );
}
