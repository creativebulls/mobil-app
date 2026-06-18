import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors } from '../theme/colors';

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Fullscreen video player with a custom brand-pink scrubber. The video fills the
 * available space and a tappable/draggable progress bar lets the user seek.
 */
export function FullscreenVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });

  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);
  const scrubbingRef = useRef(false);
  const [scrubValue, setScrubValue] = useState(0);

  // Poll the player so the scrubber and time labels stay in sync without
  // depending on a specific event-name contract.
  useEffect(() => {
    const id = setInterval(() => {
      if (!scrubbingRef.current) {
        setPosition(player.currentTime ?? 0);
      }
      setDuration(player.duration ?? 0);
      setPlaying(player.playing ?? false);
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  const effectivePosition = scrubbingRef.current ? scrubValue : position;
  const progress = duration > 0 ? Math.min(Math.max(effectivePosition / duration, 0), 1) : 0;

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      if (duration > 0 && player.currentTime >= duration - 0.25) {
        player.currentTime = 0;
      }
      player.play();
      setPlaying(true);
    }
  };

  const seekToX = (x: number) => {
    if (trackWidth <= 0 || duration <= 0) {
      return;
    }
    const fraction = Math.min(Math.max(x / trackWidth, 0), 1);
    setScrubValue(fraction * duration);
  };

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const handleGrant = (e: GestureResponderEvent) => {
    scrubbingRef.current = true;
    seekToX(e.nativeEvent.locationX);
  };
  const handleMove = (e: GestureResponderEvent) => {
    if (scrubbingRef.current) {
      seekToX(e.nativeEvent.locationX);
    }
  };
  const handleRelease = () => {
    if (scrubbingRef.current && duration > 0) {
      player.currentTime = scrubValue;
      setPosition(scrubValue);
    }
    scrubbingRef.current = false;
  };

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />

      <Pressable style={styles.tapZone} onPress={togglePlay}>
        {!playing ? (
          <View style={styles.centerPlay}>
            <Ionicons name="play" size={34} color={colors.white} style={styles.centerPlayIcon} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.controls}>
        <Pressable onPress={togglePlay} hitSlop={8} style={styles.controlButton}>
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.time}>{formatClock(effectivePosition)}</Text>
        <View
          style={styles.trackTouch}
          onLayout={onTrackLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
          onResponderTerminate={handleRelease}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: progress * trackWidth - 7 }]} />
        </View>
        <Text style={styles.time}>{formatClock(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlay: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayIcon: {
    marginLeft: 4,
  },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    color: colors.white,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  trackTouch: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.brand,
    top: 7,
  },
});
