import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Dimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Floating home header (logo row + search). Keep in sync with MyFeedScreen. */
export const FEED_TOP_BAR_HEIGHT = 116;
/** Approximate bottom tab bar content height (excluding safe-area padding). */
const FEED_TAB_BAR_HEIGHT = 48;
/** Minimum visible fraction before a video can autoplay (Instagram-style). */
const AUTOPLAY_VISIBLE_RATIO = 0.55;

type MeasureTarget = RefObject<View | null>;

type FeedVideoPlaybackContextValue = {
  activeVideoId: string | null;
  feedMuted: boolean;
  setFeedMuted: (muted: boolean) => void;
  toggleFeedMuted: () => void;
  registerVideo: (videoId: string, ref: MeasureTarget) => void;
  unregisterVideo: (videoId: string) => void;
  requestEvaluate: () => void;
};

const FeedVideoPlaybackContext = createContext<FeedVideoPlaybackContextValue>({
  activeVideoId: null,
  feedMuted: true,
  setFeedMuted: () => undefined,
  toggleFeedMuted: () => undefined,
  registerVideo: () => undefined,
  unregisterVideo: () => undefined,
  requestEvaluate: () => undefined,
});

export function useFeedVideoPlayback() {
  return useContext(FeedVideoPlaybackContext);
}

export function FeedVideoPlaybackProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const registryRef = useRef<Map<string, MeasureTarget>>(new Map());
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [feedMuted, setFeedMuted] = useState(true);
  const evaluateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluatingRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (!enabled || evaluatingRef.current) {
      return;
    }

    const entries = Array.from(registryRef.current.entries());
    if (entries.length === 0) {
      setActiveVideoId(null);
      return;
    }

    evaluatingRef.current = true;

    const windowHeight = Dimensions.get('window').height;
    const viewportTop = insets.top + FEED_TOP_BAR_HEIGHT;
    const viewportBottom = windowHeight - FEED_TAB_BAR_HEIGHT - Math.max(insets.bottom, 10);
    const viewportCenter = (viewportTop + viewportBottom) / 2;

    try {
      const measurements = await Promise.all(
        entries.map(
          ([videoId, ref]) =>
            new Promise<{ videoId: string; visibleRatio: number; centerDistance: number }>(
              (resolve) => {
                const node = ref.current;
                if (!node) {
                  resolve({ videoId, visibleRatio: 0, centerDistance: Number.MAX_SAFE_INTEGER });
                  return;
                }

                node.measureInWindow((_x, y, _width, height) => {
                  const bottom = y + height;
                  const visibleTop = Math.max(y, viewportTop);
                  const visibleBottom = Math.min(bottom, viewportBottom);
                  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
                  const visibleRatio = height > 0 ? visibleHeight / height : 0;
                  const centerDistance = Math.abs(y + height / 2 - viewportCenter);
                  resolve({ videoId, visibleRatio, centerDistance });
                });
              },
            ),
        ),
      );

      const eligible = measurements.filter((item) => item.visibleRatio >= AUTOPLAY_VISIBLE_RATIO);
      const pool = eligible.length > 0 ? eligible : measurements;
      const winner = [...pool].sort((a, b) => {
        if (eligible.length > 0) {
          return a.centerDistance - b.centerDistance;
        }
        return b.visibleRatio - a.visibleRatio;
      })[0];

      setActiveVideoId(winner && winner.visibleRatio > 0.2 ? winner.videoId : null);
    } finally {
      evaluatingRef.current = false;
    }
  }, [enabled, insets.bottom, insets.top]);

  const requestEvaluate = useCallback(() => {
    if (!enabled) {
      return;
    }

    if (evaluateTimerRef.current) {
      clearTimeout(evaluateTimerRef.current);
    }

    evaluateTimerRef.current = setTimeout(() => {
      evaluateTimerRef.current = null;
      void evaluate();
    }, 80);
  }, [enabled, evaluate]);

  const toggleFeedMuted = useCallback(() => {
    setFeedMuted((current) => !current);
  }, []);

  const registerVideo = useCallback(
    (videoId: string, ref: MeasureTarget) => {
      registryRef.current.set(videoId, ref);
      requestEvaluate();
    },
    [requestEvaluate],
  );

  const unregisterVideo = useCallback(
    (videoId: string) => {
      registryRef.current.delete(videoId);
      setActiveVideoId((current) => (current === videoId ? null : current));
      requestEvaluate();
    },
    [requestEvaluate],
  );

  useEffect(
    () => () => {
      if (evaluateTimerRef.current) {
        clearTimeout(evaluateTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setActiveVideoId(null);
      return;
    }
    requestEvaluate();
  }, [enabled, requestEvaluate]);

  const value = useMemo(
    () => ({
      activeVideoId: enabled ? activeVideoId : null,
      feedMuted,
      setFeedMuted,
      toggleFeedMuted,
      registerVideo,
      unregisterVideo,
      requestEvaluate,
    }),
    [
      activeVideoId,
      enabled,
      feedMuted,
      registerVideo,
      requestEvaluate,
      toggleFeedMuted,
      unregisterVideo,
    ],
  );

  return (
    <FeedVideoPlaybackContext.Provider value={value}>{children}</FeedVideoPlaybackContext.Provider>
  );
}

/** Registers a feed video's bounds so scroll visibility can drive autoplay. */
export function FeedVideoViewportAnchor({
  videoId,
  children,
}: {
  videoId: string;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  const { registerVideo, unregisterVideo } = useFeedVideoPlayback();

  useEffect(() => {
    registerVideo(videoId, ref);
    return () => unregisterVideo(videoId);
  }, [registerVideo, unregisterVideo, videoId]);

  return (
    <View ref={ref} collapsable={false}>
      {children}
    </View>
  );
}
