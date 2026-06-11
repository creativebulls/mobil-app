export type MeetFriend = {
  id: string;
  name: string;
  distanceKm: number;
  avatarUri: string;
};

export const MEET_FRIENDS_DUMMY: MeetFriend[] = [
  {
    id: '1',
    name: 'Sarah Mitchell',
    distanceKm: 1.2,
    avatarUri: 'https://picsum.photos/seed/friend-sarah/200/200',
  },
  {
    id: '2',
    name: 'James Anderson',
    distanceKm: 2.8,
    avatarUri: 'https://picsum.photos/seed/friend-james/200/200',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    distanceKm: 0.9,
    avatarUri: 'https://picsum.photos/seed/friend-emily/200/200',
  },
  {
    id: '4',
    name: 'Michael Thompson',
    distanceKm: 4.5,
    avatarUri: 'https://picsum.photos/seed/friend-michael/200/200',
  },
  {
    id: '5',
    name: 'Olivia Chen',
    distanceKm: 3.1,
    avatarUri: 'https://picsum.photos/seed/friend-olivia/200/200',
  },
  {
    id: '6',
    name: 'Daniel Martinez',
    distanceKm: 5.2,
    avatarUri: 'https://picsum.photos/seed/friend-daniel/200/200',
  },
];
