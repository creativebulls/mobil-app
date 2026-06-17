import { apiRequest } from './client';
import type {
  AuthorSummary,
  FeedResponse,
  Post,
  PushPreferences,
  UserProfileResponse,
  UserRelationship,
  UserSearchResult,
  UserSettings,
} from './types';

export type ConnectCodeResolution = {
  user: AuthorSummary & { statusText: string | null };
  relationship: UserRelationship;
};

export type RelationUser = {
  id: string;
  name: string;
  avatarUri: string | null;
};

export type ProfileStats = {
  points: number;
  friendsCount: number;
  postsCount: number;
  statusText: string | null;
};

export type FavoritePlace = {
  id: string;
  name: string;
  imageUrl: string;
  rating: number | null;
  reaction: string | null;
};

export type FriendSummary = {
  id: string;
  name: string;
  avatarUri: string | null;
  statusText: string | null;
  isOnline?: boolean;
};

export async function fetchProfileStats(): Promise<ProfileStats> {
  return apiRequest<ProfileStats>('/profile/stats');
}

export async function updateProfileStatus(statusText: string): Promise<{ statusText: string | null }> {
  return apiRequest<{ statusText: string | null }>('/profile/status', {
    method: 'PATCH',
    body: { statusText },
  });
}

export async function fetchMyPosts(cursor?: string | null): Promise<FeedResponse> {
  const params = new URLSearchParams();
  params.set('limit', '20');
  if (cursor) {
    params.set('before', cursor);
  }
  return apiRequest<FeedResponse>(`/profile/posts?${params.toString()}`);
}

export async function fetchFavoritePlaces(): Promise<{ places: FavoritePlace[] }> {
  return apiRequest<{ places: FavoritePlace[] }>('/profile/favorite-places');
}

export async function fetchFriends(): Promise<{ friends: FriendSummary[] }> {
  return apiRequest<{ friends: FriendSummary[] }>('/friends');
}

export async function searchUsers(query: string): Promise<{ users: UserSearchResult[] }> {
  const params = new URLSearchParams();
  params.set('q', query);
  return apiRequest<{ users: UserSearchResult[] }>(`/friends/search?${params.toString()}`);
}

export async function sendFriendRequest(userId: string): Promise<{ requestId: string; status: string }> {
  return apiRequest<{ requestId: string; status: string }>(`/friends/${userId}/request`, {
    method: 'POST',
  });
}

export async function acceptFriendRequest(requestId: string): Promise<{ requestId: string; status: string }> {
  return apiRequest<{ requestId: string; status: string }>(`/friends/requests/${requestId}/accept`, {
    method: 'POST',
  });
}

export async function fetchUserProfile(userId: string): Promise<UserProfileResponse> {
  return apiRequest<UserProfileResponse>(`/profile/users/${userId}`);
}

export async function fetchSettings(): Promise<UserSettings> {
  return apiRequest<UserSettings>('/profile/settings');
}

export async function updateSettings(input: {
  isPrivate?: boolean;
  pushPreferences?: Partial<PushPreferences>;
}): Promise<UserSettings> {
  return apiRequest<UserSettings>('/profile/settings', {
    method: 'PATCH',
    body: input,
  });
}

export async function fetchBlockedUsers(): Promise<{ users: RelationUser[] }> {
  return apiRequest<{ users: RelationUser[] }>('/relations/blocked');
}

export async function fetchRestrictedUsers(): Promise<{ users: RelationUser[] }> {
  return apiRequest<{ users: RelationUser[] }>('/relations/restricted');
}

export async function rejectFriendRequest(requestId: string): Promise<{ requestId: string; status: string }> {
  return apiRequest<{ requestId: string; status: string }>(`/friends/requests/${requestId}/reject`, {
    method: 'POST',
  });
}

export async function fetchMyConnectCode(): Promise<{ code: string }> {
  return apiRequest<{ code: string }>('/friends/connect-code');
}

export async function resolveConnectCode(code: string): Promise<ConnectCodeResolution> {
  return apiRequest<ConnectCodeResolution>(`/friends/connect/${encodeURIComponent(code)}`);
}

export type { Post, UserProfileResponse };
