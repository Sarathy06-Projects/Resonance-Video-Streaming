import { useEffect, useRef, useState, useCallback } from 'react';
import {
  RoomEvent,
  PlaybackState,
  Participant,
  ChatMessage,
  Reaction,
  QueueItem,
  RoomMetadata,
} from '../types';

interface UseRoomSocketProps {
  roomId: string;
  token: string;
  onPlaybackPlay?: (position: number, updatedAt: number, playbackRate: number) => void;
  onPlaybackPause?: (position: number, updatedAt: number) => void;
  onPlaybackSeek?: (position: number, status: string) => void;
  onPlaybackRate?: (rate: number, position: number) => void;
  onVideoChange?: (videoId: string, title?: string) => void;
  onNewChat?: (message: ChatMessage) => void;
  onNewReaction?: (reaction: Reaction) => void;
  onKicked?: (message: string) => void;
  onRoomClosed?: (reason: string) => void;
  onCallStarted?: (hostName: string, callParticipants: string[]) => void;
  onCallEnded?: () => void;
  onCallParticipantJoined?: (participantId: string, callParticipants: string[]) => void;
  onCallParticipantLeft?: (participantId: string, callParticipants: string[]) => void;
  onCallSignal?: (senderId: string, payload: any) => void;
  onCallMediaState?: (participantId: string, isMuted: boolean, isCameraOff: boolean) => void;
}

