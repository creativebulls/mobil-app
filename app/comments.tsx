import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addComment,
  fetchComments,
  fetchPost,
  fetchReplies,
  toggleCommentLike,
} from '../src/api/postsApi';
import { getErrorMessage, type Post, type PostComment } from '../src/api/types';
import { CommentComposer } from '../src/components/CommentComposer';
import { CommentItem } from '../src/components/CommentItem';
import { FeedPostCard } from '../src/components/FeedPostCard';
import { useRealtimeEvent } from '../src/hooks/useRealtimeEvent';
import { getStoredUser } from '../src/storage/authSession';
import { hidePost } from '../src/storage/hiddenPosts';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

type ReplyTarget = { parentId: string; name: string };

export default function PostDetailScreen() {
  const router = useRouter();
  const { postId, highlightCommentId } = useLocalSearchParams<{
    postId: string;
    highlightCommentId?: string;
  }>();

  const [post, setPost] = useState<Post | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [repliesByParent, setRepliesByParent] = useState<Record<string, PostComment[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [repliesLoading, setRepliesLoading] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<PostComment>>(null);
  const didHighlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!postId) {
      return;
    }

    try {
      const [postData, commentData, user] = await Promise.all([
        fetchPost(postId),
        fetchComments(postId),
        getStoredUser(),
      ]);
      setPost(postData);
      setComments(commentData.comments);
      setCurrentUserId(user?.id ?? null);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (didHighlightRef.current || !highlightCommentId || isLoading) {
      return;
    }
    const index = comments.findIndex((comment) => comment.id === highlightCommentId);
    if (index < 0) {
      return;
    }
    didHighlightRef.current = true;
    setHighlightId(highlightCommentId);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
    });
    const timeout = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timeout);
  }, [comments, highlightCommentId, isLoading]);

  function patchComment(commentId: string, patch: Partial<PostComment>) {
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, ...patch } : comment)),
    );
    setRepliesByParent((current) => {
      let changed = false;
      const next: Record<string, PostComment[]> = {};
      for (const [parentId, replies] of Object.entries(current)) {
        next[parentId] = replies.map((reply) => {
          if (reply.id === commentId) {
            changed = true;
            return { ...reply, ...patch };
          }
          return reply;
        });
      }
      return changed ? next : current;
    });
  }

  useRealtimeEvent<{ postId: string; parentId: string | null; comment: PostComment }>(
    'comment:created',
    (payload) => {
      if (payload.postId !== postId) {
        return;
      }

      if (payload.parentId) {
        setRepliesByParent((current) => {
          const existing = current[payload.parentId!];
          if (!existing || existing.some((reply) => reply.id === payload.comment.id)) {
            return current;
          }
          return { ...current, [payload.parentId!]: [...existing, payload.comment] };
        });
      } else {
        setComments((current) =>
          current.some((comment) => comment.id === payload.comment.id)
            ? current
            : [payload.comment, ...current],
        );
      }
    },
  );

  async function handleLikeComment(comment: PostComment) {
    const optimistic: Partial<PostComment> = {
      likedByMe: !comment.likedByMe,
      likesCount: comment.likesCount + (comment.likedByMe ? -1 : 1),
    };
    patchComment(comment.id, optimistic);

    try {
      const updated = await toggleCommentLike(comment.id);
      patchComment(comment.id, {
        likedByMe: updated.likedByMe,
        likesCount: updated.likesCount,
      });
    } catch {
      patchComment(comment.id, {
        likedByMe: comment.likedByMe,
        likesCount: comment.likesCount,
      });
    }
  }

  function handleReplyPress(comment: PostComment) {
    const parentId = comment.parentId ?? comment.id;
    setReplyTarget({ parentId, name: comment.author.name });
    inputRef.current?.focus();
  }

  async function handleToggleReplies(comment: PostComment) {
    const isOpen = expanded[comment.id];

    if (isOpen) {
      setExpanded((current) => ({ ...current, [comment.id]: false }));
      return;
    }

    if (!repliesByParent[comment.id]) {
      setRepliesLoading((current) => ({ ...current, [comment.id]: true }));
      try {
        const result = await fetchReplies(comment.id);
        setRepliesByParent((current) => ({ ...current, [comment.id]: result.replies }));
      } catch {
        // ignore
      } finally {
        setRepliesLoading((current) => ({ ...current, [comment.id]: false }));
      }
    }

    setExpanded((current) => ({ ...current, [comment.id]: true }));
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !postId || isSending) {
      return;
    }

    setIsSending(true);

    try {
      if (replyTarget) {
        const result = await addComment(postId, text, replyTarget.parentId);
        const parentId = replyTarget.parentId;

        setRepliesByParent((current) => {
          const existing = current[parentId] ?? [];
          if (existing.some((reply) => reply.id === result.comment.id)) {
            return current;
          }
          return { ...current, [parentId]: [...existing, result.comment] };
        });
        setExpanded((current) => ({ ...current, [parentId]: true }));
        setComments((current) =>
          current.map((comment) =>
            comment.id === parentId
              ? { ...comment, repliesCount: comment.repliesCount + 1 }
              : comment,
          ),
        );
      } else {
        const result = await addComment(postId, text);
        setComments((current) =>
          current.some((comment) => comment.id === result.comment.id)
            ? current
            : [result.comment, ...current],
        );
      }

      setPost((current) =>
        current ? { ...current, commentsCount: current.commentsCount + 1 } : current,
      );
      setDraft('');
      setReplyTarget(null);
    } catch (error) {
      getErrorMessage(error);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
                }, 300);
              }}
              ListHeaderComponent={
                <View>
                  {post ? (
                    <FeedPostCard
                      post={post}
                      currentUserId={currentUserId}
                      onChanged={(updated) => setPost(updated)}
                      onDeleted={() => router.back()}
                      onHidden={(id) => {
                        void hidePost(id);
                        router.back();
                      }}
                      onCommentPress={() => inputRef.current?.focus()}
                      onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
                    />
                  ) : null}
                  <Text style={styles.commentsTitle}>
                    {post?.commentsCount ?? comments.length}{' '}
                    {(post?.commentsCount ?? comments.length) === 1 ? 'Comment' : 'Comments'}
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No comments yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first to comment.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.commentBlock, highlightId === item.id && styles.commentHighlight]}>
                  <CommentItem
                    comment={item}
                    onLike={handleLikeComment}
                    onReply={handleReplyPress}
                    onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
                  />

                  {item.repliesCount > 0 ? (
                    <Pressable
                      onPress={() => handleToggleReplies(item)}
                      style={styles.repliesToggle}
                      hitSlop={6}
                    >
                      <View style={styles.repliesLine} />
                      {repliesLoading[item.id] ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Text style={styles.repliesToggleText}>
                          {expanded[item.id]
                            ? 'Hide replies'
                            : `View ${item.repliesCount} ${item.repliesCount === 1 ? 'reply' : 'replies'}`}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}

                  {expanded[item.id]
                    ? (repliesByParent[item.id] ?? []).map((reply) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          isReply
                          onLike={handleLikeComment}
                          onReply={handleReplyPress}
                          onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
                        />
                      ))
                    : null}
                </View>
              )}
            />
          )}

          {replyTarget ? (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to {replyTarget.name}</Text>
              <Pressable onPress={() => setReplyTarget(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <CommentComposer
            inputRef={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={replyTarget ? `Reply to ${replyTarget.name}...` : 'Add a comment...'}
            onSend={handleSend}
            isSending={isSending}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSpacer: {
    width: 26,
  },
  loader: {
    paddingVertical: 32,
  },
  list: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  commentBlock: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  commentHighlight: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
  },
  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 48,
    marginTop: 10,
  },
  repliesLine: {
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  repliesToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.inputGray,
  },
  replyBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
