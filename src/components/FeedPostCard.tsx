import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Post, PostReaction } from '../api/types';
import { toggleLike as toggleLikeRequest, deletePost as deletePostRequest } from '../api/postsApi';
import { useFeedVideoPlayback } from '../feed/FeedVideoPlaybackContext';
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';
import { PostImageViewer } from './PostImageViewer';
import { PostLikesPreview } from './PostLikesPreview';
import { PostLikersModal } from './PostLikersModal';
import { FeedPostVideoPlayer, PostVideoModal, isVideoUrl } from './PostVideo';
import { FeedVideoViewportAnchor } from '../feed/FeedVideoPlaybackContext';
import { getVideoPosterForUri } from '../utils/postMedia';
import { useDialog } from './dialog/DialogProvider';
import { PostOptionsMenu, type PostMenuOption } from './PostOptionsMenu';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TEXT_PREVIEW_LENGTH = 120;
const POST_HORIZONTAL_PADDING = 12;
const MEDIA_WIDTH = SCREEN_WIDTH;
const MEDIA_HEIGHT = MEDIA_WIDTH; // 1:1 — classic Instagram feed square

type FeedPostCardProps = {
  post: Post;
  currentUserId?: string | null;
  onChanged?: (post: Post) => void;
  onDeleted?: (postId: string) => void;
  onHidden?: (postId: string) => void;
  onCommentPress?: (post: Post) => void;
  onSharePress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
  /** Enables scroll-driven autoplay for in-feed videos. */
  enableVideoAutoplay?: boolean;
  /** Light gray section bg for posts linked to a place (home feed). */
  placePostTheme?: boolean;
};

const REACTION_META: Record<
  PostReaction,
  { label: string; verb: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  like: { label: 'Like', verb: 'likes this', icon: 'thumbs-up' },
  dislike: { label: 'Dislike', verb: 'dislikes this', icon: 'thumbs-down' },
  love: { label: 'I love it', verb: 'loves this', icon: 'heart' },
};

function formatDistance(km: number | null): string | null {
  if (km === null) {
    return null;
  }
  return `${km.toFixed(km < 10 ? 1 : 0)} KM`;
}

