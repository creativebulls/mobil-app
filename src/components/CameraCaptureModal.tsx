import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
  type CameraMode,
} from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '../theme/colors';

const MAX_VIDEO_SECONDS = 30;

const RING_SIZE = 92;
const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type CapturedMedia = {
  uri: string;
  mediaType: 'image' | 'video';
  width?: number;
  height?: number;
};

export function CameraCaptureModal({
  visible,
  onClose,
  onCapture,
}: {
  visible: boolean;
  onClose: () => void;
  onCapture: (media: CapturedMedia) => void;
}) {
  const insets = useSafeAreaInsets();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [mode, setMode] = useState<CameraMode>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Tracks the live recording lifecycle without waiting for state updates.
  const recordingRef = useRef(false);
  const wantsRecordRef = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (!cameraPermission?.granted) {
        void requestCameraPermission();
      }
      if (!micPermission?.granted) {
        void requestMicPermission();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startRing = () => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: MAX_VIDEO_SECONDS * 1000,
      useNativeDriver: false,
    }).start();
  };

  const stopRing = () => {
    progress.stopAnimation();
    progress.setValue(0);
  };

  const finishRecording = (media?: CapturedMedia) => {
    recordingRef.current = false;
    wantsRecordRef.current = false;
    setIsRecording(false);
    stopRing();
    setMode('picture');
    if (media) {
      onCapture(media);
    }
  };

  // Once the camera has switched into video mode, kick off the actual recording.
  useEffect(() => {
    if (mode !== 'video' || !wantsRecordRef.current || recordingRef.current) {
      return;
    }
    const timer = setTimeout(async () => {
      const camera = cameraRef.current;
      if (!camera || !wantsRecordRef.current) {
        return;
      }
      recordingRef.current = true;
      setIsRecording(true);
      startRing();
      try {
        const result = await camera.recordAsync({ maxDuration: MAX_VIDEO_SECONDS });
        finishRecording(result?.uri ? { uri: result.uri, mediaType: 'video' } : undefined);
      } catch {
        finishRecording();
      }
    }, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function handleTakePhoto() {
    const camera = cameraRef.current;
    if (!camera || isRecording || recordingRef.current || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      const photo = await camera.takePictureAsync({ quality: 0.5 });
      if (photo?.uri) {
        onCapture({
          uri: photo.uri,
          mediaType: 'image',
          width: photo.width,
          height: photo.height,
        });
      }
    } catch {
      // ignore capture failure
    } finally {
      setIsBusy(false);
    }
  }

  function beginRecording() {
    if (recordingRef.current || wantsRecordRef.current) {
      return;
    }
    wantsRecordRef.current = true;
    setMode('video');
  }

  function endRecording() {
    if (recordingRef.current && cameraRef.current) {
      // Resolves the recordAsync promise in the effect above.
      cameraRef.current.stopRecording();
    } else if (wantsRecordRef.current) {
      // Released before recording actually started — cancel.
      wantsRecordRef.current = false;
      setMode('picture');
    }
  }

  const needsPermission = !cameraPermission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {visible && cameraPermission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode={mode} />
        ) : (
          <View style={styles.permissionWrap}>
            <Ionicons name="camera-outline" size={48} color={colors.white} />
            <Text style={styles.permissionText}>
              {needsPermission
                ? 'Camera access is needed to take photos and videos.'
                : 'Starting camera…'}
            </Text>
            {needsPermission ? (
              <Pressable style={styles.permissionButton} onPress={() => void requestCameraPermission()}>
                <Text style={styles.permissionButtonText}>Allow camera</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={[styles.closeButton, { top: insets.top + 12 }]}
          accessibilityLabel="Close camera"
        >
          <Ionicons name="close" size={28} color={colors.white} />
        </Pressable>

        {cameraPermission?.granted ? (
          <Pressable
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
            hitSlop={10}
            disabled={isRecording}
            style={[styles.flipButton, { top: insets.top + 12 }]}
            accessibilityLabel="Flip camera"
          >
            <Ionicons name="camera-reverse-outline" size={28} color={colors.white} />
          </Pressable>
        ) : null}

        <View style={[styles.controls, { paddingBottom: insets.bottom + 28 }]}>
          <Text style={styles.hint}>
            {isRecording ? 'Recording… release to send' : 'Tap for photo · Hold for video'}
          </Text>

          <Pressable
            onPress={handleTakePhoto}
            onLongPress={beginRecording}
            onPressOut={endRecording}
            delayLongPress={250}
            disabled={!cameraPermission?.granted}
            style={styles.captureWrap}
            accessibilityRole="button"
            accessibilityLabel="Capture"
          >
            <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={4}
                fill="transparent"
              />
              {isRecording ? (
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={colors.brand}
                  strokeWidth={5}
                  fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [RING_CIRCUMFERENCE, 0],
                  })}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              ) : null}
            </Svg>
            <View style={[styles.captureInner, isRecording && styles.captureInnerRecording]} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  permissionText: {
    color: colors.white,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  closeButton: {
    position: 'absolute',
    left: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  flipButton: {
    position: 'absolute',
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 18,
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  captureWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.white,
  },
  captureInnerRecording: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brand,
  },
});
