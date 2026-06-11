import { MEET_PEOPLE_DUMMY } from '../constants/meetPeople';
import type { MeetFriend } from '../constants/meetFriends';
import { MeetFriendsSection } from './MeetFriendsSection';

type MeetPeopleSectionProps = {
  title?: string;
  people?: MeetFriend[];
  onViewAllPress?: () => void;
  onPersonPress?: (person: MeetFriend) => void;
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
