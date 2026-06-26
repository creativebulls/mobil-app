import { router } from 'expo-router';

type PushNavigationData = {
  type?: string;
  postId?: string;
  commentId?: string;
  friendRequestId?: string;
  conversationId?: string;
  sessionId?: string;
  adminName?: string;
  senderName?: string;
  senderId?: string;
  isGroup?: string;
};

/** Navigate from push notification / Notifee tap payload. Returns true if handled. */
export function navigateFromPushData(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) {
    return false;
  }

  const data = raw as PushNavigationData;

  if (data.type === 'live_request' && data.sessionId) {
    return false;
  }

  if (data.type === 'incoming_call') {
    return true;
  }

  if (data.type === 'missed_call') {
    router.push('/call-history');
    return true;
  }

  if (data.type === 'message' && data.conversationId) {
    router.push({
      pathname: '/chat',
      params: {
        conversationId: data.conversationId,
        name: data.senderName ?? 'Chat',
        userId: data.senderId ?? '',
        isGroup: data.isGroup === '1' ? '1' : '',
      },
    });
    return true;
  }

  if (data.postId) {
    router.push({
      pathname: '/comments',
      params: {
        postId: String(data.postId),
        ...(data.commentId ? { highlightCommentId: String(data.commentId) } : {}),
      },
    });
    return true;
  }

  if (data.type === 'friend_request' || data.type === 'friend_request_accepted') {
    router.push('/notifications');
    return true;
  }

  return false;
}

export function navigateToPost(postId: string, commentId?: string | null) {
  router.push({
    pathname: '/comments',
    params: {
      postId,
      ...(commentId ? { highlightCommentId: commentId } : {}),
    },
  });
}
