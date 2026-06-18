import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useMediaUrl } from '../hooks/useMediaUrl';
import { colors } from '../theme/colors';

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|3gp|mkv|avi)(\?|$)/i;

export function isVideoUrl(url?: string | null): boolean {
  return !!url && VIDEO_EXTENSIONS.test(url);
}

/** Inline preview tile for a post video — shows the first frame with a play overlay. */
export function PostVideoTile({
  uri,
  style,
  onPress,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  const resolved = useMediaUrl(uri);
  const player = useVideoPlayer(resolved ?? '', (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  return (
    <Pressable onPress={onPress} style={style} accessibilityRole="button" accessibilityLabel="Play video">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      </View>
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

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });

  return <VideoView player={player} style={styles.viewerVideo} nativeControls contentFit="contain" />;
}

export function PostVideoModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={uri !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerRoot}>
        <Pressable style={styles.viewerClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.white} />
        </Pressable>
        {uri ? <FullscreenVideo uri={uri} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  viewerVideo: {
    width: '100%',
    height: '70%',
  },
});
