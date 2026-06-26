import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { extractHashtags } from '../../shared/utils/postEntities';
import { formatRelativeTime } from '../../shared/utils/time';
import { emitToUser } from '../../socket/index';
import { User } from '../users/user.model';
import { getFriendUserIds } from '../friends/friends.service';
import { isBlockedBetween } from '../relations/relations.service';
import { createNotification } from '../notifications/notification.service';
import { Comment, type CommentDocument } from './comment.model';
import { Post, type PostDocument } from './post.model';
import { PostSave } from './post-save.model';

function resolvePostImageUrl(filename: string): string {
  return `/uploads/posts/${filename}`;
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)(\?|$)/i;

function isVideoMediaUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url);
}

function buildVideoPosterUris(
  imageUris: string[],
  videoThumbnails: Record<string, string> | undefined,
): (string | null)[] {
  return imageUris.map((uri) => (isVideoMediaUrl(uri) ? videoThumbnails?.[uri] ?? null : null));
}

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

type UserSummary = ReturnType<typeof serializeUserSummary>;

function recentLikerIds(post: PostDocument, limit = 3): string[] {
  return post.likes
    .slice(-limit)
    .reverse()
    .map((id) => id.toString());
}

async function buildLikersMap(likerIds: Types.ObjectId[]): Promise<Map<string, UserSummary>> {
  const unique = [...new Set(likerIds.map((id) => id.toString()))];
  if (unique.length === 0) {
    return new Map();
  }

  const users = (await User.find({ _id: { $in: unique } })
    .select(AUTHOR_FIELDS)
    .lean()) as unknown as PopulatedUser[];

  return new Map(users.map((user) => [user._id.toString(), serializeUserSummary(user)]));
}

async function buildLikersMapForPosts(posts: PostDocument[]): Promise<Map<string, UserSummary>> {
  const ids = posts.flatMap((post) => post.likes.slice(-3));
  return buildLikersMap(ids);
}

async function buildSavedPostIdsSet(
  currentUserId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) {
    return new Set();
  }

  const saves = await PostSave.find({
    user: currentUserId,
    post: { $in: postIds },
  })
    .select('post')
    .lean();

  return new Set(saves.map((save) => save.post.toString()));
}

type SerializePostOptions = {
  likersById?: Map<string, UserSummary>;
  savedPostIds?: Set<string>;
};

export function serializePost(
  post: PostDocument,
  currentUserId: string,
  options: SerializePostOptions = {},
) {
  const { likersById, savedPostIds } = options;
  const author = post.author as unknown as PopulatedUser;
  const likes = post.likes.map((id) => id.toString());
  const imageUris =
    post.images && post.images.length > 0
      ? post.images
      : post.imageUrl
        ? [post.imageUrl]
        : [];

  const recentLikers = likersById
    ? recentLikerIds(post)
        .map((id) => likersById.get(id))
        .filter((user): user is UserSummary => user != null)
    : [];

  return {
    id: post._id.toString(),
    author: serializeUserSummary(author),
    text: post.text ?? null,
    imageUri: imageUris[0] ?? null,
    imageUris,
    videoPosterUris: buildVideoPosterUris(imageUris, post.videoThumbnails),
    reaction: post.reaction ?? null,
    place: post.place
      ? {
          placeId: post.place.placeId ?? null,
          name: post.place.name,
          logoUri: post.place.logoUrl ?? null,
          distanceKm: post.place.distanceKm ?? null,
        }
      : null,
    likesCount: likes.length,
    recentLikers,
    commentsCount: post.commentsCount,
    viewsCount: post.viewsCount ?? 0,
    likedByMe: likes.includes(currentUserId),
    savedByMe: savedPostIds?.has(post._id.toString()) ?? false,
    hashtags: post.hashtags ?? [],
    createdAt: post.createdAt.toISOString(),
    timeAgo: formatRelativeTime(post.createdAt),
  };
}

export async function serializePosts(posts: PostDocument[], currentUserId: string) {
  const likersById = await buildLikersMapForPosts(posts);
  const savedPostIds = await buildSavedPostIdsSet(
    currentUserId,
    posts.map((post) => post._id.toString()),
  );
  return posts.map((post) => serializePost(post, currentUserId, { likersById, savedPostIds }));
}

async function serializeSinglePost(post: PostDocument, currentUserId: string) {
  const likersById = await buildLikersMap(post.likes.slice(-3));
  const savedPostIds = await buildSavedPostIdsSet(currentUserId, [post._id.toString()]);
  return serializePost(post, currentUserId, { likersById, savedPostIds });
}

