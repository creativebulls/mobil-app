import { apiRequest } from './client';
import type {
  AddCommentResponse,
  AuthorSummary,
  CommentsResponse,
  FeedResponse,
  Post,
  PostComment,
  PostReaction,
  RepliesResponse,
} from './types';

function guessUploadMime(uri: string, type: 'image' | 'video'): string {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();

  if (type === 'video') {
    if (extension === 'mov') return 'video/quicktime';
    if (extension === 'webm') return 'video/webm';
    if (extension === 'm4v') return 'video/x-m4v';
    return 'video/mp4';
  }

  if (extension === 'png') return 'image/png';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function guessUploadName(uri: string, type: 'image' | 'video', index: number): string {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (type === 'video') {
    if (extension === 'mov') return `post-${index}.mov`;
    if (extension === 'webm') return `post-${index}.webm`;
    return `post-${index}.mp4`;
  }
  if (extension === 'png') return `post-${index}.png`;
  if (extension === 'heic') return `post-${index}.heic`;
  return `post-${index}.jpg`;
}

export async function fetchFeed(cursor?: string | null, limit = 20): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) {
    params.set('before', cursor);
  }

  return apiRequest<FeedResponse>(`/posts?${params.toString()}`);
}

export async function searchPosts(query: string): Promise<{ posts: Post[] }> {
  const params = new URLSearchParams();
  params.set('q', query);
  return apiRequest<{ posts: Post[] }>(`/posts/search?${params.toString()}`);
}

export async function createPost(input: {
  text?: string;
  media?: { uri: string; type: 'image' | 'video'; thumbnailUri?: string | null }[];
  reaction?: PostReaction | null;
  placeName: string;
  placeId?: string;
  placeImageUrl?: string;
  placeDistanceKm?: number;
  mentionedUserIds?: string[];
}): Promise<Post> {
  const formData = new FormData();

  if (input.text) {
    formData.append('text', input.text);
  }

  if (input.reaction) {
    formData.append('reaction', input.reaction);
  }

  formData.append('placeName', input.placeName);

  if (input.placeId) {
    formData.append('placeId', input.placeId);
  }

  if (input.mentionedUserIds && input.mentionedUserIds.length > 0) {
    formData.append('mentionedUserIds', JSON.stringify(input.mentionedUserIds));
  }

  if (input.placeImageUrl) {
    formData.append('placeImageUrl', input.placeImageUrl);
  }

  if (typeof input.placeDistanceKm === 'number') {
    formData.append('placeDistanceKm', String(input.placeDistanceKm));
  }

  (input.media ?? []).forEach((item, index) => {
    const isVideo = item.type === 'video';
    formData.append('images', {
      uri: item.uri,
      name: guessUploadName(item.uri, item.type, index),
      type: guessUploadMime(item.uri, item.type),
    } as unknown as Blob);
  });

  (input.media ?? []).forEach((item, index) => {
    if (item.type === 'video' && item.thumbnailUri) {
      formData.append('videoPosters', {
        uri: item.thumbnailUri,
        name: `poster-${index}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
    }
  });

  return apiRequest<Post>('/posts', {
    method: 'POST',
    formData,
  });
}

export async function fetchPost(postId: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${postId}`);
}

export async function recordPostView(postId: string): Promise<{ viewsCount: number }> {
  return apiRequest<{ viewsCount: number }>(`/posts/${postId}/view`, { method: 'POST', body: {} });
}

export async function toggleLike(postId: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${postId}/like`, { method: 'POST', body: {} });
}

export async function toggleSavePost(postId: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${postId}/save`, { method: 'POST', body: {} });
}

export async function fetchSavedPosts(cursor?: string | null, limit = 20): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) {
    params.set('before', cursor);
  }

  return apiRequest<FeedResponse>(`/posts/saved?${params.toString()}`);
}

export async function fetchPostLikers(postId: string): Promise<{ users: AuthorSummary[] }> {
  return apiRequest<{ users: AuthorSummary[] }>(`/posts/${postId}/likes`);
}

export async function fetchComments(postId: string, cursor?: string | null): Promise<CommentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (cursor) {
    params.set('before', cursor);
  }

  return apiRequest<CommentsResponse>(`/posts/${postId}/comments?${params.toString()}`);
}

export async function addComment(
  postId: string,
  text: string,
  parentId?: string,
): Promise<AddCommentResponse> {
  return apiRequest<AddCommentResponse>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: parentId ? { text, parentId } : { text },
  });
}

export async function fetchReplies(commentId: string, cursor?: string | null): Promise<RepliesResponse> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (cursor) {
    params.set('before', cursor);
  }

  return apiRequest<RepliesResponse>(`/comments/${commentId}/replies?${params.toString()}`);
}

export async function toggleCommentLike(commentId: string): Promise<PostComment> {
  return apiRequest<PostComment>(`/comments/${commentId}/like`, { method: 'POST', body: {} });
}

export async function deletePost(postId: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/posts/${postId}`, { method: 'DELETE' });
}
