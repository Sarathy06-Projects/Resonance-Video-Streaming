import { useState, useRef, useEffect, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PeerConnectionData {
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

interface UseVideoCallProps {
  currentUserId: string;
  currentUserName: string;
  isCallActive: boolean;
  callParticipants: string[];
  onEmitSignal: (targetParticipantId: string, signal: any) => void;
  onEmitMediaState: (isMuted: boolean, isCameraOff: boolean) => void;
}

export function useVideoCall({
  currentUserId,
  currentUserName,
  isCallActive,
  callParticipants,
  onEmitSignal,
  onEmitMediaState,
}: UseVideoCallProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [mediaStates, setMediaStates] = useState<
    Map<string, { isMuted: boolean; isCameraOff: boolean }>
  >(new Map());

  const peersRef = useRef<Map<string, PeerConnectionData>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Generate fallback canvas video stream if physical camera is blocked or unavailable
  const createFallbackStream = useCallback((name: string): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');

    let angle = 0;
    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(160, 100, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name.charAt(0).toUpperCase() || 'U', 160, 108);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText(name, 160, 160);

      angle += 0.05;
      requestAnimationFrame(draw);
    };
    draw();

    const videoStream = canvas.captureStream(15);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const dst = audioContext.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false; // Muted by default
    videoStream.addTrack(track);

    return videoStream;
  }, []);

  // Acquire local media
  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.warn('[VideoCall] Camera/mic access fallback', err);
      const fallback = createFallbackStream(currentUserName);
      setLocalStream(fallback);
      localStreamRef.current = fallback;
      return fallback;
    }
  }, [createFallbackStream, currentUserName]);

  // Create peer connection to remote participant
  const createPeer = useCallback(
    (targetId: string, initiator: boolean, stream: MediaStream) => {
      if (peersRef.current.has(targetId)) {
        return peersRef.current.get(targetId)!.pc;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Send local ICE candidates to target peer
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          onEmitSignal(targetId, {
            signalType: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      // Listen for remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remote = event.streams[0];
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(targetId, remote);
            return next;
          });
          if (peersRef.current.has(targetId)) {
            peersRef.current.get(targetId)!.stream = remote;
          }
        }
      };

      peersRef.current.set(targetId, { pc });

      // If initiator, create offer
      if (initiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            onEmitSignal(targetId, {
              signalType: 'offer',
              sdp: pc.localDescription,
            });
          })
          .catch((e) => console.error('[VideoCall] Error creating offer:', e));
      }

      return pc;
    },
    [onEmitSignal]
  );

  // Join call action
  const joinCall = useCallback(async () => {
    const stream = await startLocalMedia();
    setIsInCall(true);

    // For any already-joined participants in the call, initiate peer connection
    callParticipants.forEach((pId) => {
      if (pId !== currentUserId) {
        createPeer(pId, true, stream);
      }
    });
  }, [callParticipants, currentUserId, createPeer, startLocalMedia]);

  // Leave call action
  const leaveCall = useCallback(() => {
    // Close all peer connections
    peersRef.current.forEach(({ pc }) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peersRef.current.clear();

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setIsInCall(false);
  }, []);

  // When call ends globally, clean up
  useEffect(() => {
    if (!isCallActive && isInCall) {
      leaveCall();
    }
  }, [isCallActive, isInCall, leaveCall]);

  // Handle incoming signaling message
  const handleIncomingSignal = useCallback(
    async (senderId: string, payload: any) => {
      if (!isInCall || !localStreamRef.current) return;

      const { signalType, sdp, candidate } = payload;
      let peer = peersRef.current.get(senderId);

      if (!peer) {
        const pc = createPeer(senderId, false, localStreamRef.current);
        peer = { pc };
      }

      const pc = peer.pc;

      try {
        if (signalType === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          onEmitSignal(senderId, {
            signalType: 'answer',
            sdp: pc.localDescription,
          });
        } else if (signalType === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } else if (signalType === 'candidate' && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('[VideoCall] Signal processing error:', err);
      }
    },
    [createPeer, isInCall, onEmitSignal]
  );

  // Handle participant joined call
  const handleParticipantJoined = useCallback(
    (participantId: string) => {
      if (isInCall && localStreamRef.current && participantId !== currentUserId) {
        createPeer(participantId, true, localStreamRef.current);
      }
    },
    [currentUserId, isInCall, createPeer]
  );

  // Handle participant left call
  const handleParticipantLeft = useCallback((participantId: string) => {
    if (peersRef.current.has(participantId)) {
      try {
        peersRef.current.get(participantId)!.pc.close();
      } catch (e) {}
      peersRef.current.delete(participantId);
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(participantId);
      return next;
    });
    setMediaStates((prev) => {
      const next = new Map(prev);
      next.delete(participantId);
      return next;
    });
  }, []);

  // Handle remote media state
  const handleRemoteMediaState = useCallback(
    (participantId: string, isMuted: boolean, isCameraOff: boolean) => {
      setMediaStates((prev) => {
        const next = new Map(prev);
        next.set(participantId, { isMuted, isCameraOff });
        return next;
      });
    },
    []
  );

  // Toggle local mic
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setIsMicMuted(muted);
      onEmitMediaState(muted, isCameraOff);
    }
  }, [isCameraOff, onEmitMediaState]);

  // Toggle local camera
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const camOff = !videoTrack.enabled;
      setIsCameraOff(camOff);
      onEmitMediaState(isMicMuted, camOff);
    }
  }, [isMicMuted, onEmitMediaState]);

  return {
    isInCall,
    localStream,
    remoteStreams,
    mediaStates,
    isMicMuted,
    isCameraOff,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
    handleIncomingSignal,
    handleParticipantJoined,
    handleParticipantLeft,
    handleRemoteMediaState,
  };
}