function serializeComment(comment: CommentDocument, currentUserId: string) {
  const author = comment.author as unknown as PopulatedUser;
  const likes = comment.likes.map((id) => id.toString());

  return {
    id: comment._id.toString(),
    text: comment.text,
    author: serializeUserSummary(author),
    parentId: comment.parent ? comment.parent.toString() : null,
    likesCount: likes.length,
    likedByMe: likes.includes(currentUserId),
    repliesCount: comment.repliesCount,
    createdAt: comment.createdAt.toISOString(),
    timeAgo: formatRelativeTime(comment.createdAt),
  };
}

const AUTHOR_FIELDS = 'givenName surname firstName lastName email profilePhotoUrl';

/**
 * Posts are visible only to their author and that author's friends. Because
 * blocking a user removes the friendship, blocked contacts are automatically
 * excluded from this audience.
 */
async function getVisibleAuthorIds(viewerId: string): Promise<string[]> {
  const friendIds = await getFriendUserIds(viewerId);
  return [viewerId, ...friendIds];
}

/** Throws unless the viewer is the author or one of the author's friends (and not blocked). */
async function assertCanSeePost(viewerId: string, authorId: string): Promise<void> {
  if (viewerId === authorId) {
    return;
  }
  if (await isBlockedBetween(viewerId, authorId)) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }
  const friendIds = await getFriendUserIds(viewerId);
  if (!friendIds.has(authorId)) {
    throw new AppError(403, 'This post is only visible to the author and their friends', 'POST_NOT_VISIBLE');
  }
}

export async function createPost(input: {
  authorId: string;
  text?: string;
  imageFiles?: Express.Multer.File[];
  posterFiles?: Express.Multer.File[];
  reaction?: 'like' | 'dislike' | 'love';
  placeName?: string;
  placeId?: string;
  placeImageUrl?: string;
  placeDistanceKm?: number;
  mentionedUserIds?: string[];
}) {
  const imageFiles = input.imageFiles ?? [];
  const posterFiles = input.posterFiles ?? [];

  if (!input.text && imageFiles.length === 0) {
    throw new AppError(422, 'A post must include text or media', 'EMPTY_POST');
  }

  if (!input.placeName?.trim()) {
    throw new AppError(422, 'A place is required for every post', 'PLACE_REQUIRED');
  }

  const author = await User.findById(input.authorId);

  if (!author) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const images = imageFiles.map((file) => resolvePostImageUrl(file.filename));

  const videoThumbnails: Record<string, string> = {};
  let posterIndex = 0;
  for (const file of imageFiles) {
    if (file.mimetype.startsWith('video/')) {
      const poster = posterFiles[posterIndex];
      if (poster) {
        videoThumbnails[resolvePostImageUrl(file.filename)] = resolvePostImageUrl(poster.filename);
      }
      posterIndex += 1;
    }
  }

  const hashtags = extractHashtags(input.text);
  const friendIds = await getFriendUserIds(input.authorId);
  const mentionedUserIds = (input.mentionedUserIds ?? []).filter(
    (userId) => userId !== input.authorId && friendIds.has(userId),
  );
  const uniqueMentionedUserIds = [...new Set(mentionedUserIds)];

  const post = await Post.create({
    author: input.authorId,
    text: input.text,
    imageUrl: images[0],
    images,
    videoThumbnails,
    reaction: input.reaction,
    place: {
      // Use the place's own photo (e.g. from Google Places), not the
      // author's profile picture. Falls back to undefined when the place
      // has no image, so the UI shows the place's initials instead.
      placeId: input.placeId?.trim() || undefined,
      name: input.placeName.trim(),
      logoUrl: input.placeImageUrl,
      distanceKm: input.placeDistanceKm,
    },
    hashtags,
    mentionedUsers: uniqueMentionedUserIds.map((id) => new Types.ObjectId(id)),
    likes: [],
    commentsCount: 0,
  });

  await User.updateOne({ _id: input.authorId }, { $inc: { points: 10 } });

  await post.populate('author', AUTHOR_FIELDS);

  const serialized = await serializeSinglePost(post, input.authorId);

  // Broadcast the new post to the author and each of their friends, so it
  // appears live in their feeds — and nowhere else.
  emitToUser(input.authorId, 'post:created', serialized);
  for (const friendId of friendIds) {
    emitToUser(friendId, 'post:created', serialized);
  }

  const preview = input.text?.trim().slice(0, 120);
  await Promise.all(
    uniqueMentionedUserIds.map((recipientId) =>
      createNotification({
        recipientId,
        actorId: input.authorId,
        type: 'mention',
        postId: post._id.toString(),
        preview,
      }),
    ),
  );

  return serialized;
}

