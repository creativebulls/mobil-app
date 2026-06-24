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
import { Modal, PermissionsAndroid, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from 'react-native-webrtc';

import { fetchIceServers, type IceServer } from '../api/callsApi';
import { onCallAcceptIntent } from './callIntentBus';
import { getRealtimeSocket } from '../realtime/socket';
import { playIncomingRing, playRingback, setSpeakerphone, stopRings } from '../sounds/sounds';
import { getStoredUser } from '../storage/authSession';
import { AddParticipantsModal } from '../components/AddParticipantsModal';
import { Avatar } from '../components/Avatar';
import { colors } from '../theme/colors';

type CallStatus = 'idle' | 'outgoing' | 'ringing' | 'incoming' | 'connecting' | 'active';

type MemberStatus = 'ringing' | 'connecting' | 'connected';

export type CallParticipant = {
  userId: string;
  name: string;
  avatarUri: string | null;
};

type Member = CallParticipant & { status: MemberStatus };

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

const MAX_PARTICIPANTS = 4;

const DEFAULT_ICE_SERVERS: IceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
];

type PeerEntry = {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidate[];
  remoteStream: MediaStream | null;
};

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
  // The caller/host shown on the incoming-call screen.
  const [host, setHost] = useState<CallParticipant | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [addVisible, setAddVisible] = useState(false);

  // userId -> peer connection state. Shared local stream feeds every peer.
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const membersRef = useRef<Map<string, Member>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const selfInfoRef = useRef<CallParticipant | null>(null);
  const iceServersRef = useRef<IceServer[]>(DEFAULT_ICE_SERVERS);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the user tapped "Accept" on the native incoming-call notification:
  // the call with this id should be auto-accepted as soon as it (re)arrives.
  const autoAcceptCallIdRef = useRef<string | null>(null);

  const emit = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const socket = await getRealtimeSocket();
    socket?.emit(event, payload);
  }, []);

  const syncMembers = useCallback(() => {
    setMembers([...membersRef.current.values()]);
  }, []);

  const setMemberStatus = useCallback(
    (userId: string, next: MemberStatus, info?: Partial<CallParticipant>) => {
      const current = membersRef.current.get(userId);
      const merged: Member = {
        userId,
        name: info?.name ?? current?.name ?? 'Member',
        avatarUri: info?.avatarUri ?? current?.avatarUri ?? null,
        status: next,
      };
      membersRef.current.set(userId, merged);
      syncMembers();
      if (next === 'connected') {
        if (connectTimerRef.current) {
          clearTimeout(connectTimerRef.current);
          connectTimerRef.current = null;
        }
        setStatus('active');
      }
    },
    [syncMembers],
  );

  const clearConnectTimer = useCallback(() => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const closePeer = useCallback((userId: string) => {
    const entry = peersRef.current.get(userId);
    if (entry) {
      try {
        entry.pc.close();
      } catch {
        // ignore
      }
      peersRef.current.delete(userId);
    }
  }, []);

  const cleanup = useCallback(() => {
    clearConnectTimer();
    for (const userId of [...peersRef.current.keys()]) {
      closePeer(userId);
    }
    peersRef.current.clear();
    membersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    callIdRef.current = null;
    conversationIdRef.current = null;
    autoAcceptCallIdRef.current = null;
    setMembers([]);
    setHost(null);
    setMuted(false);
    setSpeakerOn(false);
    setAddVisible(false);
    void setSpeakerphone(false);
    setStatus('idle');
  }, [clearConnectTimer, closePeer]);

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
          message: 'Crave needs your microphone for voice calls.',
          buttonPositive: 'Allow',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const getSelfInfo = useCallback(async (): Promise<CallParticipant> => {
    if (selfInfoRef.current) {
      return selfInfoRef.current;
    }
    const me = await getStoredUser();
    const name = me
      ? [me.givenName, me.surname].filter(Boolean).join(' ') ||
        [me.firstName, me.lastName].filter(Boolean).join(' ') ||
        me.email?.split('@')[0] ||
        'Crave user'
      : 'Crave user';
    const info: CallParticipant = {
      userId: me?.id ?? '',
      name,
      avatarUri: me?.profilePhotoUrl ?? null,
    };
    selfInfoRef.current = info;
    return info;
  }, []);

  const ensureLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const granted = await requestMicPermission();
    if (!granted) {
      return null;
    }
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    // Honour the current mute state for any peers added later.
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    localStreamRef.current = stream;
    return stream;
  }, [requestMicPermission, muted]);

  const createPeer = useCallback(
    (peerUserId: string): PeerEntry => {
      const existing = peersRef.current.get(peerUserId);
      if (existing) {
        return existing;
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      } as never);

      const entry: PeerEntry = { pc, pendingCandidates: [], remoteStream: null };
      peersRef.current.set(peerUserId, entry);

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      const addPcListener = (pc as unknown as {
        addEventListener: (e: string, cb: (event: unknown) => void) => void;
      }).addEventListener;

      addPcListener.call(pc, 'icecandidate', (event: unknown) => {
        const candidate = (event as { candidate?: RTCIceCandidate | null }).candidate;
        if (candidate) {
          void emit('webrtc:ice-candidate', {
            toUserId: peerUserId,
            callId: callIdRef.current,
            candidate,
          });
        }
      });

      addPcListener.call(pc, 'track', (event: unknown) => {
        const streams = (event as { streams?: MediaStream[] }).streams;
        if (streams && streams[0]) {
          entry.remoteStream = streams[0];
        }
      });

      addPcListener.call(pc, 'connectionstatechange', () => {
        const state = (pc as unknown as { connectionState?: string }).connectionState;
        if (state === 'connected') {
          setMemberStatus(peerUserId, 'connected');
        } else if (state === 'failed' || state === 'closed') {
          closePeer(peerUserId);
        }
      });

      addPcListener.call(pc, 'iceconnectionstatechange', () => {
        const state = (pc as unknown as { iceConnectionState?: string }).iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          setMemberStatus(peerUserId, 'connected');
        } else if (state === 'failed') {
          const restart = (pc as unknown as { restartIce?: () => void }).restartIce;
          if (typeof restart === 'function') {
            try {
              restart.call(pc);
            } catch {
              closePeer(peerUserId);
            }
          } else {
            closePeer(peerUserId);
          }
        }
      });

      return entry;
    },
    [emit, setMemberStatus, closePeer],
  );

  const flushCandidates = useCallback(async (peerUserId: string) => {
    const entry = peersRef.current.get(peerUserId);
    if (!entry) {
      return;
    }
    const candidates = entry.pendingCandidates;
    entry.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await entry.pc.addIceCandidate(candidate);
      } catch {
        // ignore malformed candidates
      }
    }
  }, []);

  // Existing participant -> newcomer: create and send an SDP offer.
  const offerToPeer = useCallback(
    async (peerUserId: string, info?: Partial<CallParticipant>) => {
      const stream = await ensureLocalStream();
      if (!stream) {
        return;
      }
      setMemberStatus(peerUserId, 'connecting', info);
      const entry = createPeer(peerUserId);
      try {
        const rawOffer = await entry.pc.createOffer({});
        const offer = new RTCSessionDescription({
          type: rawOffer.type,
          sdp: applyLowBandwidthAudio(rawOffer.sdp),
        } as never);
        await entry.pc.setLocalDescription(offer);
        await emit('webrtc:offer', { toUserId: peerUserId, callId: callIdRef.current, sdp: offer });
      } catch {
        closePeer(peerUserId);
      }
    },
    [ensureLocalStream, setMemberStatus, createPeer, emit, closePeer],
  );

  const startCall = useCallback(
    async (input: StartCallInput) => {
      if (status !== 'idle') {
        return;
      }
      const stream = await ensureLocalStream();
      if (!stream) {
        return;
      }
      await ensureIceServers();

      const callId = randomId();
      callIdRef.current = callId;
      conversationIdRef.current = input.conversationId ?? null;

      const invitee: CallParticipant = {
        userId: input.userId,
        name: input.name,
        avatarUri: input.avatarUri ?? null,
      };
      setHost(invitee);
      membersRef.current.set(invitee.userId, { ...invitee, status: 'ringing' });
      syncMembers();
      setStatus('outgoing');

      const me = await getSelfInfo();
      await emit('call:invite', {
        callId,
        conversationId: input.conversationId ?? null,
        caller: me,
        invitees: [invitee],
      });
    },
    [status, ensureLocalStream, ensureIceServers, getSelfInfo, emit, syncMembers],
  );

  const acceptCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId) {
      return;
    }
    const stream = await ensureLocalStream();
    if (!stream) {
      await emit('call:reject', { callId });
      cleanup();
      return;
    }
    await ensureIceServers();
    setStatus('connecting');
    // Existing participants will now offer to us; we just answer.
    await emit('call:accept', { callId });
  }, [ensureLocalStream, ensureIceServers, emit, cleanup]);

  const acceptCallRef = useRef(acceptCall);
  acceptCallRef.current = acceptCall;

  // The native full-screen call notification's "Accept" button deep-links into
  // the app and emits here. Remember the call id and accept as soon as the call
  // (re)arrives over the socket.
  useEffect(
    () =>
      onCallAcceptIntent(({ callId }) => {
        autoAcceptCallIdRef.current = callId;
        if (callIdRef.current === callId) {
          autoAcceptCallIdRef.current = null;
          void acceptCallRef.current();
        }
      }),
    [],
  );

  const rejectCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (callId) {
      await emit('call:reject', { callId });
    }
    cleanup();
  }, [emit, cleanup]);

  const endCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (callId) {
      await emit('call:leave', { callId });
    }
    cleanup();
  }, [emit, cleanup]);

  const addParticipants = useCallback(
    async (selected: CallParticipant[]) => {
      const callId = callIdRef.current;
      if (!callId || selected.length === 0) {
        return;
      }
      const me = await getSelfInfo();
      // Optimistically show the new invitees as ringing.
      selected.forEach((p) => {
        membersRef.current.set(p.userId, { ...p, status: 'ringing' });
      });
      syncMembers();
      await emit('call:invite', {
        callId,
        conversationId: conversationIdRef.current,
        caller: me,
        invitees: selected,
      });
    },
    [getSelfInfo, emit, syncMembers],
  );

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
      conversationId?: string | null;
      caller?: CallParticipant;
      roster?: CallParticipant[];
      peer?: CallParticipant;
      peerId?: string;
      participants?: CallParticipant[];
      invited?: CallParticipant[];
      sdp?: unknown;
      candidate?: unknown;
    };

    const onIncoming = (payload: IncomingPayload) => {
      if (!payload.callId || !payload.caller) {
        return;
      }
      // Already on a different call — auto-reject the new one.
      if (callIdRef.current && callIdRef.current !== payload.callId) {
        void emit('call:reject', { callId: payload.callId });
        return;
      }
      // Re-delivery of the call we're already showing — ignore.
      if (callIdRef.current === payload.callId && status !== 'idle') {
        return;
      }

      callIdRef.current = payload.callId;
      conversationIdRef.current = payload.conversationId ?? null;
      setHost(payload.caller);

      membersRef.current.clear();
      const roster = payload.roster ?? [payload.caller];
      roster.forEach((p) => {
        if (p.userId !== selfInfoRef.current?.userId) {
          membersRef.current.set(p.userId, { ...p, status: 'connecting' });
        }
      });
      syncMembers();
      setStatus('incoming');

      // Tell the caller our device is now ringing so they see "Ringing…".
      void emit('call:ringing', { toUserId: payload.caller.userId, callId: payload.callId });

      if (autoAcceptCallIdRef.current === payload.callId) {
        autoAcceptCallIdRef.current = null;
        void acceptCallRef.current();
      }
    };

    const onRinging = (payload: IncomingPayload) => {
      if (payload.callId === callIdRef.current) {
        setStatus((current) => (current === 'outgoing' ? 'ringing' : current));
      }
    };

    // A new participant accepted — existing participants offer to them.
    const onPeerJoined = (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.peer) {
        return;
      }
      // Move off the ringing state so the connect-timeout failsafe applies; an
      // already-active group call stays active while the newcomer connects.
      setStatus((current) => (current === 'active' ? current : 'connecting'));
      void offerToPeer(payload.peer.userId, payload.peer);
    };

    const onRoster = (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current) {
        return;
      }
      const selfId = selfInfoRef.current?.userId;
      const seen = new Set<string>();
      (payload.participants ?? []).forEach((p) => {
        if (p.userId === selfId) {
          return;
        }
        seen.add(p.userId);
        const current = membersRef.current.get(p.userId);
        membersRef.current.set(p.userId, {
          ...p,
          status: current?.status === 'connected' ? 'connected' : 'connecting',
        });
      });
      (payload.invited ?? []).forEach((p) => {
        if (p.userId === selfId) {
          return;
        }
        seen.add(p.userId);
        const current = membersRef.current.get(p.userId);
        if (current?.status !== 'connected') {
          membersRef.current.set(p.userId, { ...p, status: 'ringing' });
        }
      });
      // Drop members the server no longer lists.
      for (const id of [...membersRef.current.keys()]) {
        if (!seen.has(id)) {
          membersRef.current.delete(id);
          closePeer(id);
        }
      }
      syncMembers();
    };

    const onPeerLeft = (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.peerId) {
        return;
      }
      membersRef.current.delete(payload.peerId);
      closePeer(payload.peerId);
      syncMembers();
    };

    const onPeerDeclined = (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.peerId) {
        return;
      }
      membersRef.current.delete(payload.peerId);
      closePeer(payload.peerId);
      syncMembers();
    };

    const onOffer = async (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.fromUserId || !payload.sdp) {
        return;
      }
      const stream = await ensureLocalStream();
      if (!stream) {
        return;
      }
      setMemberStatus(payload.fromUserId, 'connecting');
      const entry = createPeer(payload.fromUserId);
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as never));
        await flushCandidates(payload.fromUserId);
        const rawAnswer = await entry.pc.createAnswer();
        const answer = new RTCSessionDescription({
          type: rawAnswer.type,
          sdp: applyLowBandwidthAudio(rawAnswer.sdp),
        } as never);
        await entry.pc.setLocalDescription(answer);
        await emit('webrtc:answer', { toUserId: payload.fromUserId, callId: callIdRef.current, sdp: answer });
      } catch {
        closePeer(payload.fromUserId);
      }
    };

    const onAnswer = async (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.fromUserId || !payload.sdp) {
        return;
      }
      const entry = peersRef.current.get(payload.fromUserId);
      if (!entry) {
        return;
      }
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp as never));
        await flushCandidates(payload.fromUserId);
      } catch {
        // ignore
      }
    };

    const onIceCandidate = async (payload: IncomingPayload) => {
      if (payload.callId !== callIdRef.current || !payload.fromUserId || !payload.candidate) {
        return;
      }
      const entry = peersRef.current.get(payload.fromUserId);
      if (!entry) {
        return;
      }
      const candidate = new RTCIceCandidate(payload.candidate as never);
      if ((entry.pc as unknown as { remoteDescription?: unknown }).remoteDescription) {
        try {
          await entry.pc.addIceCandidate(candidate);
        } catch {
          // ignore
        }
      } else {
        entry.pendingCandidates.push(candidate);
      }
    };

    const onEnded = (payload: IncomingPayload) => {
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
      socket.on('call:peer-joined', onPeerJoined);
      socket.on('call:roster', onRoster);
      socket.on('call:peer-left', onPeerLeft);
      socket.on('call:peer-declined', onPeerDeclined);
      socket.on('call:cancelled', onEnded);
      socket.on('call:ended', onEnded);
      socket.on('webrtc:offer', onOffer);
      socket.on('webrtc:answer', onAnswer);
      socket.on('webrtc:ice-candidate', onIceCandidate);
    });

    return () => {
      active = false;
      if (socketRef) {
        socketRef.off('call:incoming', onIncoming);
        socketRef.off('call:ringing', onRinging);
        socketRef.off('call:peer-joined', onPeerJoined);
        socketRef.off('call:roster', onRoster);
        socketRef.off('call:peer-left', onPeerLeft);
        socketRef.off('call:peer-declined', onPeerDeclined);
        socketRef.off('call:cancelled', onEnded);
        socketRef.off('call:ended', onEnded);
        socketRef.off('webrtc:offer', onOffer);
        socketRef.off('webrtc:answer', onAnswer);
        socketRef.off('webrtc:ice-candidate', onIceCandidate);
      }
    };
  }, [
    emit,
    cleanup,
    status,
    syncMembers,
    setMemberStatus,
    createPeer,
    closePeer,
    offerToPeer,
    flushCandidates,
    ensureLocalStream,
  ]);

  // Fail the call if no peer connects within the timeout (commonly because no
  // TURN relay is reachable).
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

  // Ring while the call is being established, then stop once it connects/ends.
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

  useEffect(() => {
    if (status === 'active') {
      void setSpeakerphone(speakerOn);
    }
  }, [status, speakerOn]);

  const value = useMemo<CallContextValue>(() => ({ status, startCall }), [status, startCall]);

  const totalParticipants = members.length + 1;
  const excludedIds = useMemo(() => {
    const ids = members.map((m) => m.userId);
    if (selfInfoRef.current?.userId) {
      ids.push(selfInfoRef.current.userId);
    }
    return ids;
  }, [members]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay
        status={status}
        host={host}
        members={members}
        muted={muted}
        speakerOn={speakerOn}
        canAdd={totalParticipants < MAX_PARTICIPANTS}
        onReject={() => void rejectCall()}
        onAccept={() => void acceptCall()}
        onEnd={() => void endCall()}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        onAddPress={() => setAddVisible(true)}
      />
      <AddParticipantsModal
        visible={addVisible}
        remainingSlots={MAX_PARTICIPANTS - totalParticipants}
        excludeUserIds={excludedIds}
        onClose={() => setAddVisible(false)}
        onConfirm={(selected) => {
          setAddVisible(false);
          void addParticipants(selected);
        }}
      />
    </CallContext.Provider>
  );
}

