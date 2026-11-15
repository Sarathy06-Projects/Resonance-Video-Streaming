import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioRoomManager,
  AudioParticipantInfo,
  DIRECT_AUDIO_ERROR_MSG,
} from '../webrtc/AudioRoomManager';
import { RoomEvent } from '../types';

interface UseAudioCallProps {
  roomId: string;
  token: string;
  myUserId: string;
  myUserName: string;
  isHost: boolean;
  emitAudioEvent: (type: string, payload?: any) => void;
}

export function useAudioCall({
  roomId,
  token,
  myUserId,
  myUserName,
  isHost,
  emitAudioEvent,
}: UseAudioCallProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [participants, setParticipants] = useState<AudioParticipantInfo[]>([]);
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const [callError, setCallError] = useState<string | null>(null);

  const managerRef = useRef<AudioRoomManager | null>(null);
  const emitRef = useRef(emitAudioEvent);
  emitRef.current = emitAudioEvent;

  // Initialize AudioRoomManager instance
  const getOrCreateManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new AudioRoomManager(
        myUserId,
        myUserName,
        isHost,
        {
          onEmitSignal: (targetParticipantId, type, payload) => {
            emitRef.current(type, { ...payload, targetParticipantId });
          },
          onEmitMuteState: (muted) => {
            emitRef.current(muted ? 'audio.participant.muted' : 'audio.participant.unmuted', {
              participantId: myUserId,
            });
          },
          onParticipantsUpdated: (updatedList) => {
            setParticipants(updatedList);
          },
          onSpeakingChanged: (speakingSet) => {
            setSpeakingParticipants(speakingSet);
          },
          onError: (errMsg) => {
            setCallError(errMsg);
            setIsConnecting(false);
          },
          onConnectionFailed: (peerId) => {
            setCallError(DIRECT_AUDIO_ERROR_MSG);
          },
        }
      );
    }
    return managerRef.current;
  }, [myUserId, myUserName, isHost]);

  // Clean up manager on unmount or room leave
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.leaveCall();
        managerRef.current = null;
      }
    };
  }, [roomId]);

  /**
   * Host starts audio call for the room
   */
  const startCall = useCallback(async () => {
    if (!isHost) {
      setCallError('Only the room host can start an audio call.');
      return;
    }

    try {
      setCallError(null);
      setIsConnecting(true);

      const manager = getOrCreateManager();
      // Acquire microphone first to verify permissions
      await manager.acquireMicrophone();

      // Emit start call event
      emitRef.current('audio.call.start', {
        hostId: myUserId,
        hostName: myUserName,
      });

      setIsCallActive(true);
      setIsInCall(true);
      setIsConnecting(false);
      setIsMicMuted(false);
    } catch (err: any) {
      setIsConnecting(false);
      setIsInCall(false);
      // Manager already fired onError with friendly message
    }
  }, [isHost, myUserId, myUserName, getOrCreateManager]);

  /**
   * Participant joins the active audio call
   */
  const joinCall = useCallback(async () => {
    try {
      setCallError(null);
      setIsConnecting(true);

      const manager = getOrCreateManager();
      // Acquire microphone first
      await manager.acquireMicrophone();

      // Emit join call event
      emitRef.current('audio.call.join', {
        participantId: myUserId,
        participantName: myUserName,
      });

      setIsInCall(true);
      setIsConnecting(false);
      setIsMicMuted(false);
    } catch (err: any) {
      setIsConnecting(false);
      setIsInCall(false);
    }
  }, [myUserId, myUserName, getOrCreateManager]);

  /**
   * Leave current audio call (does not end call for others)
   */
  const leaveCall = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.leaveCall();
      managerRef.current = null;
    }

    emitRef.current('audio.call.leave', {
      participantId: myUserId,
    });

    setIsInCall(false);
    setIsConnecting(false);
    setParticipants([]);
    setSpeakingParticipants(new Set());
  }, [myUserId]);

  /**
   * Host ends audio call for everyone
   */
  const endCall = useCallback(() => {
    if (!isHost) {
      leaveCall();
      return;
    }

    if (managerRef.current) {
      managerRef.current.leaveCall();
      managerRef.current = null;
    }

    emitRef.current('audio.call.end', {
      endedBy: myUserId,
    });

    setIsCallActive(false);
    setIsInCall(false);
    setIsConnecting(false);
    setParticipants([]);
    setSpeakingParticipants(new Set());
  }, [isHost, myUserId, leaveCall]);

  /**
   * Toggle local microphone mute
   */
  const toggleMute = useCallback(() => {
    if (managerRef.current) {
      const nextMuted = !isMicMuted;
      managerRef.current.setMuted(nextMuted);
      setIsMicMuted(nextMuted);
    }
  }, [isMicMuted]);

  /**
   * Retry all failed peer connections in mesh
   */
  const retryConnections = useCallback(() => {
    setCallError(null);
    if (managerRef.current) {
      managerRef.current.retryConnections();
    }
  }, []);

  const clearError = useCallback(() => {
    setCallError(null);
  }, []);

  /**
   * Central WebRTC signal and room event dispatcher for audio mesh
   */
  const handleAudioEvent = useCallback(
    async (event: RoomEvent) => {
      const { type, senderId, payload } = event;

      switch (type) {
        case 'audio.call.state': {
          if (payload?.error) {
            setCallError(payload.error);
            setIsConnecting(false);
            if (payload.error.includes('full')) {
              setIsInCall(false);
            }
          }
          if (typeof payload?.audioCallActive === 'boolean') {
            setIsCallActive(payload.audioCallActive);
            if (!payload.audioCallActive && isInCall) {
              // Call ended on server
              if (managerRef.current) {
                managerRef.current.leaveCall();
                managerRef.current = null;
              }
              setIsInCall(false);
              setParticipants([]);
            }
          }
          break;
        }

        case 'audio.call.start': {
          setIsCallActive(true);
          break;
        }

        case 'audio.call.end': {
          setIsCallActive(false);
          if (isInCall) {
            if (managerRef.current) {
              managerRef.current.leaveCall();
              managerRef.current = null;
            }
            setIsInCall(false);
            setParticipants([]);
            setSpeakingParticipants(new Set());
          }
          break;
        }

        case 'audio.participant.joined': {
          setIsCallActive(true);
          const joinedId = payload?.participantId;
          const joinedName = payload?.participantName || 'Guest';

          // If I am in the call and another peer joined, add them to my mesh
          if (isInCall && joinedId && joinedId !== myUserId) {
            const manager = getOrCreateManager();
            manager.addPeer(joinedId, joinedName);
          }

          // If I just joined, connect to all other active participants in room
          if (joinedId === myUserId && Array.isArray(payload?.allParticipants)) {
            const manager = getOrCreateManager();
            payload.allParticipants.forEach((p: { id: string; name: string }) => {
              if (p.id !== myUserId) {
                manager.addPeer(p.id, p.name);
              }
            });
          }
          break;
        }

        case 'audio.participant.left': {
          const leftId = payload?.participantId;
          if (leftId && managerRef.current) {
            managerRef.current.removePeer(leftId);
          }
          break;
        }

        case 'audio.offer':
        case 'audio.answer':
        case 'audio.ice_candidate': {
          // If targeted to me
          if (payload?.targetParticipantId === myUserId && isInCall) {
            const manager = getOrCreateManager();
            await manager.handleSignal(senderId, payload.senderName || 'Peer', type, payload);
          }
          break;
        }

        case 'audio.participant.muted':
        case 'audio.participant.unmuted': {
          const participantId = payload?.participantId;
          const isMuted = type === 'audio.participant.muted';
          setParticipants((prev) =>
            prev.map((p) => (p.id === participantId ? { ...p, isMuted } : p))
          );
          break;
        }
      }
    },
    [isInCall, myUserId, getOrCreateManager]
  );

  return {
    isCallActive,
    isInCall,
    isConnecting,
    isMicMuted,
    participants,
    speakingParticipants,
    callError,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMute,
    retryConnections,
    clearError,
    handleAudioEvent,
  };
}