export async function getFeed(currentUserId: string, limit = 20, before?: string) {
  const query: Record<string, unknown> = {
    author: { $in: await getVisibleAuthorIds(currentUserId) },
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;

  return {
    posts: await serializePosts(posts, currentUserId),
    nextCursor,
  };
}

export async function searchPosts(currentUserId: string, q: string, limit = 20) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const query: Record<string, unknown> = {
    author: { $in: await getVisibleAuthorIds(currentUserId) },
    $or: [{ text: regex }, { 'place.name': regex }],
  };

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  return { posts: await serializePosts(posts, currentUserId) };
}

function placeNameQuery(placeName: string): RegExp {
  const escaped = placeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

export async function countPostsByPlace(placeName: string): Promise<number> {
  return Post.countDocuments({ 'place.name': placeNameQuery(placeName) });
}

export async function listPostsByPlace(
  currentUserId: string,
  placeName: string,
  limit = 20,
  before?: string,
) {
  const query: Record<string, unknown> = {
    'place.name': placeNameQuery(placeName),
    author: { $in: await getVisibleAuthorIds(currentUserId) },
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].createdAt.toISOString() : null;

  return {
    posts: await serializePosts(posts, currentUserId),
    nextCursor,
  };
}

export async function getPost(currentUserId: string, postId: string) {
  const post = await Post.findById(postId).populate('author', AUTHOR_FIELDS);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  const authorId = (post.author as { _id: Types.ObjectId })._id.toString();
  await assertCanSeePost(currentUserId, authorId);

  return serializeSinglePost(post, currentUserId);
}

export async function recordPostView(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  await assertCanSeePost(currentUserId, post.author.toString());

  post.viewsCount = (post.viewsCount ?? 0) + 1;
  await post.save();

  return { viewsCount: post.viewsCount };
}

export async function listPostLikers(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  await assertCanSeePost(currentUserId, post.author.toString());

  if (post.likes.length === 0) {
    return { users: [] };
  }

  const users = (await User.find({ _id: { $in: post.likes } })
    .select(AUTHOR_FIELDS)
    .lean()) as unknown as PopulatedUser[];

  const userById = new Map(users.map((user) => [user._id.toString(), serializeUserSummary(user)]));

  // Most recent like is last in the array — return newest first for feed previews.
  const ordered = [...post.likes]
    .reverse()
    .map((id) => userById.get(id.toString()))
    .filter((user): user is UserSummary => user != null);

  return { users: ordered };
}

export async function toggleLike(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  await assertCanSeePost(currentUserId, post.author.toString());

  const userObjectId = new Types.ObjectId(currentUserId);
  const alreadyLiked = post.likes.some((id) => id.toString() === currentUserId);

  if (alreadyLiked) {
    post.likes = post.likes.filter((id) => id.toString() !== currentUserId);
  } else {
    post.likes.push(userObjectId);
  }

  await post.save();

  await User.updateOne({ _id: post.author._id }, { $inc: { points: 10 } });

  await post.populate('author', AUTHOR_FIELDS);

  const serialized = await serializeSinglePost(post, currentUserId);

  emitToUser(post.author._id.toString(), 'post:updated', serialized);

  if (!alreadyLiked) {
    await createNotification({
      recipientId: post.author._id.toString(),
      actorId: currentUserId,
      type: 'like',
      postId: post._id.toString(),
    });
    await User.updateOne({ _id: post.author._id }, { $inc: { points: 2 } });
  }

  return serialized;
}

export async function listComments(currentUserId: string, postId: string, limit = 50, before?: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  const query: Record<string, unknown> = { post: postId, parent: null };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const comments = await Comment.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  return {
    comments: comments.map((comment) => serializeComment(comment, currentUserId)),
    commentsCount: post.commentsCount,
  };
}

export async function listReplies(
  currentUserId: string,
  commentId: string,
  limit = 50,
  before?: string,
) {
  const parent = await Comment.findById(commentId);

  if (!parent) {
    throw new AppError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  const query: Record<string, unknown> = { parent: commentId };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const replies = await Comment.find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('author', AUTHOR_FIELDS);

  return {
    replies: replies.map((reply) => serializeComment(reply, currentUserId)),
    repliesCount: parent.repliesCount,
  };
}

export async function addComment(
  currentUserId: string,
  postId: string,
  text: string,
  parentId?: string,
) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  await assertCanSeePost(currentUserId, post.author.toString());

  let parentComment = null;

  if (parentId) {
    parentComment = await Comment.findById(parentId);

    if (!parentComment || parentComment.post.toString() !== postId) {
      throw new AppError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
    }
  }

  const comment = await Comment.create({
    post: postId,
    author: currentUserId,
    parent: parentId,
    text,
  });

  post.commentsCount += 1;
  await post.save();

  if (parentComment) {
    parentComment.repliesCount += 1;
    await parentComment.save();
  }

  await comment.populate('author', AUTHOR_FIELDS);
  const serialized = serializeComment(comment, currentUserId);

  emitToUser(post.author._id.toString(), 'comment:created', {
    postId,
    parentId: parentId ?? null,
    comment: serialized,
    commentsCount: post.commentsCount,
  });

  const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;

  if (parentComment) {
    await createNotification({
      recipientId: parentComment.author.toString(),
      actorId: currentUserId,
      type: 'reply',
      postId,
      commentId: comment._id.toString(),
      preview,
    });
  } else {
    await createNotification({
      recipientId: post.author._id.toString(),
      actorId: currentUserId,
      type: 'comment',
      postId,
      commentId: comment._id.toString(),
      preview,
    });
  }

  return { comment: serialized, commentsCount: post.commentsCount };
}

export async function toggleCommentLike(currentUserId: string, commentId: string) {
  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new AppError(404, 'Comment not found', 'COMMENT_NOT_FOUND');
  }

  const userObjectId = new Types.ObjectId(currentUserId);
  const alreadyLiked = comment.likes.some((id) => id.toString() === currentUserId);

  if (alreadyLiked) {
    comment.likes = comment.likes.filter((id) => id.toString() !== currentUserId);
  } else {
    comment.likes.push(userObjectId);
  }

  await comment.save();
  await comment.populate('author', AUTHOR_FIELDS);

  const serialized = serializeComment(comment, currentUserId);

  if (!alreadyLiked) {
    await createNotification({
      recipientId: comment.author._id.toString(),
      actorId: currentUserId,
      type: 'comment_like',
      postId: comment.post.toString(),
      commentId: comment._id.toString(),
      preview: comment.text.length > 80 ? `${comment.text.slice(0, 80)}…` : comment.text,
    });
  }

  return serialized;
}

