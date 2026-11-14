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
  const playbackStateRef = useRef<PlaybackState | null>(null);
  const [hostId, setHostId] = useState<string>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);
  const [callParticipants, setCallParticipants] = useState<string[]>([]);
  const [callHostName, setCallHostName] = useState<string>('');
  const reconnectAttemptsRef = useRef(0);
  const lastChatTimestampRef = useRef<number>(0);
  const pollTimerRef = useRef<any>(null);

  // Synchronize playback state ref
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // HTTP Polling fallback function for Vercel Serverless
  const pollRoom = useCallback(async () => {
    if (!roomId || !token) return;
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/poll?token=${encodeURIComponent(token)}&since=${lastChatTimestampRef.current}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      // Mark status as connected since HTTP sync is actively running
      setConnectionStatus((prev) => (prev === 'kicked' ? 'kicked' : 'connected'));

      if (data.metadata) {
        setMetadata(data.metadata);
        setIsLocked(Boolean(data.metadata.isLocked));
      }
      if (data.hostId) setHostId(data.hostId);
      if (data.participants) setParticipants(data.participants);
      if (data.queue) setQueue(data.queue);

      // Call state
      if (typeof data.isCallActive === 'boolean') {
        if (data.isCallActive && !isCallActiveRef.current) {
          onCallStarted?.(data.callHostName || 'Creator', data.callParticipants || []);
        } else if (!data.isCallActive && isCallActiveRef.current) {
          onCallEnded?.();
        }
        setIsCallActive(data.isCallActive);
      }
      if (Array.isArray(data.callParticipants)) setCallParticipants(data.callParticipants);
      if (data.callHostName) setCallHostName(data.callHostName);

      // WebRTC Signals
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        for (const sig of data.signals) {
          onCallSignal?.(sig.senderId, sig.payload);
        }
      }

      // Chat Messages
      if (Array.isArray(data.recentChat) && data.recentChat.length > 0) {
        const newMsgs = data.recentChat.filter(
          (m: ChatMessage) => m.timestamp > lastChatTimestampRef.current
        );
        if (newMsgs.length > 0) {
          lastChatTimestampRef.current = Math.max(
            ...newMsgs.map((m: ChatMessage) => m.timestamp)
          );
          setChatMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const fresh = newMsgs.filter((m: ChatMessage) => !existingIds.has(m.id));
            return [...prev, ...fresh];
          });
          newMsgs.forEach((m: ChatMessage) => onNewChat?.(m));
        }
      }

      // Playback State Sync
      if (data.playback) {
        const sPb = data.playback;
        const cPb = playbackStateRef.current;

        // Video Change check
        if (sPb.videoId && cPb?.videoId && sPb.videoId !== cPb.videoId) {
          setMetadata((prev) => (prev ? { ...prev, videoId: sPb.videoId, title: data.metadata?.title || prev.title } : null));
          onVideoChange?.(sPb.videoId, data.metadata?.title);
        }

        // Status change check
        if (sPb.status === 'playing' && cPb?.status !== 'playing') {
          onPlaybackPlay?.(sPb.position, sPb.updatedAt, sPb.playbackRate || 1.0);
        } else if (sPb.status === 'paused' && cPb?.status === 'playing') {
          onPlaybackPause?.(sPb.position, sPb.updatedAt);
        }

        setPlaybackState(sPb);
      }
    } catch {
      // ignore network blips in poll
    }
  }, [
    roomId,
    token,
    onCallStarted,
    onCallEnded,
    onCallSignal,
    onNewChat,
    onVideoChange,
    onPlaybackPlay,
    onPlaybackPause,
  ]);

  const connect = useCallback(() => {
    if (!roomId || !token) return;

    // Start polling immediately to ensure instant room state
    pollRoom();
    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(pollRoom, 1500);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:4000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/rooms/${roomId}/connect?token=${encodeURIComponent(token)}`;

    setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'));
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
      // WebSocket creation failed (e.g. unsupported platform) -> fallback to HTTP sync
      setConnectionStatus('connected');
      return;
    }

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
            if (recentChat) {
              setChatMessages(recentChat);
              if (recentChat.length > 0) {
                lastChatTimestampRef.current = Math.max(
                  ...recentChat.map((m: ChatMessage) => m.timestamp)
                );
              }
            }
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
            lastChatTimestampRef.current = Math.max(lastChatTimestampRef.current, msg.timestamp);
            onNewChat?.(msg);
            break;
          }

          case 'reaction:broadcast': {
            const reaction: Reaction = roomEvent.payload.reaction;
            setReactions((prev) => [...prev.slice(-19), reaction]);
            onNewReaction?.(reaction);
            break;
          }

          case 'member:joined': {
            const participant: Participant = roomEvent.payload.participant;
            setParticipants((prev) => {
              if (prev.some((p) => p.id === participant.id)) return prev;
              return [...prev, participant];
            });
            break;
          }

          case 'member:left': {
            const { memberId } = roomEvent.payload;
            setParticipants((prev) => prev.filter((p) => p.id !== memberId));
            break;
          }

          case 'member:kicked': {
            const { targetMemberId, reason } = roomEvent.payload;
            setParticipants((prev) => prev.filter((p) => p.id !== targetMemberId));
            onKicked?.(reason || 'You have been kicked by the host.');
            break;
          }

          case 'host:transferred': {
            const { newHostId } = roomEvent.payload;
            setHostId(newHostId);
            setParticipants((prev) =>
              prev.map((p) => ({
                ...p,
                role: p.id === newHostId ? 'host' : p.role === 'host' ? 'guest' : p.role,
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
      // On close, maintain connected status via HTTP Polling fallback
      setConnectionStatus('connected');

      if (reconnectAttemptsRef.current < 3) {
        reconnectAttemptsRef.current++;
        const timeout = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 5000);
        setTimeout(() => {
          connect();
        }, timeout);
      }
    };

    ws.onerror = () => {
      // If WebSocket fails, stay connected via HTTP sync
      setConnectionStatus('connected');
    };
  }, [
    roomId,
    token,
    pollRoom,
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
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback(
    (type: string, payload: Record<string, any> = {}) => {
      // 1. Send via WebSocket if open
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

      // 2. Dual / HTTP Fallback endpoints for Vercel Serverless
      if (type === 'playback:play') {
        fetch(`/api/rooms/${roomId}/playback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            status: 'playing',
            position: payload.position,
            updatedAt: Date.now(),
            playbackRate: payload.playbackRate || 1,
          }),
        }).catch(() => {});
      } else if (type === 'playback:pause') {
        fetch(`/api/rooms/${roomId}/playback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            status: 'paused',
            position: payload.position,
            updatedAt: Date.now(),
          }),
        }).catch(() => {});
      } else if (type === 'playback:seek') {
        fetch(`/api/rooms/${roomId}/playback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            status: payload.status || 'playing',
            position: payload.position,
            updatedAt: Date.now(),
          }),
        }).catch(() => {});
      } else if (type === 'video:change') {
        fetch(`/api/rooms/${roomId}/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, videoId: payload.videoId, title: payload.title }),
        }).catch(() => {});
      } else if (type === 'chat:message') {
        fetch(`/api/rooms/${roomId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, text: payload.text }),
        })
          .then(async (res) => {
            if (res.ok) {
              const d = await res.json();
              if (d.message) {
                setChatMessages((prev) => [...prev, d.message]);
                lastChatTimestampRef.current = Math.max(
                  lastChatTimestampRef.current,
                  d.message.timestamp
                );
                onNewChat?.(d.message);
              }
            }
          })
          .catch(() => {});
      } else if (type === 'call:start') {
        fetch(`/api/rooms/${roomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'start' }),
        }).catch(() => {});
      } else if (type === 'call:end') {
        fetch(`/api/rooms/${roomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'end' }),
        }).catch(() => {});
      } else if (type === 'call:join') {
        fetch(`/api/rooms/${roomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'join' }),
        }).catch(() => {});
      } else if (type === 'call:leave') {
        fetch(`/api/rooms/${roomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'leave' }),
        }).catch(() => {});
      } else if (type === 'call:signal') {
        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            targetParticipantId: payload.targetParticipantId,
            payload,
          }),
        }).catch(() => {});
      }
    },
    [roomId, token, onNewChat]
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
