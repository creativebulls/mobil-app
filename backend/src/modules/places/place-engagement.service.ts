import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { formatRelativeTime } from '../../shared/utils/time';
import { User } from '../users/user.model';
import { PlaceComment, PlaceLike, PlaceVisit, type PlaceCommentDocument } from './place-engagement.model';

const AUTHOR_FIELDS = 'givenName surname firstName lastName email profilePhotoUrl';

type PopulatedUser = {
  _id: Types.ObjectId;
  givenName?: string;
  surname?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profilePhotoUrl?: string;
};

function serializeUserSummary(user: PopulatedUser) {
  return {
    id: user._id.toString(),
    name:
      user.givenName && user.surname
        ? `${user.givenName} ${user.surname}`
        : user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email.split('@')[0],
    avatarUri: user.profilePhotoUrl ?? null,
  };
}

function serializePlaceComment(comment: PlaceCommentDocument) {
  const author = comment.author as unknown as PopulatedUser;

  return {
    id: comment._id.toString(),
    text: comment.text,
    author: serializeUserSummary(author),
    createdAt: comment.createdAt.toISOString(),
    timeAgo: formatRelativeTime(comment.createdAt),
  };
}

const VISITOR_PREVIEW_LIMIT = 5;

export async function getPlaceEngagement(placeId: string, userId: string) {
  const [likeCount, commentCount, visitorCount, likedByMe, recentVisits] = await Promise.all([
    PlaceLike.countDocuments({ placeId }),
    PlaceComment.countDocuments({ placeId }),
    PlaceVisit.countDocuments({ placeId }),
    PlaceLike.exists({ placeId, user: userId }),
    PlaceVisit.find({ placeId })
      .sort({ createdAt: -1 })
      .limit(VISITOR_PREVIEW_LIMIT)
      .populate('user', AUTHOR_FIELDS),
  ]);

  const visitors = recentVisits
    .map((visit) => visit.user as unknown as PopulatedUser | null)
    .filter((user): user is PopulatedUser => Boolean(user))
    .map(serializeUserSummary);

  return {
    likeCount,
    commentCount,
    visitorCount,
    likedByMe: Boolean(likedByMe),
    visitors,
  };
}

export async function togglePlaceLike(placeId: string, userId: string) {
  const existing = await PlaceLike.findOne({ placeId, user: userId });

  if (existing) {
    await existing.deleteOne();
  } else {
    await PlaceLike.create({ placeId, user: userId });
    await User.updateOne({ _id: userId }, { $inc: { points: 3 } });
  }

  const likeCount = await PlaceLike.countDocuments({ placeId });

  return { liked: !existing, likeCount };
}

export async function recordPlaceVisit(placeId: string, userId: string) {
  await PlaceVisit.updateOne(
    { placeId, user: userId },
    { $setOnInsert: { placeId, user: userId } },
    { upsert: true },
  );

  const visitorCount = await PlaceVisit.countDocuments({ placeId });
  return { visitorCount };
}

export async function listPlaceComments(placeId: string, limit = 50, before?: string) {
  const query: Record<string, unknown> = { placeId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const comments = await PlaceComment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  const items = comments.map(serializePlaceComment);
  const nextCursor =
    comments.length === limit ? comments[comments.length - 1]?.createdAt.toISOString() : null;

  return { comments: items, nextCursor };
}

export async function addPlaceComment(placeId: string, userId: string, text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new AppError(422, 'Comment cannot be empty', 'EMPTY_COMMENT');
  }

  const comment = await PlaceComment.create({ placeId, author: userId, text: trimmed });
  await comment.populate('author', AUTHOR_FIELDS);

  const commentCount = await PlaceComment.countDocuments({ placeId });

  return { comment: serializePlaceComment(comment), commentCount };
}