export async function deletePost(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  if (post.author.toString() !== currentUserId) {
    throw new AppError(403, 'You can only delete your own posts', 'FORBIDDEN');
  }

  await Comment.deleteMany({ post: postId });
  await PostSave.deleteMany({ post: postId });
  await post.deleteOne();

  return { id: postId };
}

export async function toggleSave(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  await assertCanSeePost(currentUserId, post.author.toString());

  const existing = await PostSave.findOne({ user: currentUserId, post: postId });

  if (existing) {
    await existing.deleteOne();
  } else {
    await PostSave.create({ user: currentUserId, post: postId });
  }

  await post.populate('author', AUTHOR_FIELDS);

  return serializeSinglePost(post, currentUserId);
}

export async function listSavedPosts(currentUserId: string, limit = 20, before?: string) {
  const saveQuery: Record<string, unknown> = { user: currentUserId };

  if (before) {
    saveQuery.createdAt = { $lt: new Date(before) };
  }

  const saves = await PostSave.find(saveQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (saves.length === 0) {
    return { posts: [], nextCursor: null };
  }

  const postIds = saves.map((save) => save.post);
  const posts = await Post.find({ _id: { $in: postIds } }).populate('author', AUTHOR_FIELDS);

  const postById = new Map(posts.map((post) => [post._id.toString(), post]));
  const orderedPosts: PostDocument[] = [];

  for (const save of saves) {
    const post = postById.get(save.post.toString());
    if (post) {
      orderedPosts.push(post);
    }
  }

  const visiblePosts: PostDocument[] = [];
  for (const post of orderedPosts) {
    const authorId = (post.author as { _id: Types.ObjectId })._id.toString();
    try {
      await assertCanSeePost(currentUserId, authorId);
      visiblePosts.push(post);
    } catch {
      // Post is no longer visible — drop from the saved list response.
    }
  }

  const nextCursor =
    saves.length === limit ? saves[saves.length - 1].createdAt.toISOString() : null;

  return {
    posts: await serializePosts(visiblePosts, currentUserId),
    nextCursor,
  };
}
