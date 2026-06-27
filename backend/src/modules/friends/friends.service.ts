import { Types } from 'mongoose';

import { randomBytes } from 'crypto';

import { AppError } from '../../shared/errors/AppError';
import { isUserOnline } from '../../socket/index';
import { createNotification } from '../notifications/notification.service';
import { PlaceVisit } from '../places/place-engagement.model';
import { assertNotBlocked, getBlockedUserIds, isBlockedBetween } from '../relations/relations.service';
import { User, getUserDisplayName, serializeAuthor } from '../users/user.model';
import { FriendRequest } from './friend-request.model';

const CONNECT_CODE_PREFIX = 'WA-';

function generateConnectCode(): string {
  return `${CONNECT_CODE_PREFIX}${randomBytes(9).toString('base64url')}`;
}

/** Returns the current user's connect code, generating one on first use. */
export async function getMyConnectCode(userId: string): Promise<{ code: string }> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (!user.connectCode) {
    // Retry on the rare unique-index collision.
    for (let attempt = 0; attempt < 5 && !user.connectCode; attempt += 1) {
      user.connectCode = generateConnectCode();
      try {
        await user.save();
      } catch {
        user.connectCode = undefined;
      }
    }
    if (!user.connectCode) {
      throw new AppError(500, 'Could not generate code', 'CONNECT_CODE_ERROR');
    }
  }

  return { code: user.connectCode };
}

/** Resolves a scanned connect code to the target user plus the viewer's relationship to them. */
export async function resolveConnectCode(viewerId: string, rawCode: string) {
  const code = rawCode.trim();
  const target = await User.findOne({ connectCode: code });

  if (!target || !target.registrationCompleted) {
    throw new AppError(404, 'This code is not valid', 'CONNECT_CODE_NOT_FOUND');
  }

  const targetId = target._id.toString();

  if (targetId === viewerId) {
    throw new AppError(422, 'This is your own code', 'OWN_CONNECT_CODE');
  }

  if (await isBlockedBetween(viewerId, targetId)) {
    throw new AppError(403, 'This code is not valid', 'CONNECT_CODE_NOT_FOUND');
  }

  const relationship = await getFriendshipStatus(viewerId, targetId);

  return {
    user: serializeFriendUser(target as unknown as Parameters<typeof serializeFriendUser>[0]),
    relationship,
  };
}

const AUTHOR_FIELDS = 'givenName surname firstName lastName email profilePhotoUrl statusText points username';

const FRIEND_POINTS = 5;

function serializeFriendUser(user: {
  _id: Types.ObjectId;
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string;
  profilePhotoUrl?: string;
  statusText?: string;
}) {
  return {
    ...serializeAuthor(user as Parameters<typeof serializeAuthor>[0]),
    username: user.username ?? null,
    statusText: user.statusText ?? null,
    isOnline: isUserOnline(user._id.toString()),
  };
}

async function awardPoints(userId: string, amount: number): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { points: amount } });
}

export async function searchUsers(currentUserId: string, query: string, limit = 20) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { users: [] as ReturnType<typeof serializeFriendUser>[] };
  }

  const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const users = await User.find({
    _id: { $ne: currentUserId },
    registrationCompleted: true,
    $or: [{ givenName: regex }, { surname: regex }, { firstName: regex }, { lastName: regex }, { email: regex }],
  })
    .limit(Math.min(limit, 30))
    .select(AUTHOR_FIELDS);

  const friendIds = await getFriendUserIds(currentUserId);
  const pending = await FriendRequest.find({
    $or: [
      { from: currentUserId, status: 'pending' },
      { to: currentUserId, status: 'pending' },
    ],
  }).select('from to status');

  const pendingMap = new Map<string, 'sent' | 'received'>();
  for (const req of pending) {
    const otherId = req.from.toString() === currentUserId ? req.to.toString() : req.from.toString();
    pendingMap.set(otherId, req.from.toString() === currentUserId ? 'sent' : 'received');
  }

  return {
    users: users.map((user) => {
      const id = user._id.toString();
      return {
        ...serializeFriendUser(user),
        isFriend: friendIds.has(id),
        friendRequestStatus: pendingMap.get(id) ?? null,
      };
    }),
  };
}

