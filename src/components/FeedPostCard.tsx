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
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';
import { PostImageViewer } from './PostImageViewer';
import { useDialog } from './dialog/DialogProvider';
import { PostOptionsMenu, type PostMenuOption } from './PostOptionsMenu';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TEXT_PREVIEW_LENGTH = 120;
const CAROUSEL_WIDTH = SCREEN_WIDTH - 40;
const CAROUSEL_HEIGHT = CAROUSEL_WIDTH * 0.62;

type FeedPostCardProps = {
  post: Post;
  currentUserId?: string | null;
  onChanged?: (post: Post) => void;
  onDeleted?: (postId: string) => void;
  onHidden?: (postId: string) => void;
  onCommentPress?: (post: Post) => void;
  onSharePress?: (post: Post) => void;
  onAuthorPress?: (authorId: string) => void;
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
}: FeedPostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isLiking, setIsLiking] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

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
        message: `Check out ${post.author.name}'s post on WhereAbout: ${url}`,
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
    const index = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_WIDTH);
    setActiveImageIndex(index);
  }

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerVisible(true);
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
    <View style={styles.card}>
      <View style={styles.userRow}>
        <Pressable
          onPress={() => onAuthorPress?.(post.author.id)}
          disabled={!onAuthorPress}
          style={({ pressed }) => [styles.authorTap, pressed && onAuthorPress && styles.iconPressed]}
          accessibilityRole={onAuthorPress ? 'button' : undefined}
          accessibilityLabel={onAuthorPress ? `View ${post.author.name}'s profile` : undefined}
        >
          <Avatar uri={post.author.avatarUri} name={post.author.name} size={44} />
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

      <View style={styles.postBody}>
        {post.place ? (
          <View style={styles.placeRow}>
            <Avatar uri={post.place.logoUri} name={post.place.name} size={40} style={styles.placeLogo} />

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
          <Pressable onPress={() => openViewer(0)} accessibilityRole="imagebutton">
            <MediaImage uri={postImages[0]} style={styles.postImage} resizeMode="cover" />
          </Pressable>
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
              snapToInterval={CAROUSEL_WIDTH}
              snapToAlignment="start"
              onMomentumScrollEnd={handleImageScrollEnd}
              getItemLayout={(_, index) => ({
                length: CAROUSEL_WIDTH,
                offset: CAROUSEL_WIDTH * index,
                index,
              })}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => openViewer(index)} accessibilityRole="imagebutton">
                  <MediaImage uri={item} style={styles.carouselImage} resizeMode="cover" />
                </Pressable>
              )}
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

        {post.text ? (
          <View style={styles.textBlock}>
            <Text
              style={styles.postText}
              numberOfLines={isExpanded ? undefined : 3}
              ellipsizeMode="tail"
            >
              {post.text}
            </Text>

            {showReadMore && !isExpanded ? (
              <Pressable onPress={() => setIsExpanded(true)} accessibilityRole="button">
                <Text style={styles.readMore}>Read more</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <Pressable
            onPress={handleLikePress}
            style={({ pressed }) => [styles.footerAction, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${likesCount} likes`}
          >
            <Ionicons
              name={likedByMe ? 'heart' : 'heart-outline'}
              size={18}
              color={likedByMe ? colors.brand : colors.textSecondary}
            />
            <Text style={[styles.footerText, likedByMe && styles.footerTextActive]}>
              {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onCommentPress?.(post)}
            style={({ pressed }) => [styles.footerAction, pressed && styles.iconPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${post.commentsCount} comments`}
          >
            <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.footerText}>
              {post.commentsCount} {post.commentsCount === 1 ? 'Comment' : 'Comments'}
            </Text>
          </Pressable>
        </View>
      </View>

      {viewerVisible ? (
        <PostImageViewer
          visible={viewerVisible}
          images={postImages}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  authorTap: {
    borderRadius: 22,
  },
  userText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  postedAgo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  menuButton: {
    padding: 4,
  },
  postBody: {
    marginHorizontal: 20,
    backgroundColor: colors.inputGray,
    borderRadius: 14,
    overflow: 'hidden',
    gap: 12,
    paddingBottom: 14,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  placeLogo: {
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  placeText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  placeName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  placeDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionIcon: {
    padding: 4,
  },
  postImage: {
    width: '100%',
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.white,
  },
  carouselWrap: {
    gap: 8,
  },
  carouselImage: {
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.inputGray,
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  carouselDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  textBlock: {
    paddingHorizontal: 14,
    gap: 6,
  },
  postText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  readMore: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  footerTextActive: {
    color: colors.brand,
  },
  reactionPhrase: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  iconPressed: {
    opacity: 0.75,
  },
});
