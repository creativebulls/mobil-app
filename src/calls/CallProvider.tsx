import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { fetchIceServers, type IceServer } from '../api/callsApi';
import { getRealtimeSocket } from '../realtime/socket';
import { playIncomingRing, playRingback, stopRings } from '../sounds/sounds';
import { getStoredUser } from '../storage/authSession';
import { Avatar } from '../components/Avatar';
import { colors } from '../theme/colors';

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';

type PeerInfo = {
  userId: string;
  name: string;
  avatarUri: string | null;
};

type StartCallInput = {
  userId: string;
  name: string;
  avatarUri?: string | null;
  conversationId?: string | null;
};

type CallContextValue = {
  status: CallStatus;
  startCall: (input: StartCallInput) => Promise<void>;
};

const CallContext = createContext<CallContextValue | undefined>(undefined);

const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  // ICE candidates can arrive before the remote description is applied; buffer
  // them until the peer connection is ready to accept them.
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  // Holds the incoming SDP offer until the user accepts the call.
  const pendingOfferRef = useRef<unknown>(null);
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
    pendingOfferRef.current = null;
    peerIdRef.current = null;
    callIdRef.current = null;
    setMuted(false);
    setSeconds(0);
    setPeer(null);
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
          message: 'WhereAbout needs your microphone for voice calls.',
          buttonPositive: 'Allow',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerUserId: string, callId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      // Forward locally-gathered ICE candidates to the remote peer.
      (pc as unknown as { addEventListener: (e: string, cb: (event: unknown) => void) => void }).addEventListener(
        'icecandidate',
        (event: unknown) => {
          const candidate = (event as { candidate?: RTCIceCandidate | null }).candidate;
          if (candidate) {
            void emit('webrtc:ice-candidate', {
              toUserId: peerUserId,
              callId,
              candidate,
            });
          }
        },
      );

      const addPcListener = (pc as unknown as {
        addEventListener: (e: string, cb: (event: unknown) => void) => void;
      }).addEventListener;

      const markConnected = () =>
        setStatus((current) => (current === 'active' ? current : 'active'));

      // react-native-webrtc reliably advances `iceConnectionState`, while
      // `connectionState` sometimes lags and never reaches "connected" — which
      // left the call stuck on "Connecting…". Treat either signal as connected.
      addPcListener.call(pc, 'connectionstatechange', () => {
        const state = (pc as unknown as { connectionState?: string }).connectionState;
        if (state === 'connected') {
          markConnected();
        } else if (state === 'failed' || state === 'closed') {
          cleanup();
        }
      });

      addPcListener.call(pc, 'iceconnectionstatechange', () => {
        const state = (pc as unknown as { iceConnectionState?: string }).iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          markConnected();
        } else if (state === 'failed') {
          cleanup();
        }
      });

      return pc;
    },
    [cleanup, emit],
  );

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
        // ignore malformed candidates
      }
    }
  }, []);

  const startCall = useCallback(
    async (input: StartCallInput) => {
      if (status !== 'idle') {
        return;
      }

      const granted = await requestMicPermission();
      if (!granted) {
        return;
      }

      await ensureIceServers();

      const callId = randomId();
      callIdRef.current = callId;
      peerIdRef.current = input.userId;
      setPeer({ userId: input.userId, name: input.name, avatarUri: input.avatarUri ?? null });
      setStatus('outgoing');

      try {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;

        const pc = createPeerConnection(input.userId, callId);
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer({});
        await pc.setLocalDescription(offer);

        const me = await getStoredUser();
        const myName = me
          ? [me.givenName, me.surname].filter(Boolean).join(' ') ||
            [me.firstName, me.lastName].filter(Boolean).join(' ') ||
            me.email?.split('@')[0] ||
            'WhereAbout user'
          : 'WhereAbout user';

        await emit('call:invite', {
          toUserId: input.userId,
          callId,
          conversationId: input.conversationId ?? null,
          caller: { id: me?.id ?? null, name: myName, avatarUri: me?.profilePhotoUrl ?? null },
          sdp: offer,
        });
      } catch {
        cleanup();
      }
    },
    [status, requestMicPermission, ensureIceServers, createPeerConnection, emit, cleanup],
  );

  const acceptCall = useCallback(async () => {
    const callId = callIdRef.current;
    const peerUserId = peerIdRef.current;
    const offer = pendingOfferRef.current;
    if (!callId || !peerUserId || !offer) {
      return;
    }

    const granted = await requestMicPermission();
    if (!granted) {
      await emit('call:reject', { toUserId: peerUserId, callId });
      cleanup();
      return;
    }

    setStatus('connecting');

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(peerUserId, callId);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer as never));
      await flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await emit('call:accept', { toUserId: peerUserId, callId });
      await emit('webrtc:answer', { toUserId: peerUserId, callId, sdp: answer });
    } catch {
      await emit('call:end', { toUserId: peerUserId, callId });
      cleanup();
    }
  }, [requestMicPermission, createPeerConnection, flushPendingCandidates, emit, cleanup]);

  const rejectCall = useCallback(async () => {
    const callId = callIdRef.current;
    const peerUserId = peerIdRef.current;
    if (callId && peerUserId) {
      await emit('call:reject', { toUserId: peerUserId, callId });
    }
    cleanup();
  }, [emit, cleanup]);

  const endCall = useCallback(async () => {
    const callId = callIdRef.current;
    const peerUserId = peerIdRef.current;
    if (callId && peerUserId) {
      const event = status === 'outgoing' ? 'call:cancel' : 'call:end';
      await emit(event, { toUserId: peerUserId, callId });
    }
    cleanup();
  }, [status, emit, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  // Subscribe to signaling events once. Handlers read refs so they always act
  // on the current call without re-binding on every state change.
  useEffect(() => {
    let active = true;
    let socketRef: Awaited<ReturnType<typeof getRealtimeSocket>> | null = null;

    type IncomingPayload = {
      fromUserId?: string;
      callId?: string;
      caller?: { id?: string; name?: string; avatarUri?: string | null };
      sdp?: unknown;
      candidate?: unknown;
    };

    const onIncoming = (payload: IncomingPayload) => {
      // Busy: already on a call — auto-reject the new one.
      if (callIdRef.current || !payload.callId || !payload.fromUserId) {
        if (payload.fromUserId && payload.callId) {
          void emit('call:busy', { toUserId: payload.fromUserId, callId: payload.callId });
        }
        return;
      }
      callIdRef.current = payload.callId;
      peerIdRef.current = payload.fromUserId;
      pendingOfferRef.current = payload.sdp ?? null;
      setPeer({
        userId: payload.fromUserId,
        name: payload.caller?.name ?? 'Incoming call',
        avatarUri: payload.caller?.avatarUri ?? null,
      });
      setStatus('incoming');
    };

    const onAccepted = (payload: IncomingPayload) => {
      if (payload.callId === callIdRef.current) {
        setStatus((current) => (current === 'active' ? current : 'connecting'));
      }
    };

    const onAnswer = async (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !pcRef.current || !payload.sdp) {
        return;
      }
      try {
        // The answer means the callee accepted — leave the ringing state even
        // if the separate call:accepted event was missed.
        setStatus((current) => (current === 'outgoing' ? 'connecting' : current));
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp as never));
        await flushPendingCandidates();
      } catch {
        // ignore
      }
    };

    const onIceCandidate = async (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.candidate) {
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

    const onRemoteEnd = (payload: IncomingPayload) => {
      if (payload.callId === callIdRef.current) {
        cleanup();
      }
    };

    void getRealtimeSocket().then((socket) => {
      if (!socket || !active) {
        return;
      }
      socketRef = socket;
      socket.on('call:incoming', onIncoming);
      socket.on('call:accepted', onAccepted);
      socket.on('call:rejected', onRemoteEnd);
      socket.on('call:busy', onRemoteEnd);
      socket.on('call:cancelled', onRemoteEnd);
      socket.on('call:ended', onRemoteEnd);
      socket.on('webrtc:answer', onAnswer);
      socket.on('webrtc:ice-candidate', onIceCandidate);
    });

    return () => {
      active = false;
      if (socketRef) {
        socketRef.off('call:incoming', onIncoming);
        socketRef.off('call:accepted', onAccepted);
        socketRef.off('call:rejected', onRemoteEnd);
        socketRef.off('call:busy', onRemoteEnd);
        socketRef.off('call:cancelled', onRemoteEnd);
        socketRef.off('call:ended', onRemoteEnd);
        socketRef.off('webrtc:answer', onAnswer);
        socketRef.off('webrtc:ice-candidate', onIceCandidate);
      }
    };
  }, [emit, cleanup, flushPendingCandidates]);

  // Call duration timer (runs only while connected).
  useEffect(() => {
    if (status !== 'active') {
      return;
    }
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Ring while the call is being established (outgoing ringback / incoming ring),
  // then stop once it connects or ends.
  useEffect(() => {
    if (status === 'outgoing') {
      playRingback();
    } else if (status === 'incoming') {
      playIncomingRing();
    } else {
      stopRings();
    }
    return () => stopRings();
  }, [status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'outgoing':
        return 'Calling…';
      case 'incoming':
        return 'Incoming call';
      case 'connecting':
        return 'Connecting…';
      case 'active':
        return formatDuration(seconds);
      default:
        return '';
    }
  }, [status, seconds]);

  const value = useMemo<CallContextValue>(() => ({ status, startCall }), [status, startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <Modal visible={status !== 'idle'} animationType="slide" transparent={false} onRequestClose={() => undefined}>
        <View style={styles.overlay}>
          <View style={styles.peerBlock}>
            <Avatar uri={peer?.avatarUri ?? null} name={peer?.name ?? 'Call'} size={120} />
            <Text style={styles.peerName}>{peer?.name ?? 'Call'}</Text>
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>

          <View style={styles.controls}>
            {status === 'incoming' ? (
              <View style={styles.incomingRow}>
                <View style={styles.actionWrap}>
                  <Pressable style={[styles.roundButton, styles.declineButton]} onPress={() => void rejectCall()}>
                    <Ionicons name="close" size={30} color={colors.white} />
                  </Pressable>
                  <Text style={styles.actionLabel}>Decline</Text>
                </View>
                <View style={styles.actionWrap}>
                  <Pressable style={[styles.roundButton, styles.acceptButton]} onPress={() => void acceptCall()}>
                    <Ionicons name="call" size={30} color={colors.white} />
                  </Pressable>
                  <Text style={styles.actionLabel}>Accept</Text>
                </View>
              </View>
            ) : (
              <View style={styles.activeRow}>
                {status === 'active' ? (
                  <View style={styles.actionWrap}>
                    <Pressable
                      style={[styles.roundButton, muted ? styles.mutedButton : styles.secondaryButton]}
                      onPress={toggleMute}
                    >
                      <Ionicons name={muted ? 'mic-off' : 'mic'} size={26} color={colors.white} />
                    </Pressable>
                    <Text style={styles.actionLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
                  </View>
                ) : null}
                <View style={styles.actionWrap}>
                  <Pressable style={[styles.roundButton, styles.declineButton]} onPress={() => void endCall()}>
                    <Ionicons name="call" size={30} color={colors.white} style={styles.endIcon} />
                  </Pressable>
                  <Text style={styles.actionLabel}>End</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#1A1024',
    paddingTop: 100,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peerBlock: {
    alignItems: 'center',
    gap: 16,
  },
  peerName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  statusLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    width: '100%',
    paddingHorizontal: 32,
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
  },
  actionWrap: {
    alignItems: 'center',
    gap: 8,
  },
  roundButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mutedButton: {
    backgroundColor: colors.brand,
  },
  endIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
