import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addPlaceComment,
  fetchPlaceComments,
  fetchPlaceDetails,
  fetchPlaceEngagement,
  fetchPlacePosts,
  recordPlaceVisit,
  togglePlaceLike,
} from '../src/api/placesApi';
import {
  getErrorMessage,
  type PlaceComment,
  type PlaceDetail,
  type PlaceEngagement,
  type Post,
} from '../src/api/types';
import { CommentComposer } from '../src/components/CommentComposer';
import { Avatar } from '../src/components/Avatar';
import { FeedPostCard } from '../src/components/FeedPostCard';
import { OfflineEmptyState } from '../src/components/OfflineEmptyState';
import { SharePlaceModal } from '../src/components/SharePlaceModal';
import { useIsOnline } from '../src/hooks/useIsOnline';
import { getStoredUser } from '../src/storage/authSession';
import { openUserProfile } from '../src/utils/openUserProfile';
import { colors } from '../src/theme/colors';

const HERO_HEIGHT = 280;

type PlaceTab = 'info' | 'points' | 'posts';

const TABS: { key: PlaceTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'info', label: 'Info', icon: 'information-circle-outline' },
  { key: 'points', label: 'Points', icon: 'pricetags-outline' },
  { key: 'posts', label: 'Posts', icon: 'images-outline' },
];

const EMPTY_ENGAGEMENT: PlaceEngagement = {
  likeCount: 0,
  commentCount: 0,
  visitorCount: 0,
  postCount: 0,
  likedByMe: false,
  visitors: [],
};

