export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccessBody<T> = {
  success: true;
  data: T;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type UserProfile = {
  id: string;
  email: string;
  profilePhotoUrl: string | null;
  emailVerified: boolean;
  givenName: string | null;
  surname: string | null;
  firstName: string | null;
  lastName: string | null;
  birthdate: string | null;
  gender: string | null;
  registrationCompleted: boolean;
  registrationStatus: 'pending_email' | 'pending_profile' | 'completed';
  parentalConsent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: UserProfile;
  tokens: AuthTokens;
};

export type RegisterResponse = {
  user: UserProfile;
  pendingSessionToken: string;
  message: string;
};

export type VerificationStatusResponse = {
  email: string;
  emailVerified: boolean;
  registrationStatus: UserProfile['registrationStatus'];
};

export type ResetCodeVerificationResponse = {
  resetToken: string;
  email: string;
  expiresInSeconds: number;
};

export type AuthorSummary = {
  id: string;
  name: string;
  avatarUri: string | null;
};

export type PostPlace = {
  name: string;
  logoUri: string | null;
  distanceKm: number | null;
};

export type PostReaction = 'like' | 'dislike' | 'love';

export type Post = {
  id: string;
  author: AuthorSummary;
  text: string | null;
  imageUri: string | null;
  imageUris: string[];
  reaction: PostReaction | null;
  place: PostPlace | null;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  timeAgo: string;
};

export type FeedResponse = {
  posts: Post[];
  nextCursor: string | null;
};

export type PostComment = {
  id: string;
  text: string;
  author: AuthorSummary;
  parentId: string | null;
  likesCount: number;
  likedByMe: boolean;
  repliesCount: number;
  createdAt: string;
  timeAgo: string;
};

export type CommentsResponse = {
  comments: PostComment[];
  commentsCount: number;
};

export type RepliesResponse = {
  replies: PostComment[];
  repliesCount: number;
};

export type AddCommentResponse = {
  comment: PostComment;
  commentsCount: number;
};

export type NotificationType = 'like' | 'comment' | 'reply' | 'comment_like';

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  preview: string | null;
  read: boolean;
  postId: string | null;
  actor: AuthorSummary | null;
  createdAt: string;
  timeAgo: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unreadCount: number;
};

export type Place = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string;
  rating: number | null;
  distanceKm: number | null;
  lat: number;
  lon: number;
  address: string | null;
  source: string;
};

export type PlacesResponse = {
  places: Place[];
  locationBased: boolean;
  provider: string;
};

export type PlaceDetail = Place & {
  description: string | null;
  website: string | null;
  wikipediaUrl: string | null;
};

export type PlaceEngagement = {
  likeCount: number;
  commentCount: number;
  visitorCount: number;
  postCount: number;
  likedByMe: boolean;
  visitors: AuthorSummary[];
};

export type PlaceComment = {
  id: string;
  text: string;
  author: AuthorSummary;
  createdAt: string;
  timeAgo: string;
};

export type PlaceCommentsResponse = {
  comments: PlaceComment[];
  nextCursor: string | null;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
