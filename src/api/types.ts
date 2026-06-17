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
  statusText: string | null;
  points: number;
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

export type NotificationType =
  | 'like'
  | 'comment'
  | 'reply'
  | 'comment_like'
  | 'friend_request'
  | 'friend_request_accepted';

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  preview: string | null;
  read: boolean;
  postId: string | null;
  commentId: string | null;
  friendRequestId: string | null;
  friendRequestStatus: 'pending' | 'accepted' | 'rejected' | null;
  actor: AuthorSummary | null;
  createdAt: string;
  timeAgo: string;
};

export type UserSearchResult = AuthorSummary & {
  statusText: string | null;
  isFriend: boolean;
  friendRequestStatus: 'sent' | 'received' | null;
};

export type UserRelationship = {
  isSelf: boolean;
  isFriend: boolean;
  friendRequestStatus: 'sent' | 'received' | null;
  friendRequestId: string | null;
  blockedByMe?: boolean;
  blockedMe?: boolean;
  restrictedByMe?: boolean;
  isPrivate?: boolean;
  isLocked?: boolean;
};

export type PushPreferences = {
  likes: boolean;
  comments: boolean;
  friendRequests: boolean;
  messages: boolean;
};

export type UserSettings = {
  isPrivate: boolean;
  pushPreferences: PushPreferences;
};

export type ChatUser = {
  id: string;
  name: string;
  avatarUri: string | null;
};

export type ConversationParticipant = ChatUser;

export type SharedPlace = {
  placeId: string;
  name: string;
  imageUrl: string | null;
};

export type MessageMedia = {
  url: string;
  mediaType: 'image' | 'video';
  width: number | null;
  height: number | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string | null;
  senderAvatar: string | null;
  recipientId: string | null;
  text: string;
  sharedPlace: SharedPlace | null;
  media: MessageMedia | null;
  read: boolean;
  createdAt: string;
  timeAgo: string;
};

export type ConversationSummary = {
  id: string;
  isGroup: boolean;
  name: string;
  avatarUri: string | null;
  memberCount: number;
  isOnline: boolean;
  user: ChatUser | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  timeAgo: string | null;
  unreadCount: number;
};

export type ConversationsResponse = {
  conversations: ConversationSummary[];
};

export type ConversationMeta = {
  id: string;
  isGroup: boolean;
  name: string | null;
  avatarUri: string | null;
  ownerId: string | null;
  memberCount: number;
  participants: ChatUser[];
};

export type MessagesResponse = {
  messages: ChatMessage[];
  nextCursor: string | null;
  user: ChatUser | null;
  conversation: ConversationMeta;
};

export type CreateGroupResponse = {
  id: string;
  name: string;
  memberCount: number;
  avatarUri: string | null;
};

export type SendMessageResponse = {
  message: ChatMessage;
  conversationId: string;
};

export type OpenConversationResponse = {
  id: string;
  user: ChatUser;
};

export type PublicUserProfile = {
  id: string;
  name: string;
  avatarUri: string | null;
  statusText: string | null;
  points: number;
  friendsCount: number;
  postsCount: number;
};

export type UserProfileResponse = {
  user: PublicUserProfile;
  relationship: UserRelationship;
  posts: Post[];
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
