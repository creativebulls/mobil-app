import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { fetchIceServers, type IceServer } from '../api/callsApi';
import { getRealtimeSocket } from '../realtime/socket';
import { colors } from '../theme/colors';

/**
 * Consent-based live audio. An administrator can request a live audio session
 * with a user; the user must explicitly allow it before any microphone audio is
 * streamed, and a persistent indicator with a Stop control is shown for the full
 * duration so the user always knows the mic is live.
 */

const ADMIN_USER_ID = 'admin';
const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

type LiveStatus = 'idle' | 'prompt' | 'connecting' | 'live';

export function LiveAudioProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<LiveStatus>('idle');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const iceServersRef = useRef<IceServer[]>(DEFAULT_ICE_SERVERS);

  const emit = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const socket = await getRealtimeSocket();
    socket?.emit(event, payload);
  }, []);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    pendingCandidatesRef.current = [];
    sessionIdRef.current = null;
    setStatus('idle');
  }, []);

  const ensureIceServers = useCallback(async () => {
    try {
      const servers = await fetchIceServers();
      if (servers.length > 0) {
        iceServersRef.current = servers;
      }
    } catch {
      iceServersRef.current = DEFAULT_ICE_SERVERS;
    }
  }, []);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone access',
          message: 'Allow microphone access for this live audio session.',
          buttonPositive: 'Allow',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) {
      return;
    }
    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
      }
    }
  }, []);

  const stop = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await emit('live:end', { toUserId: ADMIN_USER_ID, sessionId });
    }
    cleanup();
  }, [emit, cleanup]);

  const decline = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      await emit('live:reject', { toUserId: ADMIN_USER_ID, sessionId });
    }
    cleanup();
  }, [emit, cleanup]);

  // Accept the admin's request: capture the mic, build a peer connection, and
  // send an offer. Audio only flows after this explicit user action.
  const accept = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }

    const granted = await requestMicPermission();
    if (!granted) {
      await emit('live:reject', { toUserId: ADMIN_USER_ID, sessionId });
      cleanup();
      return;
    }

    await ensureIceServers();
    setStatus('connecting');

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcRef.current = pc;

      const addPcListener = (pc as unknown as {
        addEventListener: (e: string, cb: (event: unknown) => void) => void;
      }).addEventListener;

      addPcListener.call(pc, 'icecandidate', (event: unknown) => {
        const candidate = (event as { candidate?: RTCIceCandidate | null }).candidate;
        if (candidate) {
          void emit('webrtc:ice-candidate', {
            toUserId: ADMIN_USER_ID,
            callId: sessionId,
            candidate,
          });
        }
      });

      addPcListener.call(pc, 'connectionstatechange', () => {
        const state = (pc as unknown as { connectionState?: string }).connectionState;
        if (state === 'connected') {
          setStatus((current) => (current === 'live' ? current : 'live'));
        } else if (state === 'failed' || state === 'closed') {
          cleanup();
        }
      });

      addPcListener.call(pc, 'iceconnectionstatechange', () => {
        const state = (pc as unknown as { iceConnectionState?: string }).iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setStatus((current) => (current === 'live' ? current : 'live'));
        } else if (state === 'failed') {
          cleanup();
        }
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);

      await emit('live:accept', { toUserId: ADMIN_USER_ID, sessionId });
      await emit('webrtc:offer', { toUserId: ADMIN_USER_ID, callId: sessionId, sdp: offer });
    } catch {
      await emit('live:end', { toUserId: ADMIN_USER_ID, sessionId });
      cleanup();
    }
  }, [requestMicPermission, ensureIceServers, emit, cleanup]);

  // Signaling subscription. Handlers read refs so they always act on the
  // current session.
  useEffect(() => {
    let active = true;
    let socketRef: Awaited<ReturnType<typeof getRealtimeSocket>> | null = null;

    type Payload = {
      fromUserId?: string;
      sessionId?: string;
      callId?: string;
      sdp?: unknown;
      candidate?: unknown;
    };

    const onIncoming = (payload: Payload) => {
      // Ignore if busy with an existing session or the request is malformed.
      if (sessionIdRef.current || !payload.sessionId) {
        return;
      }
      sessionIdRef.current = payload.sessionId;
      setStatus('prompt');
    };

    const onAnswer = async (payload: Payload) => {
      if (payload.callId !== sessionIdRef.current || !pcRef.current || !payload.sdp) {
        return;
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp as never));
        await flushPendingCandidates();
      } catch {
        // ignore
      }
    };

    const onIceCandidate = async (payload: Payload) => {
      if (payload.callId !== sessionIdRef.current || !payload.candidate) {
        return;
      }
      const candidate = new RTCIceCandidate(payload.candidate as never);
      const pc = pcRef.current;
      if (pc && (pc as unknown as { remoteDescription?: unknown }).remoteDescription) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // ignore
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onEnded = (payload: Payload) => {
      if (!payload.sessionId || payload.sessionId === sessionIdRef.current) {
        cleanup();
      }
    };

    void getRealtimeSocket().then((socket) => {
      if (!socket || !active) {
        return;
      }
      socketRef = socket;
      socket.on('live:incoming', onIncoming);
      socket.on('live:ended', onEnded);
      socket.on('webrtc:answer', onAnswer);
      socket.on('webrtc:ice-candidate', onIceCandidate);
    });

    return () => {
      active = false;
      if (socketRef) {
        socketRef.off('live:incoming', onIncoming);
        socketRef.off('live:ended', onEnded);
        socketRef.off('webrtc:answer', onAnswer);
        socketRef.off('webrtc:ice-candidate', onIceCandidate);
      }
    };
  }, [cleanup, flushPendingCandidates]);

  return (
    <>
      {children}

      <Modal visible={status === 'prompt'} transparent animationType="fade" onRequestClose={() => void decline()}>
        <View style={styles.promptBackdrop}>
          <View style={styles.promptCard}>
            <View style={styles.promptIcon}>
              <Ionicons name="mic" size={30} color={colors.brand} />
            </View>
            <Text style={styles.promptTitle}>Live audio request</Text>
            <Text style={styles.promptBody}>
              An administrator is requesting a live audio session using your microphone. Audio will
              only be shared if you allow it, and you can stop it at any time.
            </Text>
            <View style={styles.promptActions}>
              <Pressable style={styles.declineBtn} onPress={() => void decline()}>
                <Text style={styles.declineText}>Don&apos;t allow</Text>
              </Pressable>
              <Pressable style={styles.allowBtn} onPress={() => void accept()}>
                <Text style={styles.allowText}>Allow</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {status === 'connecting' || status === 'live' ? (
        <View style={[styles.liveBanner, { top: insets.top + 6 }]} pointerEvents="box-none">
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {status === 'live' ? 'Live · mic on' : 'Connecting live audio…'}
          </Text>
          <Pressable style={styles.stopBtn} onPress={() => void stop()} hitSlop={8}>
            <Ionicons name="stop" size={14} color={colors.white} />
            <Text style={styles.stopText}>Stop</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  promptBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  promptCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  promptIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  promptBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  promptActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  declineText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.labelGray,
  },
  allowBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
  },
  allowText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  liveBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1024',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    zIndex: 1000,
    elevation: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  liveText: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  stopText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
});
