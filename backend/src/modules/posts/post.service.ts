import { Types } from 'mongoose';

import { AppError } from '../../shared/errors/AppError';
import { formatRelativeTime } from '../../shared/utils/time';
import { emitToUser, getSocketServer } from '../../socket/index';
import { User } from '../users/user.model';
import { createNotification } from '../notifications/notification.service';
import { Comment, type CommentDocument } from './comment.model';
import { Post, type PostDocument } from './post.model';

function resolvePostImageUrl(filename: string): string {
  return `/uploads/posts/${filename}`;
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

function serializePost(post: PostDocument, currentUserId: string) {
  const author = post.author as unknown as PopulatedUser;
  const likes = post.likes.map((id) => id.toString());
  const imageUris =
    post.images && post.images.length > 0
      ? post.images
      : post.imageUrl
        ? [post.imageUrl]
        : [];

  return {
    id: post._id.toString(),
    author: serializeUserSummary(author),
    text: post.text ?? null,
    imageUri: imageUris[0] ?? null,
    imageUris,
    reaction: post.reaction ?? null,
    place: post.place
      ? {
          name: post.place.name,
          logoUri: post.place.logoUrl ?? null,
          distanceKm: post.place.distanceKm ?? null,
        }
      : null,
    likesCount: likes.length,
    commentsCount: post.commentsCount,
    likedByMe: likes.includes(currentUserId),
    createdAt: post.createdAt.toISOString(),
    timeAgo: formatRelativeTime(post.createdAt),
  };
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

export async function createPost(input: {
  authorId: string;
  text?: string;
  imageFilenames?: string[];
  reaction?: 'like' | 'dislike' | 'love';
  placeName?: string;
  placeDistanceKm?: number;
}) {
  const imageFilenames = input.imageFilenames ?? [];

  if (!input.text && imageFilenames.length === 0) {
    throw new AppError(422, 'A post must include text or an image', 'EMPTY_POST');
  }

  const author = await User.findById(input.authorId);

  if (!author) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  const images = imageFilenames.map(resolvePostImageUrl);

  const post = await Post.create({
    author: input.authorId,
    text: input.text,
    imageUrl: images[0],
    images,
    reaction: input.reaction,
    place: input.placeName
      ? {
          name: input.placeName,
          logoUrl: author.profilePhotoUrl,
          distanceKm: input.placeDistanceKm,
        }
      : undefined,
    likes: [],
    commentsCount: 0,
  });

  await post.populate('author', AUTHOR_FIELDS);

  const serialized = serializePost(post, input.authorId);

  const io = (() => {
    try {
      return getSocketServer();
    } catch {
      return null;
    }
  })();

  io?.emit('post:created', serialized);

  return serialized;
}

export async function getFeed(currentUserId: string, limit = 20, before?: string) {
  const query: Record<string, unknown> = {};

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
    posts: posts.map((post) => serializePost(post, currentUserId)),
    nextCursor,
  };
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
    posts: posts.map((post) => serializePost(post, currentUserId)),
    nextCursor,
  };
}

export async function getPost(currentUserId: string, postId: string) {
  const post = await Post.findById(postId).populate('author', AUTHOR_FIELDS);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  return serializePost(post, currentUserId);
}

export async function toggleLike(currentUserId: string, postId: string) {
  const post = await Post.findById(postId);

  if (!post) {
    throw new AppError(404, 'Post not found', 'POST_NOT_FOUND');
  }

  const userObjectId = new Types.ObjectId(currentUserId);
  const alreadyLiked = post.likes.some((id) => id.toString() === currentUserId);

  if (alreadyLiked) {
    post.likes = post.likes.filter((id) => id.toString() !== currentUserId);
  } else {
    post.likes.push(userObjectId);
  }

  await post.save();
  await post.populate('author', AUTHOR_FIELDS);

  const serialized = serializePost(post, currentUserId);

  emitToUser(post.author._id.toString(), 'post:updated', serialized);

  if (!alreadyLiked) {
    await createNotification({
      recipientId: post.author._id.toString(),
      actorId: currentUserId,
      type: 'like',
      postId: post._id.toString(),
    });
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
      preview,
    });
  } else {
    await createNotification({
      recipientId: post.author._id.toString(),
      actorId: currentUserId,
      type: 'comment',
      postId,
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
  await post.deleteOne();

  return { id: postId };
}