async function getFriendUserIds(userId: string): Promise<Set<string>> {
  const accepted = await FriendRequest.find({
    status: 'accepted',
    $or: [{ from: userId }, { to: userId }],
  }).select('from to');

  const ids = new Set<string>();
  for (const req of accepted) {
    const other = req.from.toString() === userId ? req.to.toString() : req.from.toString();
    ids.add(other);
  }
  return ids;
}

export async function listFriends(userId: string, limit = 50) {
  const accepted = await FriendRequest.find({
    status: 'accepted',
    $or: [{ from: userId }, { to: userId }],
  })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('from', AUTHOR_FIELDS)
    .populate('to', AUTHOR_FIELDS);

  const friends = accepted.map((req) => {
    const friend =
      req.from._id.toString() === userId
        ? (req.to as unknown as Parameters<typeof serializeFriendUser>[0])
        : (req.from as unknown as Parameters<typeof serializeFriendUser>[0]);
    return serializeFriendUser(friend);
  });

  return { friends };
}

/**
 * Lists a target user's friends, visible to the viewer. Friends the viewer has
 * blocked (or who blocked the viewer) are filtered out, and a block between the
 * viewer and the target hides the list entirely.
 */
export async function listFriendsOfUser(viewerId: string, targetUserId: string, limit = 100) {
  const target = await User.findById(targetUserId).select('registrationCompleted');
  if (!target || !target.registrationCompleted) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (viewerId !== targetUserId && (await isBlockedBetween(viewerId, targetUserId))) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const [{ friends }, blocked] = await Promise.all([
    listFriends(targetUserId, limit),
    getBlockedUserIds(viewerId),
  ]);

  return { friends: friends.filter((friend) => !blocked.has(friend.id)) };
}

/**
 * Friends shared between the viewer and the target user, with a small preview
 * list for inline display plus the total count.
 */
export async function getMutualFriends(viewerId: string, targetUserId: string, previewLimit = 8) {
  const empty = { count: 0, preview: [] as ReturnType<typeof serializeAuthor>[] };

  if (viewerId === targetUserId) {
    return empty;
  }

  const [viewerFriends, targetFriends] = await Promise.all([
    getFriendUserIds(viewerId),
    getFriendUserIds(targetUserId),
  ]);

  const mutualIds: string[] = [];
  for (const id of viewerFriends) {
    if (targetFriends.has(id)) {
      mutualIds.push(id);
    }
  }

  if (mutualIds.length === 0) {
    return empty;
  }

  const previewUsers = await User.find({
    _id: { $in: mutualIds.slice(0, previewLimit) },
    registrationCompleted: true,
  }).select(AUTHOR_FIELDS);

  return {
    count: mutualIds.length,
    preview: previewUsers.map((user) => serializeAuthor(user as Parameters<typeof serializeAuthor>[0])),
  };
}

/**
 * Suggests people to connect with, ranked by relevance:
 *  - mutual friends (friends-of-friends who aren't already friends)
 *  - people who have visited the same places as the viewer
 * Already-friends, the viewer, and blocked users are excluded.
 */
