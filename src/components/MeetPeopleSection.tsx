import { MEET_PEOPLE_DUMMY } from '../constants/meetPeople';
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
  people = MEET_PEOPLE_DUMMY,
  onViewAllPress,
  onPersonPress,
}: MeetPeopleSectionProps) {
  return (
    <MeetFriendsSection
      title={title}
      friends={people}
      onViewAllPress={onViewAllPress}
      onFriendPress={onPersonPress}
    />
  );
}
