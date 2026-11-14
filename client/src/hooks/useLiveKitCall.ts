import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  RemoteTrackPublication,
  RemoteTrack,
} from 'livekit-client';

export type CallMode = 'audio' | 'video';

export interface CallParticipantState {
  id: string;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
}

interface UseLiveKitCallProps {
  roomId: string;
  token: string;
  currentUserId: string;
  currentUserName: string;
  isCallActive: boolean;
  callMode: CallMode | null;
  callParticipants: string[];
  onEmitCallAction?: (action: 'join' | 'leave') => void;
}

export function useLiveKitCall({
  roomId,
  token,
  currentUserId,
  currentUserName,
  isCallActive,
  callMode,
  callParticipants,
  onEmitCallAction,
}: UseLiveKitCallProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('video');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const [callError, setCallError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Sync active mode from room prop
  useEffect(() => {
    if (callMode) {
      setActiveCallMode(callMode);
    }
  }, [callMode]);

  // Clean disconnect helper
  const disconnectRoom = useCallback(() => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {}
      roomRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setSpeakingParticipants(new Set());
    setIsInCall(false);
    setIsConnecting(false);
  }, []);

  // When call ends globally in room, auto-disconnect
  useEffect(() => {
    if (!isCallActive && isInCall) {
      disconnectRoom();
    }
  }, [isCallActive, isInCall, disconnectRoom]);

  // Join Call action
  const joinCall = useCallback(
    async (modeOverride?: CallMode) => {
      const mode = modeOverride || callMode || 'video';
      setActiveCallMode(mode);
      setIsConnecting(true);
      setCallError(null);

      try {
        // 1. Request LiveKit Token from server
        const res = await fetch(`/api/rooms/${roomId}/call/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, mode }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to authenticate call');
        }

        // Notify room members via call action
        onEmitCallAction?.('join');

        // 2. If LiveKit Cloud is configured
        if (data.provider === 'livekit' && data.url && data.token) {
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          roomRef.current = room;

          // Event Listeners
          room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            const speakerIds = new Set(speakers.map((s) => s.identity));
            setSpeakingParticipants(speakerIds);
          });

          room.on(
            RoomEvent.TrackSubscribed,
            (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
              if (track.kind === Track.Kind.Audio) {
                try {
                  const audioEl = track.attach();
                  audioEl.id = `livekit-audio-${participant.identity}`;
                } catch (e) {
                  console.warn('[LiveKit] Track attach error:', e);
                }
              }
              const stream = new MediaStream([track.mediaStreamTrack]);
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                const existing = next.get(participant.identity);
                if (existing) {
                  existing.addTrack(track.mediaStreamTrack);
                  return next;
                }
                next.set(participant.identity, stream);
                return next;
              });
            }
          );

          room.on(
            RoomEvent.TrackUnsubscribed,
            (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
              if (track.kind === Track.Kind.Audio) {
                try {
                  track.detach().forEach((el) => el.remove());
                } catch {}
              }
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                const stream = next.get(participant.identity);
                if (stream) {
                  stream.removeTrack(track.mediaStreamTrack);
                  if (stream.getTracks().length === 0) {
                    next.delete(participant.identity);
                  }
                }
                return next;
              });
            }
          );

          room.on(RoomEvent.Disconnected, () => {
            disconnectRoom();
          });

          // Connect to LiveKit Room
          await room.connect(data.url, data.token);

          // Configure Tracks based on Mode
          if (mode === 'audio') {
            // Strictly microphone only — genuine audio calling
            await room.localParticipant.setMicrophoneEnabled(true);
            await room.localParticipant.setCameraEnabled(false);
          } else {
            // Video mode: request both
            try {
              await room.localParticipant.setCameraEnabled(true);
            } catch (camErr) {
              console.warn('[LiveKit] Camera permission issue:', camErr);
            }
            try {
              await room.localParticipant.setMicrophoneEnabled(true);
            } catch (micErr) {
              console.warn('[LiveKit] Mic permission issue:', micErr);
            }
          }

          setIsInCall(true);
          return;
        }

        // 3. Resilient Fallback: Browser WebRTC UserMedia
        let stream: MediaStream;
        if (mode === 'audio') {
          // Strictly microphone only
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else {
          // Video mode: camera + mic
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            });
          } catch {
            // Fallback to audio-only if physical camera is blocked or unavailable
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
        }

        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsInCall(true);
      } catch (err: any) {
        console.error('[Call Join Error]', err);
        setCallError(err.message || 'Permission denied or media device unavailable');
        disconnectRoom();
      } finally {
        setIsConnecting(false);
      }
    },
    [roomId, token, callMode, onEmitCallAction, disconnectRoom]
  );

  // Leave Call action
  const leaveCall = useCallback(() => {
    onEmitCallAction?.('leave');
    disconnectRoom();
  }, [onEmitCallAction, disconnectRoom]);

  // Toggle Microphone
  const toggleMic = useCallback(async () => {
    if (roomRef.current) {
      const nextMuted = !isMicMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMicMuted(nextMuted);
      return;
    }

    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextMuted = !isMicMuted;
        audioTracks.forEach((t) => (t.enabled = !nextMuted));
        setIsMicMuted(nextMuted);
      }
    }
  }, [isMicMuted]);

  // Toggle Camera (Only available in Video mode)
  const toggleCamera = useCallback(async () => {
    if (activeCallMode !== 'video') return;

    if (roomRef.current) {
      const nextOff = !isCameraOff;
      await roomRef.current.localParticipant.setCameraEnabled(!nextOff);
      setIsCameraOff(nextOff);
      return;
    }

    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextOff = !isCameraOff;
        videoTracks.forEach((t) => (t.enabled = !nextOff));
        setIsCameraOff(nextOff);
      }
    }
  }, [activeCallMode, isCameraOff]);

  return {
    isInCall,
    activeCallMode,
    isConnecting,
    callError,
    isMicMuted,
    isCameraOff,
    localStream,
    remoteStreams,
    speakingParticipants,
    joinCall,
    leaveCall,
    toggleMic,
    toggleCamera,
  };
}