export default function PlaceDetailScreen() {
  const router = useRouter();
  const online = useIsOnline();
  const params = useLocalSearchParams<{ id: string; name?: string; imageUrl?: string }>();
  const placeId = String(params.id);

  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [engagement, setEngagement] = useState<PlaceEngagement>(EMPTY_ENGAGEMENT);
  const [comments, setComments] = useState<PlaceComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PlaceTab>('info');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      // Record the visit first (idempotent) so the current user is included
      // in the visitor count and avatar preview.
      await recordPlaceVisit(placeId).catch(() => undefined);

      const [detailResult, engagementResult, commentsResult] = await Promise.all([
        fetchPlaceDetails(placeId),
        fetchPlaceEngagement(placeId),
        fetchPlaceComments(placeId),
      ]);
      setDetail(detailResult);
      setEngagement(engagementResult);
      setComments(commentsResult.comments);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this place'));
    } finally {
      setIsLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    void load();
    getStoredUser()
      .then((user) => setCurrentUserId(user?.id ?? null))
      .catch(() => undefined);
  }, [load]);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const result = await fetchPlacePosts(placeId);
      setPosts(result.posts);
    } catch {
      // keep empty
    } finally {
      setPostsLoaded(true);
      setPostsLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    if (activeTab === 'posts' && !postsLoaded && !postsLoading) {
      void loadPosts();
    }
  }, [activeTab, postsLoaded, postsLoading, loadPosts]);

  // Refresh posts + engagement when returning to the screen (e.g. after
  // creating a post for this place).
  useFocusEffect(
    useCallback(() => {
      if (postsLoaded) {
        void loadPosts();
      }
      fetchPlaceEngagement(placeId)
        .then(setEngagement)
        .catch(() => undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeId, postsLoaded]),
  );

  const name = detail?.name ?? params.name ?? 'Place';
  const imageUrl = detail?.imageUrl ?? params.imageUrl;
  // Extra photos beyond the hero image, for the gallery strip.
  const galleryPhotos = (detail?.photos ?? []).filter((url) => url && url !== imageUrl);

  const metaParts: string[] = [];
  if (typeof detail?.distanceKm === 'number') {
    metaParts.push(`${detail.distanceKm.toFixed(detail.distanceKm < 10 ? 1 : 0)} KM away`);
  }
  if (detail?.category) {
    metaParts.push(detail.category);
  }

  async function handleLike() {
    setEngagement((prev) => ({
      ...prev,
      likedByMe: !prev.likedByMe,
      likeCount: prev.likeCount + (prev.likedByMe ? -1 : 1),
    }));

    try {
      const result = await togglePlaceLike(placeId);
      setEngagement((prev) => ({ ...prev, likedByMe: result.liked, likeCount: result.likeCount }));
    } catch {
      setEngagement((prev) => ({
        ...prev,
        likedByMe: !prev.likedByMe,
        likeCount: prev.likeCount + (prev.likedByMe ? -1 : 1),
      }));
    }
  }

  function handleShare() {
    setShareVisible(true);
  }

  function openCreatePost() {
    router.push({ pathname: '/create-post', params: { placeName: name } });
  }

  function openInMaps() {
    if (!detail) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${detail.lat},${detail.lon}`)}`;
    void Linking.openURL(url);
  }

  async function handleSubmitComment() {
    const text = commentText.trim();
    if (!text || isPosting) {
      return;
    }

    setIsPosting(true);
    try {
      const { comment, commentCount } = await addPlaceComment(placeId, text);
      setComments((prev) => [comment, ...prev]);
      setEngagement((prev) => ({ ...prev, commentCount }));
      setCommentText('');
    } catch {
      // keep text so the user can retry
    } finally {
      setIsPosting(false);
    }
  }

  // Nothing cached for this place and no connectivity → show a clear offline
  // screen rather than an empty/broken layout.
  if (!isLoading && !detail && !online) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <SafeAreaView edges={['top']} style={styles.offlineBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        </SafeAreaView>
        <OfflineEmptyState
          onRetry={() => {
            setError(null);
            setIsLoading(true);
            void load();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]} />
            )}
            <View style={styles.heroScrim} />

            <SafeAreaView edges={['top']} style={styles.heroBar}>
              <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8} accessibilityLabel="Back">
                <Ionicons name="chevron-back" size={24} color={colors.white} />
              </Pressable>
              <Pressable onPress={handleShare} style={styles.iconButton} hitSlop={8} accessibilityLabel="Share">
                <Ionicons name="share-social-outline" size={20} color={colors.white} />
              </Pressable>
            </SafeAreaView>
          </View>

          {galleryPhotos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.gallery}
              contentContainerStyle={styles.galleryContent}
            >
              {galleryPhotos.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.galleryThumb} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.name}>{name}</Text>
              {typeof detail?.rating === 'number' ? (
                <View style={styles.ratingPill}>
                  <Ionicons name="star" size={13} color={colors.brand} />
                  <Text style={styles.ratingText}>{detail.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.tabBar}>
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                const postCount = postsLoaded ? posts.length : engagement?.postCount ?? 0;
                const label =
                  tab.key === 'posts' && postCount > 0 ? `${tab.label} (${postCount})` : tab.label;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={16}
                      color={active ? colors.brand : colors.textSecondary}
                    />
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'info' ? (
              <View style={styles.tabContent}>
            {metaParts.length > 0 ? <Text style={styles.meta}>{metaParts.join(' · ')}</Text> : null}

            {detail?.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={18} color={colors.brand} />
                <Text style={styles.address}>{detail.address}</Text>
              </View>
            ) : null}

            <View style={styles.visitorBlock}>
              <Text style={styles.visitorText}>
                {engagement.visitorCount === 0
                  ? 'Be the first to visit this place'
                  : `${engagement.visitorCount} ${engagement.visitorCount === 1 ? 'person' : 'people'} already visited this place`}
              </Text>

              {engagement.visitors.length > 0 ? (
                <View style={styles.avatarStack}>
                  {engagement.visitors.map((visitor, index) => (
                    <View
                      key={visitor.id}
                      style={[styles.avatarWrap, index > 0 && styles.avatarOverlap]}
                    >
                      <Avatar uri={visitor.avatarUri} name={visitor.name} size={36} />
                    </View>
                  ))}

                  {engagement.visitorCount > engagement.visitors.length ? (
                    <View style={[styles.avatarWrap, styles.avatarOverlap, styles.moreBadge]}>
                      <Text style={styles.moreBadgeText}>
                        +{engagement.visitorCount - engagement.visitors.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.actionBar}>
              <Pressable onPress={handleLike} style={styles.action} hitSlop={6} accessibilityLabel="Like">
                <Ionicons
                  name={engagement.likedByMe ? 'heart' : 'heart-outline'}
                  size={22}
                  color={engagement.likedByMe ? colors.brand : colors.text}
                />
                <Text style={styles.actionText}>{engagement.likeCount}</Text>
              </Pressable>

              <View style={styles.action}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>{engagement.commentCount}</Text>
              </View>

              <Pressable onPress={handleShare} style={styles.action} hitSlop={6} accessibilityLabel="Share">
                <Ionicons name="share-social-outline" size={20} color={colors.text} />
                <Text style={styles.actionText}>Share</Text>
              </Pressable>

              <Pressable onPress={openInMaps} style={[styles.action, styles.actionRight]} hitSlop={6}>
                <Ionicons name="navigate" size={18} color={colors.brand} />
                <Text style={[styles.actionText, styles.actionTextBrand]}>Directions</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator color={colors.brand} style={styles.loader} />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <>
                {detail?.description ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.description}>{detail.description}</Text>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Comments{engagement.commentCount ? ` (${engagement.commentCount})` : ''}
                  </Text>

                  <CommentComposer
                    embedded
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Share your experience…"
                    onSend={handleSubmitComment}
                    isSending={isPosting}
                    sendIcon="send"
                  />

                  {comments.length === 0 ? (
                    <Text style={styles.noComments}>No comments yet. Be the first to share!</Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        <Avatar uri={comment.author.avatarUri} name={comment.author.name} size={40} />
                        <View style={styles.commentBody}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentAuthor} numberOfLines={1}>
                              {comment.author.name}
                            </Text>
                            <Text style={styles.commentTime}>{comment.timeAgo}</Text>
                          </View>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
              </View>
            ) : null}

            {activeTab === 'points' ? (
              <View style={styles.tabContent}>
                <View style={styles.pointsCard}>
                  <Ionicons name="pricetags" size={28} color={colors.brand} />
                  <Text style={styles.sectionTitle}>Exchange Points</Text>
                  <Text style={styles.description}>
                    Earn points every time you visit, post, or check in at this place. Redeem your
                    points for exclusive rewards and offers here. (Coming soon.)
                  </Text>
                </View>
              </View>
            ) : null}

            {activeTab === 'posts' ? (
              postsLoading ? (
                <ActivityIndicator color={colors.brand} style={styles.loader} />
              ) : posts.length === 0 ? (
                <Text style={[styles.noComments, styles.tabContent]}>
                  No posts about this place yet.
                </Text>
              ) : (
                <View style={styles.postsTab}>
                  {posts.map((post) => (
                    <FeedPostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      onChanged={(updated) =>
                        setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                      }
                      onDeleted={(postId) =>
                        setPosts((prev) => prev.filter((p) => p.id !== postId))
                      }
                      onCommentPress={(p) =>
                        router.push({ pathname: '/comments', params: { postId: p.id } })
                      }
                      onAuthorPress={(authorId) => openUserProfile(router, authorId, currentUserId)}
                    />
                  ))}
                </View>
              )
            ) : null}
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.reviewBar}>
          <View style={styles.reviewTextBlock}>
            <Text style={styles.reviewTitle}>Write a review</Text>
            <Text style={styles.reviewSubtitle}>
              and earn <Text style={styles.reviewPoints}>315 points</Text>
            </Text>
          </View>

          <Pressable
            onPress={openCreatePost}
            style={({ pressed }) => [styles.createPostButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Create post"
          >
            <Ionicons name="create-outline" size={18} color={colors.white} />
            <Text style={styles.createPostButtonText}>Create post</Text>
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <SharePlaceModal
        visible={shareVisible}
        place={{ placeId, name, imageUrl: imageUrl ?? null }}
        onClose={() => setShareVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 110,
  },
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.inputGray,
  },
  heroPlaceholder: {
    backgroundColor: colors.inputGray,
  },
  offlineBar: {
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  gallery: {
    marginTop: 12,
  },
  galleryContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  galleryThumb: {
    width: 110,
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.inputGray,
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  heroBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.inputGray,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.white,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.brand,
  },
  tabContent: {
    gap: 12,
    marginTop: 4,
  },
  pointsCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#FFF7F7',
  },
  postsTab: {
    marginHorizontal: -20,
    marginTop: 4,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.brand,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  address: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  visitorBlock: {
    gap: 10,
    marginTop: 2,
  },
  visitorText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  avatarOverlap: {
    marginLeft: -12,
  },
  moreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  moreBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionRight: {
    marginLeft: 'auto',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionTextBrand: {
    color: colors.brand,
  },
  loader: {
    paddingVertical: 24,
  },
  error: {
    paddingVertical: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    gap: 8,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  noComments: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentAuthor: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  commentTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.labelGray,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  reviewBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reviewTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  reviewSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewPoints: {
    color: colors.brand,
    fontWeight: '800',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    backgroundColor: colors.brand,
  },
  createPostButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
});
