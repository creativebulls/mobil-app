import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Post } from '../api/types';
import { useMediaUrl } from '../hooks/useMediaUrl';
import { useVideoPoster } from '../hooks/useVideoPoster';
import { getPostTileThumbnail } from '../utils/postMedia';
import { openPlaceFromPost } from '../utils/openPlaceFromPost';
import { AppImage } from './AppImage';
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';
import { colors } from '../theme/colors';

const COLS = 3;
const GAP = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - GAP * (COLS - 1)) / COLS;

type ProfilePostsGridProps = {
  posts: Post[];
  onPostPress: (post: Post) => void;
};

function formatTileCount(value: number): string {
  const count = Number.isFinite(value) ? value : 0;
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 10_000) {
    return `${Math.round(count / 1000)}K`;
  }
  if (count >= 1_000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

function TileStatsBar({ likesCount, viewsCount }: { likesCount: number; viewsCount: number }) {
  return (
    <LinearGradient
      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)']}
      locations={[0, 0.5, 1]}
      style={styles.statsGradient}
      pointerEvents="none"
    >
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={12} color={colors.white} />
          <Text style={styles.statText}>{formatTileCount(likesCount)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="eye-outline" size={12} color={colors.white} />
          <Text style={styles.statText}>{formatTileCount(viewsCount)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function VideoTileThumbnail({ videoUri, posterUri }: { videoUri: string; posterUri: string | null }) {
  const resolvedVideo = useMediaUrl(videoUri);
  const { displayPoster, loadingPoster } = useVideoPoster(videoUri, posterUri, resolvedVideo);

  if (displayPoster) {
    return <AppImage source={{ uri: displayPoster }} style={styles.tileImage} resizeMode="cover" />
  }

  return (
    <View style={styles.loadingTile}>
      {loadingPoster ? <ActivityIndicator size="small" color={colors.labelGray} /> : null}
    </View>
  );
}

function ProfilePostTile({ post, onPress }: { post: Post; onPress: () => void }) {
  const router = useRouter();
  const { imageUri, videoUri, posterUri, isVideo, mediaCount } = getPostTileThumbnail(post);
  const likesCount = post.likesCount ?? 0;
  const viewsCount = post.viewsCount ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="View post"
    >
      <View style={styles.tileContent}>
        {videoUri ? (
          <VideoTileThumbnail videoUri={videoUri} posterUri={posterUri} />
        ) : imageUri ? (
          <MediaImage uri={imageUri} style={styles.tileImage} resizeMode="cover" />
        ) : (
          <View style={styles.textTile}>
            <Ionicons name="document-text-outline" size={22} color={colors.labelGray} />
            {post.text ? (
              <Text style={styles.textPreview} numberOfLines={3}>
                {post.text}
              </Text>
            ) : null}
          </View>
        )}

        <TileStatsBar likesCount={likesCount} viewsCount={viewsCount} />

        {post.place ? (
          <Pressable
            onPress={() => openPlaceFromPost(router, post.place!)}
            style={styles.placeBadge}
            accessibilityRole="button"
            accessibilityLabel={`View ${post.place.name}`}
          >
            <Avatar uri={post.place.logoUri} name={post.place.name} size={22} />
          </Pressable>
        ) : null}

        {isVideo ? (
          <View style={styles.badge}>
            <Ionicons name="play" size={14} color={colors.white} />
          </View>
        ) : null}

        {!isVideo && mediaCount > 1 ? (
          <View style={styles.badge}>
            <Ionicons name="layers" size={14} color={colors.white} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ProfilePostsGrid({ posts, onPostPress }: ProfilePostsGridProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <View style={styles.grid}>
      {posts.map((post, index) => (
        <View
          key={post.id}
          style={[
            styles.tileWrap,
            {
              marginRight: (index + 1) % COLS === 0 ? 0 : GAP,
              marginBottom: GAP,
            },
          ]}
        >
          <ProfilePostTile post={post} onPress={() => onPostPress(post)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileWrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  tile: {
    flex: 1,
  },
  tileContent: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.inputGray,
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  loadingTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputGray,
  },
  textTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingBottom: 28,
    gap: 6,
    backgroundColor: colors.surfaceMuted,
  },
  textPreview: {
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    height: Math.max(44, TILE_SIZE * 0.38),
    justifyContent: 'flex-end',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 7,
    paddingBottom: 5,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    includeFontPadding: false,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  placeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 3,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.white,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
});
