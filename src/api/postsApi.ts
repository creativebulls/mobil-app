import { apiRequest } from './client';
import type {
  AddCommentResponse,
  CommentsResponse,
  FeedResponse,
  Post,
  PostComment,
  PostReaction,
  RepliesResponse,
} from './types';

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
  imageUris?: string[];
  reaction?: PostReaction | null;
  placeName?: string;
  placeDistanceKm?: number;
}): Promise<Post> {
  const formData = new FormData();

  if (input.text) {
    formData.append('text', input.text);
  }

  if (input.reaction) {
    formData.append('reaction', input.reaction);
  }

  if (input.placeName) {
    formData.append('placeName', input.placeName);
  }

  if (typeof input.placeDistanceKm === 'number') {
    formData.append('placeDistanceKm', String(input.placeDistanceKm));
  }

  (input.imageUris ?? []).forEach((uri, index) => {
    formData.append('images', {
      uri,
      name: `post-${index}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });

  return apiRequest<Post>('/posts', {
    method: 'POST',
    formData,
  });
}

export async function fetchPost(postId: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${postId}`);
}

export async function toggleLike(postId: string): Promise<Post> {
  return apiRequest<Post>(`/posts/${postId}/like`, { method: 'POST', body: {} });
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