export function FeedPostCard({
  post,
  currentUserId,
  onChanged,
  onDeleted,
  onHidden,
  onCommentPress,
  onSharePress,
  onAuthorPress,
  enableVideoAutoplay = false,
  placePostTheme = false,
}: FeedPostCardProps) {
  const { requestEvaluate } = useFeedVideoPlayback();
  const isPlaceTheme = placePostTheme && post.place != null;
  const [isExpanded, setIsExpanded] = useState(false);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [recentLikers, setRecentLikers] = useState(post.recentLikers ?? []);
  const [isLiking, setIsLiking] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [videoViewerUri, setVideoViewerUri] = useState<string | null>(null);
  const [likersVisible, setLikersVisible] = useState(false);

  const menuButtonRef = useRef<View>(null);
  const dialog = useDialog();

  const showReadMore = post.text ? post.text.length > TEXT_PREVIEW_LENGTH : false;
  const isOwnPost = currentUserId != null && post.author.id === currentUserId;
  const distance = post.place ? formatDistance(post.place.distanceKm) : null;
  const postImages =
    post.imageUris && post.imageUris.length > 0
      ? post.imageUris
      : post.imageUri
        ? [post.imageUri]
        : [];
  // The fullscreen swipe viewer only handles photos; videos open a player.
  const imageOnly = postImages.filter((uri) => !isVideoUrl(uri));

  async function handleLikePress() {
    if (isLiking) {
      return;
    }

    const previousLiked = likedByMe;
    const previousCount = likesCount;

    setLikedByMe(!previousLiked);
    setLikesCount(previousCount + (previousLiked ? -1 : 1));
    setIsLiking(true);

    try {
      const updated = await toggleLikeRequest(post.id);
      setLikedByMe(updated.likedByMe);
      setLikesCount(updated.likesCount);
      setRecentLikers(updated.recentLikers ?? []);
      onChanged?.(updated);
    } catch {
      setLikedByMe(previousLiked);
      setLikesCount(previousCount);
    } finally {
      setIsLiking(false);
    }
  }

  function openMenu() {
    const node = menuButtonRef.current;
    if (!node) {
      setMenuAnchor(null);
      setMenuVisible(true);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ top: y + height + 6, right: SCREEN_WIDTH - (x + width) });
      setMenuVisible(true);
    });
  }

  function handleHide() {
    onHidden?.(post.id);
  }

  async function handleReport() {
    const result = await dialog.show({
      title: 'Report post',
      message: 'Why are you reporting this post?',
      buttons: [
        { text: 'Spam or misleading', value: 'spam' },
        { text: 'Inappropriate content', value: 'inappropriate' },
        { text: 'Harassment', value: 'harassment' },
        { text: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });

    if (!result || result === 'cancel') {
      return;
    }

    onHidden?.(post.id);
    await dialog.alert({
      title: 'Thanks for letting us know',
      message: 'Our team will review this post.',
    });
  }

  async function handleShare() {
    const url = `https://whereabout.app/post/${post.id}`;
    try {
      await Share.share({
        message: `Check out ${post.author.name}'s post on Crave: ${url}`,
        url,
      });
    } catch {
      // user dismissed or share failed
    }
  }

  async function handleDelete() {
    const confirmed = await dialog.confirm({
      title: 'Delete post',
      message: 'Are you sure you want to delete this post?',
      confirmText: 'Delete',
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    try {
      await deletePostRequest(post.id);
      onDeleted?.(post.id);
    } catch {
      await dialog.alert({ title: 'Error', message: 'Unable to delete this post.' });
    }
  }

  function handleImageScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / MEDIA_WIDTH);
    setActiveImageIndex(index);
    if (enableVideoAutoplay) {
      requestEvaluate();
    }
  }

  function renderFeedVideo(uri: string, mediaIndex: number, mediaStyle: typeof styles.postMedia) {
    const videoId = `${post.id}:${mediaIndex}`;
    const player = (
      <FeedPostVideoPlayer
        uri={uri}
        posterUri={getVideoPosterForUri(postImages, post.videoPosterUris, uri)}
        style={mediaStyle}
        videoId={enableVideoAutoplay ? videoId : undefined}
        forcePaused={videoViewerUri !== null}
        onFullscreen={() => openMedia(uri)}
      />
    );

    if (!enableVideoAutoplay) {
      return player;
    }

    return <FeedVideoViewportAnchor videoId={videoId}>{player}</FeedVideoViewportAnchor>;
  }

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerVisible(true);
  }

  // Maps a post-media item to either the photo viewer (by its index among
  // photos) or the fullscreen video player.
  function openMedia(uri: string) {
    if (isVideoUrl(uri)) {
      setVideoViewerUri(uri);
      return;
    }
    const imageIndex = imageOnly.indexOf(uri);
    openViewer(imageIndex < 0 ? 0 : imageIndex);
  }

  const menuOptions: PostMenuOption[] = [
    { key: 'hide', label: 'Hide post from timeline', icon: 'eye-off-outline', onPress: handleHide },
    { key: 'report', label: 'Report', icon: 'flag-outline', onPress: handleReport },
    { key: 'share', label: 'Share link', icon: 'share-social-outline', onPress: handleShare },
    ...(isOwnPost
      ? [
          {
            key: 'delete',
            label: 'Delete post',
            icon: 'trash-outline' as const,
            destructive: true,
            onPress: handleDelete,
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.card, isPlaceTheme && styles.cardPlaceThemed]}>
      <View style={styles.userRow}>
        <Pressable
          onPress={() => onAuthorPress?.(post.author.id)}
          disabled={!onAuthorPress}
          style={({ pressed }) => [styles.authorTap, pressed && onAuthorPress && styles.iconPressed]}
          accessibilityRole={onAuthorPress ? 'button' : undefined}
          accessibilityLabel={onAuthorPress ? `View ${post.author.name}'s profile` : undefined}
        >
          <Avatar uri={post.author.avatarUri} name={post.author.name} size={36} />
        </Pressable>

        <Pressable
          onPress={() => onAuthorPress?.(post.author.id)}
          disabled={!onAuthorPress}
          style={({ pressed }) => [styles.userText, pressed && onAuthorPress && styles.iconPressed]}
        >
          <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
            {post.author.name}
            {post.reaction ? (
              <Text style={styles.reactionPhrase}>
                {'  '}
                <Ionicons name={REACTION_META[post.reaction].icon} size={14} color={colors.brand} />
                {' '}
                {REACTION_META[post.reaction].verb}
              </Text>
            ) : null}
          </Text>
          <Text style={styles.postedAgo} numberOfLines={1} ellipsizeMode="tail">
            {post.timeAgo}
          </Text>
        </Pressable>

        <Pressable
          ref={menuButtonRef}
          onPress={openMenu}
          style={({ pressed }) => [styles.menuButton, pressed && styles.iconPressed]}
          accessibilityRole="button"
          accessibilityLabel="Post options"
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <PostOptionsMenu
        visible={menuVisible}
        anchor={menuAnchor}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
      />

      <View style={isPlaceTheme ? styles.placePostSection : undefined}>
      {post.place ? (
        <View style={styles.placeRow}>
          <Avatar uri={post.place.logoUri} name={post.place.name} size={32} style={styles.placeLogo} />

          <View style={styles.placeText}>
            <Text style={styles.placeName} numberOfLines={1} ellipsizeMode="tail">
              {post.place.name}
            </Text>
            {distance ? (
              <Text style={styles.placeDistance} numberOfLines={1} ellipsizeMode="tail">
                {distance}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => onSharePress?.(post)}
            style={({ pressed }) => [styles.actionIcon, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {postImages.length === 1 ? (
        isVideoUrl(postImages[0]) ? (
          renderFeedVideo(postImages[0], 0, styles.postMedia)
        ) : (
          <Pressable onPress={() => openMedia(postImages[0])} accessibilityRole="imagebutton">
            <MediaImage uri={postImages[0]} style={styles.postMedia} resizeMode="cover" />
          </Pressable>
        )
      ) : postImages.length > 1 ? (
        <View style={styles.carouselWrap}>
          <FlatList
            data={postImages}
            keyExtractor={(uri, index) => `${uri}-${index}`}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            decelerationRate="fast"
            snapToInterval={MEDIA_WIDTH}
            snapToAlignment="start"
            onMomentumScrollEnd={handleImageScrollEnd}
            getItemLayout={(_, index) => ({
              length: MEDIA_WIDTH,
              offset: MEDIA_WIDTH * index,
              index,
            })}
            renderItem={({ item, index }) =>
              isVideoUrl(item) ? (
                renderFeedVideo(item, index, styles.carouselMedia)
              ) : (
                <Pressable onPress={() => openMedia(item)} accessibilityRole="imagebutton">
                  <MediaImage uri={item} style={styles.carouselMedia} resizeMode="cover" />
                </Pressable>
              )
            }
          />

          <View style={styles.carouselDots}>
            {postImages.map((uri, index) => (
              <View
                key={`${uri}-dot-${index}`}
                style={[styles.carouselDot, index === activeImageIndex && styles.carouselDotActive]}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.contentBlock}>
        <View style={styles.footerRow}>
          <View style={styles.footerAction}>
            <Pressable
              onPress={handleLikePress}
              style={({ pressed }) => [styles.likeIcon, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel={likedByMe ? 'Unlike post' : 'Like post'}
              hitSlop={8}
            >
              <Ionicons
                name={likedByMe ? 'heart' : 'heart-outline'}
                size={24}
                color={likedByMe ? colors.brand : colors.text}
              />
            </Pressable>
            <Pressable
              onPress={() => onCommentPress?.(post)}
              style={({ pressed }) => [styles.footerAction, pressed && styles.iconPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${post.commentsCount} comments`}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionIcon, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel="Share post"
            hitSlop={8}
          >
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {likesCount > 0 ? (
          <PostLikesPreview
            likesCount={likesCount}
            recentLikers={recentLikers}
            onPress={() => setLikersVisible(true)}
          />
        ) : null}

        {post.text ? (
          <View style={styles.textBlock}>
            <Text
              style={styles.postText}
              numberOfLines={isExpanded ? undefined : 3}
              ellipsizeMode="tail"
            >
              <Text style={styles.captionAuthor}>{post.author.name} </Text>
              {post.text}
            </Text>

            {showReadMore && !isExpanded ? (
              <Pressable onPress={() => setIsExpanded(true)} accessibilityRole="button">
                <Text style={styles.readMore}>more</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {post.commentsCount > 0 ? (
          <Pressable
            onPress={() => onCommentPress?.(post)}
            style={({ pressed }) => pressed && styles.iconPressed}
            accessibilityRole="button"
            accessibilityLabel={`View all ${post.commentsCount} comments`}
          >
            <Text style={styles.viewComments}>
              View all {post.commentsCount} {post.commentsCount === 1 ? 'comment' : 'comments'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      </View>

      {viewerVisible ? (
        <PostImageViewer
          visible={viewerVisible}
          images={imageOnly}
          initialIndex={viewerIndex}
          post={post}
          likedByMe={likedByMe}
          likesCount={likesCount}
          commentsCount={post.commentsCount}
          onLikePress={handleLikePress}
          onCommentPress={() => onCommentPress?.(post)}
          onSharePress={handleShare}
          onClose={() => setViewerVisible(false)}
        />
      ) : null}

      <PostVideoModal uri={videoViewerUri} onClose={() => setVideoViewerUri(null)} />

      <PostLikersModal
        visible={likersVisible}
        postId={post.id}
        onClose={() => setLikersVisible(false)}
        onUserPress={(userId) => {
          setLikersVisible(false);
          onAuthorPress?.(userId);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  cardPlaceThemed: {
    paddingBottom: 0,
  },
  placePostSection: {
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceMutedBorder,
    paddingTop: 10,
    paddingBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: POST_HORIZONTAL_PADDING,
    paddingVertical: 10,
    gap: 10,
  },
  authorTap: {
    borderRadius: 18,
  },
  userText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  postedAgo: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  menuButton: {
    padding: 4,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: POST_HORIZONTAL_PADDING,
    paddingBottom: 8,
    paddingTop: 2,
  },
  placeLogo: {
    borderRadius: 8,
    backgroundColor: colors.inputGray,
  },
  placeText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  placeName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  placeDistance: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  actionIcon: {
    padding: 4,
  },
  postMedia: {
    width: MEDIA_WIDTH,
    height: MEDIA_HEIGHT,
    backgroundColor: colors.inputGray,
  },
  carouselWrap: {
    position: 'relative',
  },
  carouselMedia: {
    width: MEDIA_WIDTH,
    height: MEDIA_HEIGHT,
    backgroundColor: colors.inputGray,
  },
  carouselDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  carouselDotActive: {
    backgroundColor: colors.white,
  },
  contentBlock: {
    paddingHorizontal: POST_HORIZONTAL_PADDING,
    paddingTop: 8,
    gap: 6,
  },
  textBlock: {
    gap: 2,
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  captionAuthor: {
    fontWeight: '700',
  },
  readMore: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  likeIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewComments: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  reactionPhrase: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  iconPressed: {
    opacity: 0.75,
  },
});
