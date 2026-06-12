import { AppError } from '../../shared/errors/AppError';
import { FriendRequest } from '../friends/friend-request.model';
import { User, serializeAuthor } from '../users/user.model';
import { UserRelation } from './block.model';

/**
 * True when either user has blocked the other. Blocking severs all interaction
 * (profile views, friend requests, and messaging) in both directions.
 */
export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
  const block = await UserRelation.findOne({
    type: 'block',
    $or: [
      { owner: userA, target: userB },
      { owner: userB, target: userA },
    ],
  });
  return Boolean(block);
}

/** True when `owner` has restricted `target`. One-directional and softer than a block. */
export async function isRestricted(ownerId: string, targetId: string): Promise<boolean> {
  const relation = await UserRelation.findOne({ owner: ownerId, target: targetId, type: 'restrict' });
  return Boolean(relation);
}

export async function getRelationState(viewerId: string, targetId: string) {
  const [blockedByMe, blockedMe, restrictedByMe] = await Promise.all([
    UserRelation.exists({ owner: viewerId, target: targetId, type: 'block' }),
    UserRelation.exists({ owner: targetId, target: viewerId, type: 'block' }),
    UserRelation.exists({ owner: viewerId, target: targetId, type: 'restrict' }),
  ]);

  return {
    blockedByMe: Boolean(blockedByMe),
    blockedMe: Boolean(blockedMe),
    restrictedByMe: Boolean(restrictedByMe),
  };
}

export async function blockUser(ownerId: string, targetId: string) {
  if (ownerId === targetId) {
    throw new AppError(422, 'You cannot block yourself', 'INVALID_BLOCK');
  }

  const target = await User.findById(targetId);
  if (!target) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  await UserRelation.updateOne(
    { owner: ownerId, target: targetId },
    { $set: { type: 'block' } },
    { upsert: true },
  );

  // Blocking ends any existing friendship / pending requests between the two.
  await FriendRequest.deleteMany({
    $or: [
      { from: ownerId, to: targetId },
      { from: targetId, to: ownerId },
    ],
  });

  return { blocked: true };
}

export async function unblockUser(ownerId: string, targetId: string) {
  await UserRelation.deleteOne({ owner: ownerId, target: targetId, type: 'block' });
  return { blocked: false };
}

export async function restrictUser(ownerId: string, targetId: string) {
  if (ownerId === targetId) {
    throw new AppError(422, 'You cannot restrict yourself', 'INVALID_RESTRICT');
  }

  const target = await User.findById(targetId);
  if (!target) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  await UserRelation.updateOne(
    { owner: ownerId, target: targetId },
    { $set: { type: 'restrict' } },
    { upsert: true },
  );

  return { restricted: true };
}

export async function unrestrictUser(ownerId: string, targetId: string) {
  await UserRelation.deleteOne({ owner: ownerId, target: targetId, type: 'restrict' });
  return { restricted: false };
}

export async function listBlockedUsers(ownerId: string) {
  const relations = await UserRelation.find({ owner: ownerId, type: 'block' })
    .sort({ createdAt: -1 })
    .populate('target', 'givenName surname firstName lastName email profilePhotoUrl');

  const users = relations
    .map((relation) => relation.target as unknown as Parameters<typeof serializeAuthor>[0] | null)
    .filter((user): user is Parameters<typeof serializeAuthor>[0] => Boolean(user))
    .map(serializeAuthor);

  return { users };
}

export async function listRestrictedUsers(ownerId: string) {
  const relations = await UserRelation.find({ owner: ownerId, type: 'restrict' })
    .sort({ createdAt: -1 })
    .populate('target', 'givenName surname firstName lastName email profilePhotoUrl');

  const users = relations
    .map((relation) => relation.target as unknown as Parameters<typeof serializeAuthor>[0] | null)
    .filter((user): user is Parameters<typeof serializeAuthor>[0] => Boolean(user))
    .map(serializeAuthor);

  return { users };
}

/** Set of user ids the viewer has blocked or who have blocked the viewer. */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const relations = await UserRelation.find({
    type: 'block',
    $or: [{ owner: userId }, { target: userId }],
  }).select('owner target');

  const ids = new Set<string>();
  for (const relation of relations) {
    const other =
      relation.owner.toString() === userId ? relation.target.toString() : relation.owner.toString();
    ids.add(other);
  }
  return ids;
}

export async function assertNotBlocked(userA: string, userB: string): Promise<void> {
  if (await isBlockedBetween(userA, userB)) {
    throw new AppError(403, 'This action is unavailable', 'USER_BLOCKED');
  }
}