export function useRoomSocket({
  roomId,
  token,
  onPlaybackPlay,
  onPlaybackPause,
  onPlaybackSeek,
  onPlaybackRate,
  onVideoChange,
  onNewChat,
  onNewReaction,
  onKicked,
  onRoomClosed,
  onCallStarted,
  onCallEnded,
  onCallParticipantJoined,
  onCallParticipantLeft,
  onCallSignal,
  onCallMediaState,
}: UseRoomSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'kicked'
  >('connecting');

  const [metadata, setMetadata] = useState<RoomMetadata | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [hostId, setHostId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callParticipants, setCallParticipants] = useState<string[]>([]);
  const [callHostName, setCallHostName] = useState<string>('');
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!roomId || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:4000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/rooms/${roomId}/connect?token=${encodeURIComponent(token)}`;

    setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const roomEvent: RoomEvent = JSON.parse(event.data);
        switch (roomEvent.type) {
          case 'room:state': {
            const { metadata, hostId, playback, participants, recentChat, queue, isCallActive, callParticipants } =
              roomEvent.payload;
            if (metadata) {
              setMetadata(metadata);
              setIsLocked(Boolean(metadata.isLocked));
            }
            if (hostId) setHostId(hostId);
            if (playback) setPlaybackState(playback);
            if (participants) setParticipants(participants);
            if (recentChat) setChatMessages(recentChat);
            if (queue) setQueue(queue);
            if (typeof isCallActive === 'boolean') setIsCallActive(isCallActive);
            if (Array.isArray(callParticipants)) setCallParticipants(callParticipants);
            break;
          }

          case 'playback:play': {
            const { position, updatedAt, playbackRate } = roomEvent.payload;
            setPlaybackState((prev) => ({
              videoId: prev?.videoId || '',
              status: 'playing',
              position,
              updatedAt: updatedAt || Date.now(),
              playbackRate: playbackRate || prev?.playbackRate || 1.0,
              sequence: prev?.sequence || 0,
              hostId: prev?.hostId || '',
            }));
            onPlaybackPlay?.(position, updatedAt, playbackRate || 1.0);
            break;
          }

          case 'playback:pause': {
            const { position, updatedAt } = roomEvent.payload;
            setPlaybackState((prev) => ({
              videoId: prev?.videoId || '',
              status: 'paused',
              position,
              updatedAt: updatedAt || Date.now(),
              playbackRate: prev?.playbackRate || 1.0,
              sequence: prev?.sequence || 0,
              hostId: prev?.hostId || '',
            }));
            onPlaybackPause?.(position, updatedAt);
            break;
          }

          case 'playback:seek': {
            const { position, status } = roomEvent.payload;
            setPlaybackState((prev) => ({
              videoId: prev?.videoId || '',
              status: status || prev?.status || 'playing',
              position,
              updatedAt: Date.now(),
              playbackRate: prev?.playbackRate || 1.0,
              sequence: prev?.sequence || 0,
              hostId: prev?.hostId || '',
            }));
            onPlaybackSeek?.(position, status);
            break;
          }

          case 'playback:rate': {
            const { playbackRate, position } = roomEvent.payload;
            setPlaybackState((prev) => ({
              videoId: prev?.videoId || '',
              status: prev?.status || 'playing',
              position: typeof position === 'number' ? position : (prev?.position || 0),
              updatedAt: Date.now(),
              playbackRate: playbackRate || 1.0,
              sequence: prev?.sequence || 0,
              hostId: prev?.hostId || '',
            }));
            onPlaybackRate?.(playbackRate, position);
            break;
          }

          case 'video:change': {
            const { videoId, title, position, status } = roomEvent.payload;
            setPlaybackState((prev) =>
              prev
                ? { ...prev, videoId, position: position || 0, status: status || 'playing', updatedAt: Date.now() }
                : null
            );
            setMetadata((prev) => (prev ? { ...prev, videoId, title: title || prev.title } : null));
            onVideoChange?.(videoId, title);
            break;
          }

          case 'chat:message': {
            const msg: ChatMessage = roomEvent.payload.message;
            setChatMessages((prev) => [...prev.slice(-99), msg]);
            onNewChat?.(msg);
            break;
          }

          case 'reaction:send': {
            const reaction: Reaction = roomEvent.payload.reaction;
            setReactions((prev) => [...prev.slice(-20), reaction]);
            onNewReaction?.(reaction);
            break;
          }

          case 'member:join': {
            const p: Participant = roomEvent.payload.participant;
            setParticipants((prev) => {
              if (prev.some((x) => x.id === p.id)) return prev;
              return [...prev, p];
            });
            break;
          }

          case 'member:leave': {
            const leftId = roomEvent.payload.participantId;
            setParticipants((prev) => prev.filter((p) => p.id !== leftId));
            break;
          }

          case 'member:kick': {
            setConnectionStatus('kicked');
            onKicked?.(roomEvent.payload.message || 'You were kicked from this room');
            break;
          }

          case 'host:transfer': {
            const { newHostId } = roomEvent.payload;
            setHostId(newHostId);
            setParticipants((prev) =>
              prev.map((p) => ({
                ...p,
                role: p.id === newHostId ? 'host' : 'guest',
              }))
            );
            break;
          }

          case 'room:lock': {
            setIsLocked(Boolean(roomEvent.payload.isLocked));
            setMetadata((prev) => (prev ? { ...prev, isLocked: Boolean(roomEvent.payload.isLocked) } : null));
            break;
          }

          case 'room:closed': {
            setConnectionStatus('disconnected');
            onRoomClosed?.(roomEvent.payload.reason || 'Room closed');
            break;
          }

          case 'queue:sync': {
            setQueue(roomEvent.payload.queue || []);
            break;
          }

          // Video Call Real-Time Events
          case 'call:started': {
            const { hostName, callParticipants } = roomEvent.payload;
            setIsCallActive(true);
            setCallHostName(hostName || 'Creator');
            setCallParticipants(callParticipants || []);
            onCallStarted?.(hostName, callParticipants || []);
            break;
          }

          case 'call:ended': {
            setIsCallActive(false);
            setCallParticipants([]);
            setCallHostName('');
            onCallEnded?.();
            break;
          }

          case 'call:participant_joined': {
            const { participantId, callParticipants: updatedList } = roomEvent.payload;
            setCallParticipants(updatedList || []);
            onCallParticipantJoined?.(participantId, updatedList || []);
            break;
          }

          case 'call:participant_left': {
            const { participantId, callParticipants: updatedList } = roomEvent.payload;
            setCallParticipants(updatedList || []);
            onCallParticipantLeft?.(participantId, updatedList || []);
            break;
          }

          case 'call:signal': {
            onCallSignal?.(roomEvent.senderId, roomEvent.payload);
            break;
          }

          case 'call:media-state': {
            const { participantId, isMuted, isCameraOff } = roomEvent.payload;
            onCallMediaState?.(participantId, isMuted, isCameraOff);
            break;
          }
        }
      } catch (err) {
        console.error('[RoomSocket Message Error]', err);
      }
    };

    ws.onclose = (event) => {
      if (event.code === 4001) {
        setConnectionStatus('kicked');
        return;
      }
      setConnectionStatus('disconnected');

      if (reconnectAttemptsRef.current < 5) {
        reconnectAttemptsRef.current++;
        const timeout = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000);
        setTimeout(() => {
          connect();
        }, timeout);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
    };
  }, [
    roomId,
    token,
    onPlaybackPlay,
    onPlaybackPause,
    onPlaybackSeek,
    onPlaybackRate,
    onVideoChange,
    onNewChat,
    onNewReaction,
    onKicked,
    onRoomClosed,
    onCallStarted,
    onCallEnded,
    onCallParticipantJoined,
    onCallParticipantLeft,
    onCallSignal,
    onCallMediaState,
  ]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback(
    (type: string, payload: Record<string, any> = {}) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const event = {
          id: Math.random().toString(36).substring(2, 9),
          roomId,
          type,
          senderId: 'client',
          sequence: 0,
          sentAt: Date.now(),
          payload,
        };
        wsRef.current.send(JSON.stringify(event));
      }
    },
    [roomId]
  );

  const emitPlay = useCallback((position: number) => send('playback:play', { position }), [send]);
  const emitPause = useCallback((position: number) => send('playback:pause', { position }), [send]);
  const emitSeek = useCallback((position: number) => send('playback:seek', { position }), [send]);
  const emitRate = useCallback((playbackRate: number) => send('playback:rate', { playbackRate }), [send]);
  const emitVideoChange = useCallback(
    (videoId: string, title?: string) => send('video:change', { videoId, title }),
    [send]
  );
  const emitChatMessage = useCallback((text: string) => send('chat:message', { text }), [send]);
  const emitReaction = useCallback(
    (emoji: string, type: string) => send('reaction:send', { emoji, type }),
    [send]
  );
  const emitTransferHost = useCallback(
    (targetParticipantId: string) => send('host:transfer', { targetParticipantId }),
    [send]
  );
  const emitKickMember = useCallback(
    (targetMemberId: string) => send('member:kick', { targetMemberId }),
    [send]
  );
  const emitToggleLock = useCallback((isLocked: boolean) => send('room:lock', { isLocked }), [send]);
  const emitAddToQueue = useCallback(
    (videoId: string, title: string, thumbnailUrl: string) =>
      send('queue:add', { videoId, title, thumbnailUrl }),
    [send]
  );
  const emitRemoveFromQueue = useCallback((itemId: string) => send('queue:remove', { itemId }), [send]);
  const emitPlayNextQueue = useCallback(() => send('queue:next', {}), [send]);

  // Video Call Emitters
  const emitStartCall = useCallback(() => send('call:start', {}), [send]);
  const emitEndCall = useCallback(() => send('call:end', {}), [send]);
  const emitJoinCall = useCallback(() => send('call:join', {}), [send]);
  const emitLeaveCall = useCallback(() => send('call:leave', {}), [send]);
  const emitCallSignal = useCallback(
    (targetParticipantId: string, signal: any) =>
      send('call:signal', { targetParticipantId, ...signal }),
    [send]
  );
  const emitMediaState = useCallback(
    (isMuted: boolean, isCameraOff: boolean) =>
      send('call:media-state', { isMuted, isCameraOff }),
    [send]
  );

  return {
    connectionStatus,
    metadata,
    playbackState,
    hostId,
    participants,
    chatMessages,
    queue,
    reactions,
    isLocked,
    isCallActive,
    callParticipants,
    callHostName,
    emitPlay,
    emitPause,
    emitSeek,
    emitRate,
    emitVideoChange,
    emitChatMessage,
    emitReaction,
    emitTransferHost,
    emitKickMember,
    emitToggleLock,
    emitAddToQueue,
    emitRemoveFromQueue,
    emitPlayNextQueue,
    emitStartCall,
    emitEndCall,
    emitJoinCall,
    emitLeaveCall,
    emitCallSignal,
    emitMediaState,
  };
}
