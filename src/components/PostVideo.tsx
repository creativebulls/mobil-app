import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FullscreenVideoPlayer } from './FullscreenVideoPlayer';
import { AppImage } from './AppImage';
import { useFeedVideoPlayback } from '../feed/FeedVideoPlaybackContext';
import { useMediaUrl } from '../hooks/useMediaUrl';
import { useVideoPoster } from '../hooks/useVideoPoster';
import { colors } from '../theme/colors';

export { isVideoMediaUrl as isVideoUrl } from '../utils/postMedia';

/** Avoid crashes when the native player is already released during navigation. */
function runPlayerCommand(command: () => void) {
  try {
    command();
  } catch {
    // expo-video may throw if pause/play runs after unmount.
  }
}

/** Inline preview tile — poster with play overlay (used in create-post previews). */
export function PostVideoTile({
  uri,
  posterUri,
  style,
  onPress,
}: {
  uri: string;
  posterUri?: string | null;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const resolvedVideo = useMediaUrl(uri);
  const { displayPoster, loadingPoster } = useVideoPoster(uri, posterUri, resolvedVideo);

  return (
    <Pressable onPress={onPress} style={style} accessibilityRole="button" accessibilityLabel="Play video">
      {displayPoster ? (
        <AppImage source={{ uri: displayPoster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          {loadingPoster ? <ActivityIndicator color={colors.white} /> : null}
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.playCircle}>
          <Ionicons name="play" size={28} color={colors.white} />
        </View>
      </View>
      <View style={styles.tag}>
        <Ionicons name="videocam" size={12} color={colors.white} />
        <Text style={styles.tagText}>Video</Text>
      </View>
    </Pressable>
  );
}

/** Feed video player — tap to play inline in the post, with mute and fullscreen controls. */
export function FeedPostVideoPlayer({
  uri,
  posterUri,
  style,
  videoId,
  forcePaused = false,
  onFullscreen,
}: {
  uri: string;
  posterUri?: string | null;
  style?: StyleProp<ViewStyle>;
  /** When set, autoplay is driven by feed scroll visibility. */
  videoId?: string;
  forcePaused?: boolean;
  onFullscreen?: () => void;
}) {
  const resolvedVideo = useMediaUrl(uri);
  const { displayPoster, loadingPoster } = useVideoPoster(uri, posterUri, resolvedVideo);
  const { activeVideoId, feedMuted, toggleFeedMuted } = useFeedVideoPlayback();
  const isFeedAutoplay = videoId != null;
  const isActive = isFeedAutoplay && activeVideoId === videoId;
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [localMuted, setLocalMuted] = useState(true);
  const muted = isFeedAutoplay ? feedMuted : localMuted;

  const player = useVideoPlayer(resolvedVideo, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    setPlaying(false);
    setUserPaused(false);
  }, [resolvedVideo]);

  useEffect(() => {
    if (!isFeedAutoplay) {
      return;
    }

    if (forcePaused || !isActive) {
      setPlaying(false);
      if (!isActive) {
        setUserPaused(false);
      }
      return;
    }

    if (!userPaused) {
      setPlaying(true);
    }
  }, [forcePaused, isActive, isFeedAutoplay, userPaused]);

  useEffect(() => {
    runPlayerCommand(() => {
      player.muted = muted;
    });
  }, [muted, player]);

  useEffect(() => {
    if (!resolvedVideo) {
      return;
    }

    if (playing) {
      runPlayerCommand(() => player.play());
    } else {
      runPlayerCommand(() => player.pause());
    }
  }, [playing, player, resolvedVideo]);

  function toggleMute() {
    if (isFeedAutoplay) {
      toggleFeedMuted();
      return;
    }
    setLocalMuted((current) => !current);
  }

  function togglePlay() {
    if (!resolvedVideo) {
      return;
    }

    setPlaying((current) => {
      const next = !current;
      setUserPaused(!next);
      return next;
    });
  }

  return (
    <View style={[style, styles.feedVideoRoot]}>
      {resolvedVideo ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}

      {!playing ? (
        displayPoster ? (
          <AppImage source={{ uri: displayPoster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            {loadingPoster || !resolvedVideo ? <ActivityIndicator color={colors.white} /> : null}
          </View>
        )
      ) : null}

      <Pressable
        style={styles.overlay}
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause video' : 'Play video'}
      >
        {!playing && !(isFeedAutoplay && isActive) ? (
          <View style={styles.playCircle}>
            <Ionicons name="play" size={28} color={colors.white} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.feedVideoControls} pointerEvents="box-none">
        {playing ? (
          <Pressable
            onPress={toggleMute}
            style={styles.feedControlButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.white} />
          </Pressable>
        ) : null}
        {onFullscreen ? (
          <Pressable
            onPress={onFullscreen}
            style={styles.feedControlButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open fullscreen video"
          >
            <Ionicons name="expand" size={20} color={colors.white} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tag}>
        <Ionicons name="videocam" size={12} color={colors.white} />
        <Text style={styles.tagText}>Video</Text>
      </View>
    </View>
  );
}

export function PostVideoModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const resolved = useMediaUrl(uri);

  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewerRoot}>
        {resolved ? (
          <FullscreenVideoPlayer uri={resolved} />
        ) : (
          <ActivityIndicator color={colors.white} size="large" />
        )}
        <Pressable style={styles.viewerClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  feedVideoRoot: {
    overflow: 'hidden',
    backgroundColor: '#1A1024',
  },
  feedVideoControls: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  feedControlButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1024',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tagText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
  },
});