export async function getMeetPeople(userId: string, limit = 20) {
  const friendIds = await getFriendUserIds(userId);
  const blockedIds = await getBlockedUserIds(userId);
  const excluded = (id: string) => id === userId || friendIds.has(id) || blockedIds.has(id);

  // --- Mutual friends (friends-of-friends) ---------------------------------
  const mutualCount = new Map<string, number>();
  const friendArr = [...friendIds];
  if (friendArr.length > 0) {
    const fof = await FriendRequest.find({
      status: 'accepted',
      $or: [{ from: { $in: friendArr } }, { to: { $in: friendArr } }],
    }).select('from to');

    for (const req of fof) {
      const a = req.from.toString();
      const b = req.to.toString();
      // For each accepted edge, the endpoint that is one of my friends links me
      // to the other endpoint (a candidate), unless that candidate is excluded.
      for (const [maybeFriend, candidate] of [
        [a, b],
        [b, a],
      ] as const) {
        if (friendIds.has(maybeFriend) && !excluded(candidate)) {
          mutualCount.set(candidate, (mutualCount.get(candidate) ?? 0) + 1);
        }
      }
    }
  }

  // --- Same-place visitors -------------------------------------------------
  const sharedPlaces = new Map<string, Set<string>>();
  const myVisits = await PlaceVisit.find({ user: userId }).select('placeId');
  const myPlaceIds = [...new Set(myVisits.map((visit) => visit.placeId))];
  if (myPlaceIds.length > 0) {
    const others = await PlaceVisit.find({
      placeId: { $in: myPlaceIds },
      user: { $ne: userId },
    }).select('placeId user');

    for (const visit of others) {
      const candidate = visit.user.toString();
      if (excluded(candidate)) {
        continue;
      }
      const places = sharedPlaces.get(candidate) ?? new Set<string>();
      places.add(visit.placeId);
      sharedPlaces.set(candidate, places);
    }
  }

  const candidateIds = new Set<string>([...mutualCount.keys(), ...sharedPlaces.keys()]);
  if (candidateIds.size === 0) {
    return { people: [] as Array<ReturnType<typeof serializeFriendUser> & {
      subtitle: string | null;
      mutualFriends: number;
      sharedPlaces: number;
    }> };
  }

  const users = await User.find({
    _id: { $in: [...candidateIds] },
    registrationCompleted: true,
  }).select(AUTHOR_FIELDS);

  const people = users
    .map((user) => {
      const id = user._id.toString();
      const mutualFriends = mutualCount.get(id) ?? 0;
      const placesInCommon = sharedPlaces.get(id)?.size ?? 0;

      let subtitle: string | null = null;
      if (mutualFriends > 0) {
        subtitle = `${mutualFriends} mutual friend${mutualFriends === 1 ? '' : 's'}`;
      } else if (placesInCommon > 0) {
        subtitle =
          placesInCommon === 1 ? 'Visited a place you’ve been' : `${placesInCommon} places in common`;
      }

      return {
        ...serializeFriendUser(user),
        subtitle,
        mutualFriends,
        sharedPlaces: placesInCommon,
        score: mutualFriends * 3 + placesInCommon,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);

  return { people };
}

export async function sendFriendRequest(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new AppError(422, 'You cannot add yourself', 'INVALID_FRIEND_REQUEST');
  }

  const target = await User.findById(toUserId);
  if (!target || !target.registrationCompleted) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  await assertNotBlocked(fromUserId, toUserId);

  const friendIds = await getFriendUserIds(fromUserId);
  if (friendIds.has(toUserId)) {
    throw new AppError(409, 'You are already friends', 'ALREADY_FRIENDS');
  }

  const existing = await FriendRequest.findOne({
    $or: [
      { from: fromUserId, to: toUserId },
      { from: toUserId, to: fromUserId },
    ],
  });

  if (existing) {
    if (existing.status === 'pending') {
      if (existing.from.toString() === toUserId) {
        return acceptFriendRequest(toUserId, existing._id.toString());
      }
      throw new AppError(409, 'Friend request already sent', 'REQUEST_ALREADY_SENT');
    }
    if (existing.status === 'accepted') {
      throw new AppError(409, 'You are already friends', 'ALREADY_FRIENDS');
    }
    existing.status = 'pending';
    existing.from = new Types.ObjectId(fromUserId);
    existing.to = new Types.ObjectId(toUserId);
    await existing.save();
    await createNotification({
      recipientId: toUserId,
      actorId: fromUserId,
      type: 'friend_request',
      friendRequestId: existing._id.toString(),
    });
    return { requestId: existing._id.toString(), status: 'pending' as const };
  }

  const request = await FriendRequest.create({
    from: fromUserId,
    to: toUserId,
    status: 'pending',
  });

  await createNotification({
    recipientId: toUserId,
    actorId: fromUserId,
    type: 'friend_request',
    friendRequestId: request._id.toString(),
  });

  return { requestId: request._id.toString(), status: 'pending' as const };
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const request = await FriendRequest.findById(requestId);

  if (!request || request.to.toString() !== userId) {
    throw new AppError(404, 'Friend request not found', 'FRIEND_REQUEST_NOT_FOUND');
  }

  if (request.status === 'accepted') {
    return { requestId, status: 'accepted' as const };
  }

  if (request.status === 'rejected') {
    throw new AppError(409, 'Friend request was rejected', 'REQUEST_REJECTED');
  }

  request.status = 'accepted';
  await request.save();

  const fromUserId = request.from.toString();
  await Promise.all([awardPoints(fromUserId, FRIEND_POINTS), awardPoints(userId, FRIEND_POINTS)]);

  await createNotification({
    recipientId: fromUserId,
    actorId: userId,
    type: 'friend_request_accepted',
    friendRequestId: request._id.toString(),
  });

  return { requestId, status: 'accepted' as const };
}

export async function rejectFriendRequest(userId: string, requestId: string) {
  const request = await FriendRequest.findById(requestId);

  if (!request || request.to.toString() !== userId) {
    throw new AppError(404, 'Friend request not found', 'FRIEND_REQUEST_NOT_FOUND');
  }

  request.status = 'rejected';
  await request.save();

  return { requestId, status: 'rejected' as const };
}

export async function getFriendsCount(userId: string): Promise<number> {
  return FriendRequest.countDocuments({
    status: 'accepted',
    $or: [{ from: userId }, { to: userId }],
  });
}

export async function getFriendRequestById(requestId: string) {
  return FriendRequest.findById(requestId);
}

export async function getFriendshipStatus(viewerId: string, targetUserId: string) {
  if (viewerId === targetUserId) {
    return {
      isSelf: true,
      isFriend: false,
      friendRequestStatus: null as 'sent' | 'received' | null,
      friendRequestId: null as string | null,
    };
  }

  const friendIds = await getFriendUserIds(viewerId);
  if (friendIds.has(targetUserId)) {
    return {
      isSelf: false,
      isFriend: true,
      friendRequestStatus: null,
      friendRequestId: null,
    };
  }

  const pending = await FriendRequest.findOne({
    status: 'pending',
    $or: [
      { from: viewerId, to: targetUserId },
      { from: targetUserId, to: viewerId },
    ],
  });

  if (!pending) {
    return {
      isSelf: false,
      isFriend: false,
      friendRequestStatus: null,
      friendRequestId: null,
    };
  }

  return {
    isSelf: false,
    isFriend: false,
    friendRequestStatus:
      pending.from.toString() === viewerId ? ('sent' as const) : ('received' as const),
    friendRequestId: pending._id.toString(),
  };
}

const FRIEND_LOCATION_MAX_AGE_MS = 30 * 60 * 1000;

export async function listFriendLocations(viewerId: string) {
  const friendIds = await getFriendUserIds(viewerId);
  const blockedIds = await getBlockedUserIds(viewerId);

  const visibleFriendIds = [...friendIds].filter((id) => !blockedIds.has(id));

  if (visibleFriendIds.length === 0) {
    return { friends: [] as FriendLocationSummary[] };
  }

  const minUpdatedAt = new Date(Date.now() - FRIEND_LOCATION_MAX_AGE_MS);

  const users = await User.find({
    _id: { $in: visibleFriendIds },
    'lastLocation.updatedAt': { $gte: minUpdatedAt },
    'lastLocation.latitude': { $exists: true },
    'lastLocation.longitude': { $exists: true },
  }).select(`${AUTHOR_FIELDS} lastLocation`);

  const friends: FriendLocationSummary[] = users.map((user) => ({
    id: user._id.toString(),
    name: getUserDisplayName(user),
    avatarUri: user.profilePhotoUrl ?? null,
    latitude: user.lastLocation!.latitude,
    longitude: user.lastLocation!.longitude,
    updatedAt: user.lastLocation!.updatedAt.toISOString(),
    isOnline: isUserOnline(user._id.toString()),
  }));

  return { friends };
}

export type FriendLocationSummary = {
  id: string;
  name: string;
  avatarUri: string | null;
  latitude: number;
  longitude: number;
  updatedAt: string;
  isOnline: boolean;
};

export { getFriendUserIds };
