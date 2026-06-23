import { AppError } from '../../shared/errors/AppError';
import { getPlaceDetails } from '../places/places.service';
import { PlaceLike } from '../places/place-engagement.model';
import { Post } from '../posts/post.model';
import { serializePost } from '../posts/post.service';
import { getFriendsCount, getFriendshipStatus, getMutualFriends } from '../friends/friends.service';
import { getRelationState } from '../relations/relations.service';
import {
  DEFAULT_PUSH_PREFERENCES,
  getUserDisplayName,
  serializeAuthor,
  User,
  type PushPreferences,
} from '../users/user.model';

export async function getUserSettings(userId: string) {
  const user = await User.findById(userId).select('isPrivate pushPreferences');

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return {
    isPrivate: user.isPrivate ?? false,
    pushPreferences: { ...DEFAULT_PUSH_PREFERENCES, ...(user.pushPreferences ?? {}) },
  };
}

export async function updateUserSettings(
  userId: string,
  input: { isPrivate?: boolean; pushPreferences?: Partial<PushPreferences> },
) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (typeof input.isPrivate === 'boolean') {
    user.isPrivate = input.isPrivate;
  }

  if (input.pushPreferences) {
    user.pushPreferences = {
      ...DEFAULT_PUSH_PREFERENCES,
      ...(user.pushPreferences ?? {}),
      ...input.pushPreferences,
    };
  }

  await user.save();

  return {
    isPrivate: user.isPrivate ?? false,
    pushPreferences: { ...DEFAULT_PUSH_PREFERENCES, ...(user.pushPreferences ?? {}) },
  };
}

export async function getProfileStats(userId: string) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const [friendsCount, postsCount] = await Promise.all([
    getFriendsCount(userId),
    Post.countDocuments({ author: userId }),
  ]);

  return {
    points: user.points ?? 0,
    friendsCount,
    postsCount,
    statusText: user.statusText ?? null,
  };
}

export async function updateStatusText(userId: string, statusText: string) {
  const trimmed = statusText.trim().slice(0, 150);
  const user = await User.findByIdAndUpdate(userId, { statusText: trimmed || undefined }, { new: true });

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return { statusText: user.statusText ?? null };
}

export async function listUserPosts(userId: string, currentUserId: string, limit = 20, before?: string) {
  const query: Record<string, unknown> = { author: userId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', 'givenName surname firstName lastName email profilePhotoUrl');

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;

  return {
    posts: posts.map((post) => serializePost(post, currentUserId)),
    nextCursor,
  };
}

export async function listFavoritePlaces(userId: string, limit = 20) {
  const [likedPlaces, positivePostPlaces] = await Promise.all([
    PlaceLike.find({ user: userId }).sort({ createdAt: -1 }).limit(limit * 2).select('placeId'),
    Post.find({
      author: userId,
      reaction: { $in: ['like', 'love'] },
      'place.name': { $exists: true, $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .select('place reaction'),
  ]);

  const seen = new Set<string>();
  const favorites: Array<{
    id: string;
    name: string;
    imageUrl: string;
    rating: number | null;
    reaction: string | null;
  }> = [];

  for (const like of likedPlaces) {
    if (seen.has(like.placeId) || favorites.length >= limit) continue;
    seen.add(like.placeId);
    const details = await getPlaceDetails(like.placeId);
    if (details) {
      favorites.push({
        id: details.id,
        name: details.name,
        imageUrl: details.imageUrl ?? '',
        rating: details.rating,
        reaction: 'like',
      });
    }
  }

  for (const post of positivePostPlaces) {
    if (!post.place?.name || favorites.length >= limit) continue;
    const placeKey = post.place.name.toLowerCase();
    if (seen.has(placeKey)) continue;
    seen.add(placeKey);
    favorites.push({
      id: placeKey,
      name: post.place.name,
      imageUrl: post.place.logoUrl ?? '',
      rating: null,
      reaction: post.reaction ?? 'like',
    });
  }

  return { places: favorites };
}

export async function getPublicUserProfile(viewerId: string, targetUserId: string) {
  const user = await User.findById(targetUserId);

  if (!user || !user.registrationCompleted) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const relationState =
    viewerId === targetUserId
      ? { blockedByMe: false, blockedMe: false, restrictedByMe: false }
      : await getRelationState(viewerId, targetUserId);

  // A user who blocked you (or whom you blocked) is hidden behind a minimal
  // profile shell — no posts, stats, or interaction affordances.
  if (relationState.blockedByMe || relationState.blockedMe) {
    return {
      user: {
        id: user._id.toString(),
        name: getUserDisplayName(user),
        avatarUri: relationState.blockedMe ? null : user.profilePhotoUrl ?? null,
        statusText: null,
        points: 0,
        friendsCount: 0,
        postsCount: 0,
      },
      relationship: {
        isSelf: false,
        isFriend: false,
        friendRequestStatus: null,
        friendRequestId: null,
        ...relationState,
      },
      mutualFriends: { count: 0, preview: [] },
      posts: [],
    };
  }

  const relationship = await getFriendshipStatus(viewerId, targetUserId);
  const mutualFriends = await getMutualFriends(viewerId, targetUserId);

  // Private accounts only reveal their posts, status, and stats to friends.
  const isLockedPrivate = (user.isPrivate ?? false) && !relationship.isFriend && viewerId !== targetUserId;

  const [friendsCount, postsCount, postsResult] = isLockedPrivate
    ? [0, 0, { posts: [] as Awaited<ReturnType<typeof listUserPosts>>['posts'] }]
    : await Promise.all([
        getFriendsCount(targetUserId),
        Post.countDocuments({ author: targetUserId }),
        listUserPosts(targetUserId, viewerId, 10),
      ]);

  return {
    user: {
      id: user._id.toString(),
      name: getUserDisplayName(user),
      avatarUri: user.profilePhotoUrl ?? null,
      statusText: isLockedPrivate ? null : user.statusText ?? null,
      points: isLockedPrivate ? 0 : user.points ?? 0,
      friendsCount,
      postsCount,
    },
    relationship: {
      ...relationship,
      ...relationState,
      isPrivate: user.isPrivate ?? false,
      isLocked: isLockedPrivate,
    },
    mutualFriends,
    posts: postsResult.posts,
  };
}
