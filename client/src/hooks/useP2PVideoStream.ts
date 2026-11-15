import { useState, useEffect, useRef, useCallback } from 'react';
import { Participant } from '../types';

export interface P2PStreamStats {
  bitrateKbps: number;
  packetsLost: number;
  roundTripTimeMs: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'connecting' | 'failed';
}

export interface P2PPlaybackEvent {
  action: 'PLAY' | 'PAUSE' | 'SEEK' | 'STREAM_STARTED' | 'STREAM_STOPPED';
  position: number;
  timestamp: number;
  hostId: string;
  roomId: string;
}

export interface UseP2PVideoStreamProps {
  roomId: string;
  isHost: boolean;
  hostId: string;
  myParticipantId: string;
  participants: Participant[];
  localStream: MediaStream | null;
  emitSignal: (targetParticipantId: string, signal: any) => void;
  emitState: (state: any) => void;
  onIncomingSignal?: (senderId: string, payload: any) => void;
  onIncomingState?: (senderId: string, state: any) => void;
}

const FREE_STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 2,
};

const CONNECTION_TIMEOUT_MS = 15000;
const DIRECT_CONNECTION_ERROR =
  'Direct connection unavailable. Both participants may be behind incompatible network restrictions.';

export function useP2PVideoStream({
  roomId,
  isHost,
  hostId,
  myParticipantId,
  participants,
  localStream,
  emitSignal,
  emitState,
}: UseP2PVideoStreamProps) {
  const [connectionState, setConnectionState] = useState<
    'idle' | 'waiting_for_friend' | 'connecting' | 'connected' | 'failed' | 'disconnected'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<P2PStreamStats>({
    bitrateKbps: 0,
    packetsLost: 0,
    roundTripTimeMs: 0,
    connectionQuality: 'connecting',
  });
  const [isRoomCapacityExceeded, setIsRoomCapacityExceeded] = useState(false);
  const [hostPlaybackEvent, setHostPlaybackEvent] = useState<P2PPlaybackEvent | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesRef = useRef<number>(0);
  const prevTimestampRef = useRef<number>(0);

  // Identify the target peer for 1-on-1 P2P direct streaming
  const activeViewer = !isHost
    ? null
    : participants
        .filter((p) => p.id !== hostId)
        .sort((a, b) => a.joinedAt - b.joinedAt)[0] || null;

  const targetPeerId = isHost ? activeViewer?.id || null : hostId;

  // Capacity check: if more than 2 participants are in the room, warn 3rd+ viewers
  useEffect(() => {
    if (participants.length > 2) {
      if (!isHost && activeViewer && activeViewer.id !== myParticipantId) {
        setIsRoomCapacityExceeded(true);
      } else {
        setIsRoomCapacityExceeded(false);
      }
    } else {
      setIsRoomCapacityExceeded(false);
    }
  }, [participants, isHost, activeViewer, myParticipantId]);

  // Teardown PeerConnection and metrics
  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
    setRemoteStream(null);
  }, []);

  // Monitor WebRTC bitrate & packet loss statistics
  const startStatsMonitoring = useCallback((pc: RTCPeerConnection) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    prevBytesRef.current = 0;
    prevTimestampRef.current = Date.now();

    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;
      try {
        const report = await pc.getStats();
        let bytesNow = 0;
        let packetsLostNow = 0;
        let rttNow = 0;

        report.forEach((stat) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            bytesNow = stat.bytesReceived || 0;
            packetsLostNow = stat.packetsLost || 0;
          } else if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
            bytesNow = stat.bytesSent || 0;
          } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            rttNow = Math.round((stat.currentRoundTripTime || 0) * 1000);
          }
        });

        const now = Date.now();
        const durationSec = (now - prevTimestampRef.current) / 1000;
        let bitrate = 0;
        if (durationSec > 0 && prevBytesRef.current > 0 && bytesNow >= prevBytesRef.current) {
          bitrate = Math.round(((bytesNow - prevBytesRef.current) * 8) / durationSec / 1000);
        }
        prevBytesRef.current = bytesNow;
        prevTimestampRef.current = now;

        let quality: P2PStreamStats['connectionQuality'] = 'good';
        if (packetsLostNow > 20 || rttNow > 300) {
          quality = 'poor';
        } else if (packetsLostNow > 5 || rttNow > 150) {
          quality = 'fair';
        } else if (bitrate > 400 && packetsLostNow === 0 && rttNow < 80) {
          quality = 'excellent';
        }

        setStats({
          bitrateKbps: bitrate,
          packetsLost: packetsLostNow,
          roundTripTimeMs: rttNow,
          connectionQuality: quality,
        });
      } catch {
        // Stats read error
      }
    }, 2000);
  }, []);

  // Setup PeerConnection with Free Public STUN servers only
  const createPeerConnection = useCallback(
    (targetId: string) => {
      cleanup();

      const pc = new RTCPeerConnection(FREE_STUN_SERVERS);
      pcRef.current = pc;
      setConnectionState('connecting');
      setErrorMessage(null);

      // Connection timeout: fail if direct P2P NAT punch fails
      connectionTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          console.warn('[P2P WebRTC] Connection timeout reached without direct ICE connectivity');
          setConnectionState('failed');
          setErrorMessage(DIRECT_CONNECTION_ERROR);
        }
      }, CONNECTION_TIMEOUT_MS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emitSignal(targetId, {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
            isP2PStream: true,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setConnectionState('connected');
          setErrorMessage(null);
          startStatsMonitoring(pc);
        } else if (state === 'failed') {
          setConnectionState('failed');
          setErrorMessage(DIRECT_CONNECTION_ERROR);
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setConnectionState('failed');
          setErrorMessage(DIRECT_CONNECTION_ERROR);
        }
      };

      if (!isHost) {
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          } else {
            const stream = new MediaStream();
            stream.addTrack(event.track);
            setRemoteStream(stream);
          }
        };
      }

      return pc;
    },
    [cleanup, emitSignal, isHost, startStatsMonitoring]
  );

  // Host: Initiate direct P2P offer to the active viewer
  const initiateHostOffer = useCallback(async () => {
    if (!isHost || !localStream || !targetPeerId || isRoomCapacityExceeded) {
      if (isHost && !targetPeerId) {
        setConnectionState('waiting_for_friend');
      }
      return;
    }

    try {
      const pc = createPeerConnection(targetPeerId);

      // Attach local stream tracks (both video and audio from captureStream)
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      emitSignal(targetPeerId, {
        type: 'offer',
        sdp: offer.sdp,
        isP2PStream: true,
      });
    } catch (err: any) {
      console.error('[P2P WebRTC Host Error]', err);
      setConnectionState('failed');
      setErrorMessage(DIRECT_CONNECTION_ERROR);
    }
  }, [isHost, localStream, targetPeerId, isRoomCapacityExceeded, createPeerConnection, emitSignal]);

  // Viewer: Handle incoming offer and generate answer
  const handleIncomingOffer = useCallback(
    async (senderId: string, sdp: string) => {
      if (isHost || isRoomCapacityExceeded) return;

      try {
        const pc = createPeerConnection(senderId);

        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'offer',
            sdp,
          })
        );

        // Process any ICE candidates received before the offer was set
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        emitSignal(senderId, {
          type: 'answer',
          sdp: answer.sdp,
          isP2PStream: true,
        });
      } catch (err: any) {
        console.error('[P2P WebRTC Viewer Error]', err);
        setConnectionState('failed');
        setErrorMessage(DIRECT_CONNECTION_ERROR);
      }
    },
    [isHost, isRoomCapacityExceeded, createPeerConnection, emitSignal]
  );

  // Host: Handle incoming answer from viewer
  const handleIncomingAnswer = useCallback(async (sdp: string) => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState !== 'have-local-offer') return;

    try {
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp,
        })
      );

      while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[P2P WebRTC Answer Error]', err);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIncomingCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      iceCandidatesQueue.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[P2P WebRTC ICE Candidate Ignored]', err);
    }
  }, []);

  // Process incoming WebRTC signaling message
  const handleSignal = useCallback(
    (senderId: string, payload: any) => {
      if (!payload || !payload.isP2PStream) return;
      if (isHost && senderId !== targetPeerId) return;

      if (payload.type === 'offer' && !isHost && payload.sdp) {
        handleIncomingOffer(senderId, payload.sdp);
      } else if (payload.type === 'answer' && isHost && payload.sdp) {
        handleIncomingAnswer(payload.sdp);
      } else if (payload.type === 'ice-candidate' && payload.candidate) {
        handleIncomingCandidate(payload.candidate);
      }
    },
    [isHost, targetPeerId, handleIncomingOffer, handleIncomingAnswer, handleIncomingCandidate]
  );

  // Process authoritative host playback state events
  const handleState = useCallback(
    (_senderId: string, state: any) => {
      if (isHost || !state) return;
      setHostPlaybackEvent({
        action: state.action,
        position: state.position ?? 0,
        timestamp: state.timestamp || Date.now(),
        hostId: state.hostId || hostId,
        roomId: state.roomId || roomId,
      });
    },
    [isHost, hostId, roomId]
  );

  // Authoritative host playback state broadcaster
  const broadcastPlaybackState = useCallback(
    (action: P2PPlaybackEvent['action'], position: number) => {
      if (!isHost) return;
      const event: P2PPlaybackEvent = {
        action,
        position,
        timestamp: Date.now(),
        hostId,
        roomId,
      };
      emitState(event);
    },
    [isHost, hostId, roomId, emitState]
  );

  // Trigger offer when host stream or viewer becomes available
  useEffect(() => {
    if (isHost) {
      if (localStream && targetPeerId) {
        initiateHostOffer();
      } else if (localStream && !targetPeerId) {
        setConnectionState('waiting_for_friend');
      }
    }
  }, [isHost, localStream, targetPeerId, initiateHostOffer]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    connectionState,
    errorMessage,
    remoteStream,
    stats,
    isRoomCapacityExceeded,
    activeViewer,
    hostPlaybackEvent,
    handleSignal,
    handleState,
    broadcastPlaybackState,
    reconnect: initiateHostOffer,
    cleanup,
  };
}