type CallOverlayProps = {
  status: CallStatus;
  host: CallParticipant | null;
  members: Member[];
  muted: boolean;
  speakerOn: boolean;
  canAdd: boolean;
  onReject: () => void;
  onAccept: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onAddPress: () => void;
};

function memberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case 'ringing':
      return 'Ringing…';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    default:
      return '';
  }
}

function CallOverlay({
  status,
  host,
  members,
  muted,
  speakerOn,
  canAdd,
  onReject,
  onAccept,
  onEnd,
  onToggleMute,
  onToggleSpeaker,
  onAddPress,
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

  const headerLabel = useMemo(() => {
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

  const isIncoming = status === 'incoming';
  const isGroup = members.length > 1;

  return (
    <Modal visible={status !== 'idle'} animationType="slide" transparent={false} onRequestClose={onEnd}>
      <View style={styles.overlay}>
        {isIncoming || !isGroup ? (
          <View style={styles.peerBlock}>
            <Avatar
              uri={isIncoming ? host?.avatarUri ?? null : members[0]?.avatarUri ?? host?.avatarUri ?? null}
              name={isIncoming ? host?.name ?? 'Call' : members[0]?.name ?? host?.name ?? 'Call'}
              size={120}
            />
            <Text style={styles.peerName}>
              {isIncoming ? host?.name ?? 'Call' : members[0]?.name ?? host?.name ?? 'Call'}
            </Text>
            <Text style={styles.statusLabel}>{headerLabel}</Text>
          </View>
        ) : (
          <View style={styles.groupBlock}>
            <Text style={styles.groupHeader}>{headerLabel}</Text>
            <ScrollView contentContainerStyle={styles.grid}>
              {members.map((member) => (
                <View key={member.userId} style={styles.tile}>
                  <Avatar uri={member.avatarUri} name={member.name} size={72} />
                  <Text style={styles.tileName} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <Text style={styles.tileStatus}>{memberStatusLabel(member.status)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.controls}>
          {isIncoming ? (
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
                  {canAdd ? (
                    <View style={styles.actionWrap}>
                      <Pressable style={[styles.roundButton, styles.secondaryButton]} onPress={onAddPress}>
                        <Ionicons name="person-add" size={24} color={colors.white} />
                      </Pressable>
                      <Text style={styles.actionLabel}>Add</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
              <View style={styles.actionWrap}>
                <Pressable style={[styles.roundButton, styles.declineButton]} onPress={onEnd}>
                  <Ionicons name="call" size={30} color={colors.white} style={styles.endIcon} />
                </Pressable>
                <Text style={styles.actionLabel}>{status === 'outgoing' || status === 'ringing' ? 'Cancel' : 'End'}</Text>
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
  groupBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
  },
  groupHeader: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontVariant: ['tabular-nums'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  tile: {
    width: 96,
    alignItems: 'center',
    gap: 6,
  },
  tileName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  tileStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
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
    gap: 28,
    flexWrap: 'wrap',
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
