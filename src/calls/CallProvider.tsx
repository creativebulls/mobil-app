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
import { playIncomingRing, playRingback, setSpeakerphone, stopRings } from '../sounds/sounds';
import { getStoredUser } from '../storage/authSession';
import { Avatar } from '../components/Avatar';
import { colors } from '../theme/colors';

type CallStatus = 'idle' | 'outgoing' | 'ringing' | 'incoming' | 'connecting' | 'active';

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

const DEFAULT_ICE_SERVERS: IceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
];

/**
 * Rewrites the Opus codec parameters to a low, mobile-friendly bitrate with
 * forward error correction and discontinuous transmission. This keeps voice
 * calls "lite" so they hold up on weak/low-bandwidth connections.
 */
function applyLowBandwidthAudio(sdp?: string): string | undefined {
  if (!sdp) {
    return sdp;
  }
  const opus = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!opus) {
    return sdp;
  }
  const pt = opus[1];
  const params = 'maxaveragebitrate=24000;maxplaybackrate=16000;stereo=0;useinbandfec=1;usedtx=1';
  const fmtpRegex = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`);
  if (fmtpRegex.test(sdp)) {
    return sdp.replace(fmtpRegex, (_m, existing) => `a=fmtp:${pt} ${existing};${params}`);
  }
  return sdp.replace(
    new RegExp(`(a=rtpmap:${pt} opus/48000[^\\r\\n]*)(\\r?\\n)`),
    `$1$2a=fmtp:${pt} ${params}$2`,
  );
}

// If the call never reaches the connected state within this window, give up so
// the UI doesn't hang forever on "Connecting…".
const CONNECT_TIMEOUT_MS = 35000;

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
  const [speakerOn, setSpeakerOn] = useState(false);

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
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const socket = await getRealtimeSocket();
    socket?.emit(event, payload);
  }, []);

  const clearConnectTimer = useCallback(() => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearConnectTimer();
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
    setSpeakerOn(false);
    // Return audio routing to the earpiece default for the next call/ring.
    void setSpeakerphone(false);
    setPeer(null);
    setStatus('idle');
  }, [clearConnectTimer]);

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
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        // Pre-gather candidates and force a single bundled transport for faster,
        // more reliable connection establishment on mobile networks.
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      } as never);

      // Forward locally-gathered ICE candidates to the remote peer.
      (pc as unknown as { addEventListener: (e: string, cb: (event: unknown) => void) => void }).addEventListener(
        'icecandidate',
        (event: unknown) => {
          const candidate = (event as { candidate?: RTCIceCandidate | null }).candidate;
          if (candidate) {
            if (__DEV__) {
              const c = (candidate as unknown as { candidate?: string }).candidate ?? '';
              const type = c.split(' ')[7] ?? 'unknown';
              console.log(`[call] local ICE candidate (${type})`);
            }
            void emit('webrtc:ice-candidate', {
              toUserId: peerUserId,
              callId,
              candidate,
            });
          } else if (__DEV__) {
            console.log('[call] ICE gathering complete');
          }
        },
      );

      const addPcListener = (pc as unknown as {
        addEventListener: (e: string, cb: (event: unknown) => void) => void;
      }).addEventListener;

      const markConnected = () => {
        clearConnectTimer();
        setStatus((current) => (current === 'active' ? current : 'active'));
      };

      // react-native-webrtc reliably advances `iceConnectionState`, while
      // `connectionState` sometimes lags and never reaches "connected" — which
      // left the call stuck on "Connecting…". Treat either signal as connected.
      addPcListener.call(pc, 'connectionstatechange', () => {
        const state = (pc as unknown as { connectionState?: string }).connectionState;
        if (__DEV__) {
          console.log(`[call] connectionState → ${state}`);
        }
        if (state === 'connected') {
          markConnected();
        } else if (state === 'failed' || state === 'closed') {
          cleanup();
        }
      });

      addPcListener.call(pc, 'iceconnectionstatechange', () => {
        const state = (pc as unknown as { iceConnectionState?: string }).iceConnectionState;
        if (__DEV__) {
          console.log(`[call] iceConnectionState → ${state}`);
        }
        if (state === 'connected' || state === 'completed') {
          markConnected();
        } else if (state === 'failed') {
          // A brief blip can recover via ICE restart; a hard failure cannot.
          const restart = (pc as unknown as { restartIce?: () => void }).restartIce;
          if (typeof restart === 'function') {
            try {
              restart.call(pc);
            } catch {
              cleanup();
            }
          } else {
            cleanup();
          }
        }
        // Note: 'disconnected' is transient (e.g. network handover) — keep the
        // call alive and let it recover rather than tearing down immediately.
      });

      return pc;
    },
    [cleanup, clearConnectTimer, emit],
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

        const rawOffer = await pc.createOffer({});
        const offer = new RTCSessionDescription({
          type: rawOffer.type,
          sdp: applyLowBandwidthAudio(rawOffer.sdp),
        } as never);
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

      const rawAnswer = await pc.createAnswer();
      const answer = new RTCSessionDescription({
        type: rawAnswer.type,
        sdp: applyLowBandwidthAudio(rawAnswer.sdp),
      } as never);
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
      const event = status === 'outgoing' || status === 'ringing' ? 'call:cancel' : 'call:end';
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

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((current) => {
      const next = !current;
      void setSpeakerphone(next);
      return next;
    });
  }, []);

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
      // Tell the caller their device is now ringing so they see "Ringing…".
      void emit('call:ringing', { toUserId: payload.fromUserId, callId: payload.callId });
    };

    // Caller side: the callee's device started ringing.
    const onRinging = (payload: IncomingPayload) => {
      if (payload.callId === callIdRef.current) {
        setStatus((current) => (current === 'outgoing' ? 'ringing' : current));
      }
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
        setStatus((current) =>
          current === 'outgoing' || current === 'ringing' ? 'connecting' : current,
        );
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
      socket.on('call:ringing', onRinging);
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
        socketRef.off('call:ringing', onRinging);
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

  // Call duration timer lives in CallOverlay so the rest of the app does not re-render every second.

  // Once both sides have agreed to connect, fail the call if media never flows
  // within the timeout (most commonly because no TURN relay is reachable).
  useEffect(() => {
    if (status !== 'connecting') {
      return;
    }
    clearConnectTimer();
    connectTimerRef.current = setTimeout(() => {
      cleanup();
    }, CONNECT_TIMEOUT_MS);
    return () => clearConnectTimer();
  }, [status, cleanup, clearConnectTimer]);

  // Ring while the call is being established (outgoing ringback / incoming ring),
  // then stop once it connects or ends.
  useEffect(() => {
    if (status === 'outgoing' || status === 'ringing') {
      playRingback();
    } else if (status === 'incoming') {
      playIncomingRing();
    } else {
      stopRings();
    }
    return () => stopRings();
  }, [status]);

  // When the call connects, switch from the loud ring routing to the chosen
  // output (earpiece by default, loudspeaker if the user toggled it).
  useEffect(() => {
    if (status === 'active') {
      void setSpeakerphone(speakerOn);
    }
  }, [status, speakerOn]);

  const value = useMemo<CallContextValue>(() => ({ status, startCall }), [status, startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay
        status={status}
        peer={peer}
        muted={muted}
        speakerOn={speakerOn}
        onReject={() => void rejectCall()}
        onAccept={() => void acceptCall()}
        onEnd={() => void endCall()}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </CallContext.Provider>
  );
}

type CallOverlayProps = {
  status: CallStatus;
  peer: PeerInfo | null;
  muted: boolean;
  speakerOn: boolean;
  onReject: () => void;
  onAccept: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
};

function CallOverlay({
  status,
  peer,
  muted,
  speakerOn,
  onReject,
  onAccept,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
}: CallOverlayProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (status !== 'active') {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'outgoing':
        return 'Calling…';
      case 'ringing':
        return 'Ringing…';
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

  return (
      <Modal
        visible={status !== 'idle'}
        animationType="slide"
        transparent={false}
        onRequestClose={onEnd}
      >
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
                  <Pressable style={[styles.roundButton, styles.declineButton]} onPress={onReject}>
                    <Ionicons name="close" size={30} color={colors.white} />
                  </Pressable>
                  <Text style={styles.actionLabel}>Decline</Text>
                </View>
                <View style={styles.actionWrap}>
                  <Pressable style={[styles.roundButton, styles.acceptButton]} onPress={onAccept}>
                    <Ionicons name="call" size={30} color={colors.white} />
                  </Pressable>
                  <Text style={styles.actionLabel}>Accept</Text>
                </View>
              </View>
            ) : (
              <View style={styles.activeRow}>
                {status === 'active' ? (
                  <>
                    <View style={styles.actionWrap}>
                      <Pressable
                        style={[styles.roundButton, muted ? styles.mutedButton : styles.secondaryButton]}
                        onPress={onToggleMute}
                      >
                        <Ionicons name={muted ? 'mic-off' : 'mic'} size={26} color={colors.white} />
                      </Pressable>
                      <Text style={styles.actionLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
                    </View>
                    <View style={styles.actionWrap}>
                      <Pressable
                        style={[styles.roundButton, speakerOn ? styles.activeToggleButton : styles.secondaryButton]}
                        onPress={onToggleSpeaker}
                      >
                        <Ionicons
                          name={speakerOn ? 'volume-high' : 'volume-medium'}
                          size={26}
                          color={colors.white}
                        />
                      </Pressable>
                      <Text style={styles.actionLabel}>Speaker</Text>
                    </View>
                  </>
                ) : null}
                <View style={styles.actionWrap}>
                  <Pressable style={[styles.roundButton, styles.declineButton]} onPress={onEnd}>
                    <Ionicons name="call" size={30} color={colors.white} style={styles.endIcon} />
                  </Pressable>
                  <Text style={styles.actionLabel}>End</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    gap: 36,
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
  activeToggleButton: {
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
