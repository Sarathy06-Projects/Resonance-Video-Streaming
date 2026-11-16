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
  onCallStarted?: (hostName: string, callParticipants: string[], mode: 'audio' | 'video') => void;
  onCallEnded?: () => void;
  onCallParticipantJoined?: (participantId: string, callParticipants: string[]) => void;
  onCallParticipantLeft?: (participantId: string, callParticipants: string[]) => void;
  onCallSignal?: (senderId: string, payload: any) => void;
  onCallMediaState?: (participantId: string, isMuted: boolean, isCameraOff: boolean) => void;
  onP2PStreamSignal?: (senderId: string, payload: any) => void;
  onP2PStreamState?: (senderId: string, state: any) => void;
  onAudioEvent?: (event: RoomEvent) => void;
  onHostDisconnected?: (hostId: string, gracePeriodSeconds: number, reconnectDeadline: number) => void;
  onHostReconnected?: (hostId: string, hostName: string) => void;
  onTerminationPending?: (deadline: number, secondsRemaining: number) => void;
  onRoomTerminated?: (reason: string) => void;
  onParticipantRemoved?: (participantId: string, reason: string) => void;
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
  onP2PStreamSignal,
  onP2PStreamState,
  onAudioEvent,
  onHostDisconnected,
  onHostReconnected,
  onTerminationPending,
  onRoomTerminated,
  onParticipantRemoved,
}: UseRoomSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'kicked'
  >('connecting');

  // Callback ref stabilization to prevent infinite re-render reconnection loops
  const callbacksRef = useRef({
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
    onP2PStreamSignal,
    onP2PStreamState,
    onAudioEvent,
    onHostDisconnected,
    onHostReconnected,
    onTerminationPending,
    onRoomTerminated,
    onParticipantRemoved,
  });

  useEffect(() => {
    callbacksRef.current = {
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
      onP2PStreamSignal,
      onP2PStreamState,
      onAudioEvent,
      onHostDisconnected,
      onHostReconnected,
      onTerminationPending,
      onRoomTerminated,
      onParticipantRemoved,
    };
  });

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
  const [callMode, setCallMode] = useState<'audio' | 'video' | null>('video');
  const [callParticipants, setCallParticipants] = useState<string[]>([]);
  const [callHostName, setCallHostName] = useState<string>('');
  const reconnectAttemptsRef = useRef(0);
  const lastChatTimestampRef = useRef<number>(0);
  const pollTimerRef = useRef<any>(null);
  const isPollingRef = useRef<boolean>(false);
  const consecutivePollFailuresRef = useRef<number>(0);

  // Synchronize playback state ref
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // HTTP Polling fallback function for Vercel Serverless
  const pollRoom = useCallback(async () => {
    if (!roomId || !token || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/poll?token=${encodeURIComponent(token)}&since=${lastChatTimestampRef.current}`
      );
      if (!res.ok) {
        if (res.status === 410) {
          setConnectionStatus('disconnected');
          callbacksRef.current.onRoomTerminated?.('The host has left the room. This session has been ended.');
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          return;
        }
        consecutivePollFailuresRef.current++;
        if (consecutivePollFailuresRef.current >= 3) {
          setConnectionStatus('reconnecting');
        }
        return;
      }
      const data = await res.json();
      if (data.isTerminated || data.status === 'terminated') {
        setConnectionStatus('disconnected');
        callbacksRef.current.onRoomTerminated?.(data.error || 'The host has left the room. This session has been ended.');
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        return;
      }
      if (data.isHostReconnecting) {
        callbacksRef.current.onTerminationPending?.(data.hostReconnectDeadline, data.secondsRemaining);
      }
      if (!data.success) return;

      // Mark status as connected since HTTP sync is actively running
      consecutivePollFailuresRef.current = 0;
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
        const mode = data.callMode || 'video';
        setCallMode(mode);
        if (data.isCallActive && !isCallActiveRef.current) {
          callbacksRef.current.onCallStarted?.(data.callHostName || 'Creator', data.callParticipants || [], mode);
        } else if (!data.isCallActive && isCallActiveRef.current) {
          callbacksRef.current.onCallEnded?.();
        }
        setIsCallActive(data.isCallActive);
      }
      if (Array.isArray(data.callParticipants)) setCallParticipants(data.callParticipants);
      if (data.callHostName) setCallHostName(data.callHostName);

      // WebRTC Signals
      if (Array.isArray(data.signals) && data.signals.length > 0) {
        for (const sig of data.signals) {
          if (sig.payload?.isP2PStream || sig.payload?.p2pStream) {
            callbacksRef.current.onP2PStreamSignal?.(sig.senderId, sig.payload);
          } else {
            callbacksRef.current.onCallSignal?.(sig.senderId, sig.payload);
          }
        }
      }

      // Chat Messages with deduplication and unread arrival
      if (Array.isArray(data.recentChat) && data.recentChat.length > 0) {
        setChatMessages((prev) => {
          const existingIds = new Set(
            prev.filter((m) => m.status !== 'failed').map((m) => m.id)
          );
          const newFromOther = data.recentChat.filter(
            (m: ChatMessage) => !existingIds.has(m.id)
          );
          if (newFromOther.length === 0) return prev;

          // Update latest timestamp cursor
          newFromOther.forEach((m: ChatMessage) => {
            lastChatTimestampRef.current = Math.max(lastChatTimestampRef.current, m.timestamp);
            callbacksRef.current.onNewChat?.(m);
          });

          // Retain failed messages while merging new ones
          const stable = prev.filter(
            (m) => !m.id.startsWith('temp_') || m.status === 'failed'
          );
          return [...stable, ...newFromOther];
        });
      }

      // Playback State Sync
      if (data.playback) {
        const sPb = data.playback;
        const cPb = playbackStateRef.current;

        // Video Change check
        if (sPb.videoId && cPb?.videoId && sPb.videoId !== cPb.videoId) {
          setMetadata((prev) =>
            prev
              ? { ...prev, videoId: sPb.videoId, title: data.metadata?.title || prev.title }
              : null
          );
          callbacksRef.current.onVideoChange?.(sPb.videoId, data.metadata?.title);
        }

        // Status change check
        if (sPb.status === 'playing' && cPb?.status !== 'playing') {
          callbacksRef.current.onPlaybackPlay?.(sPb.position, sPb.updatedAt, sPb.playbackRate || 1.0);
        } else if (sPb.status === 'paused' && cPb?.status === 'playing') {
          callbacksRef.current.onPlaybackPause?.(sPb.position, sPb.updatedAt);
        }

        setPlaybackState(sPb);
      }
    } catch {
      consecutivePollFailuresRef.current++;
      if (consecutivePollFailuresRef.current >= 3) {
        setConnectionStatus('reconnecting');
      }
    } finally {
      isPollingRef.current = false;
    }
  }, [roomId, token]);

  const connect = useCallback(() => {
    if (!roomId || !token) return;

    // Start polling immediately to ensure instant room state
    pollRoom();
    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(pollRoom, 2000);
    }

    // In production Vercel serverless environment (app.resonance.org.in or vercel.app),
    // native WebSockets are not supported by the platform.
    // HTTP polling provides 100% stable sync, so we keep status as 'connected'.
    const isServerless =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('resonance.org.in') ||
        window.location.hostname.includes('vercel.app'));

    if (isServerless) {
      setConnectionStatus('connected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:4000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/rooms/${roomId}/connect?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
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
            const { metadata, hostId, playback, participants, recentChat, queue, isCallActive, callParticipants, callMode: cMode } =
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
            if (cMode) setCallMode(cMode);
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
            callbacksRef.current.onPlaybackPlay?.(position, updatedAt, playbackRate || 1.0);
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
            callbacksRef.current.onPlaybackPause?.(position, updatedAt);
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
            callbacksRef.current.onPlaybackSeek?.(position, status);
            break;
          }

          case 'playback:rate': {
            const { playbackRate, position } = roomEvent.payload;
            setPlaybackState((prev) => ({
              videoId: prev?.videoId || '',
              status: prev?.status || 'playing',
              position: typeof position === 'number' ? position : prev?.position || 0,
              updatedAt: Date.now(),
              playbackRate: playbackRate || 1.0,
              sequence: prev?.sequence || 0,
              hostId: prev?.hostId || '',
            }));
            callbacksRef.current.onPlaybackRate?.(playbackRate, position);
            break;
          }

          case 'video:change': {
            const { videoId, title, position, status, provider } = roomEvent.payload;
            setPlaybackState((prev) =>
              prev
                ? { ...prev, videoId, provider: provider || prev.provider, position: position || 0, status: status || 'playing', updatedAt: Date.now() }
                : null
            );
            setMetadata((prev) => (prev ? { ...prev, videoId, videoProvider: provider || prev.videoProvider, title: title || prev.title } : null));
            callbacksRef.current.onVideoChange?.(videoId, title);
            break;
          }

          case 'chat:message': {
            const msg: ChatMessage = roomEvent.payload.message;
            setChatMessages((prev) => {
              const existing = prev.some((m) => m.id === msg.id);
              if (existing) return prev;
              return [...prev, { ...msg, status: 'sent' }];
            });
            lastChatTimestampRef.current = Math.max(lastChatTimestampRef.current, msg.timestamp);
            callbacksRef.current.onNewChat?.(msg);
            break;
          }

          case 'reaction:broadcast': {
            const reaction: Reaction = roomEvent.payload.reaction;
            setReactions((prev) => [...prev.slice(-19), reaction]);
            callbacksRef.current.onNewReaction?.(reaction);
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
            callbacksRef.current.onKicked?.(reason || 'You have been kicked by the host.');
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
            callbacksRef.current.onRoomClosed?.(roomEvent.payload.reason || 'Room closed');
            break;
          }

          case 'queue:sync': {
            setQueue(roomEvent.payload.queue || []);
            break;
          }

          case 'call:started': {
            const { hostName, callParticipants, callMode: cMode } = roomEvent.payload;
            const mode = cMode === 'audio' ? 'audio' : 'video';
            setIsCallActive(true);
            setCallMode(mode);
            setCallHostName(hostName || 'Creator');
            setCallParticipants(callParticipants || []);
            callbacksRef.current.onCallStarted?.(hostName, callParticipants || [], mode);
            break;
          }

          case 'call:ended': {
            setIsCallActive(false);
            setCallParticipants([]);
            setCallHostName('');
            setCallMode(null);
            callbacksRef.current.onCallEnded?.();
            break;
          }

          case 'call:participant_joined': {
            const { participantId, callParticipants: updatedList } = roomEvent.payload;
            setCallParticipants(updatedList || []);
            callbacksRef.current.onCallParticipantJoined?.(participantId, updatedList || []);
            break;
          }

          case 'call:participant_left': {
            const { participantId, callParticipants: updatedList } = roomEvent.payload;
            setCallParticipants(updatedList || []);
            callbacksRef.current.onCallParticipantLeft?.(participantId, updatedList || []);
            break;
          }

          case 'call:signal': {
            callbacksRef.current.onCallSignal?.(roomEvent.senderId, roomEvent.payload);
            break;
          }

          case 'p2p_stream:signal': {
            callbacksRef.current.onP2PStreamSignal?.(roomEvent.senderId, roomEvent.payload);
            break;
          }

          case 'p2p_stream:state': {
            callbacksRef.current.onP2PStreamState?.(roomEvent.senderId, roomEvent.payload);
            break;
          }

          case 'call:media-state': {
            const { participantId, isMuted, isCameraOff } = roomEvent.payload;
            callbacksRef.current.onCallMediaState?.(participantId, isMuted, isCameraOff);
            break;
          }

          case 'audio.call.start':
          case 'audio.call.join':
          case 'audio.call.leave':
          case 'audio.call.end':
          case 'audio.call.state':
          case 'audio.participant.joined':
          case 'audio.participant.left':
          case 'audio.participant.reconnecting':
          case 'audio.participant.muted':
          case 'audio.participant.unmuted':
          case 'audio.offer':
          case 'audio.answer':
          case 'audio.ice_candidate': {
            callbacksRef.current.onAudioEvent?.(roomEvent);
            break;
          }

          case 'room.host.disconnected': {
            const { hostId, gracePeriodSeconds, reconnectDeadline } = roomEvent.payload;
            callbacksRef.current.onHostDisconnected?.(hostId, gracePeriodSeconds, reconnectDeadline);
            break;
          }

          case 'room.host.reconnected': {
            const { hostId, hostName } = roomEvent.payload;
            callbacksRef.current.onHostReconnected?.(hostId, hostName);
            break;
          }

          case 'room.termination.pending': {
            const { deadline, secondsRemaining } = roomEvent.payload;
            callbacksRef.current.onTerminationPending?.(deadline, secondsRemaining);
            break;
          }

          case 'room.terminated': {
            setConnectionStatus('disconnected');
            callbacksRef.current.onRoomTerminated?.(roomEvent.payload.reason || 'The host has left the room. This session has been ended.');
            break;
          }

          case 'room.participant.removed': {
            const { participantId, reason } = roomEvent.payload;
            setParticipants((prev) => prev.filter((p) => p.id !== participantId));
            callbacksRef.current.onParticipantRemoved?.(participantId, reason);
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
        callbacksRef.current.onKicked?.('You have been kicked from this room.');
        return;
      }
      if (event.code === 4002) {
        setConnectionStatus('disconnected');
        callbacksRef.current.onRoomTerminated?.('The host has left the room. This session has been ended.');
        return;
      }
      // On connection drop, stay connected via HTTP polling fallback without flashing reconnecting
      setConnectionStatus('connected');
    };

    ws.onerror = () => {
      setConnectionStatus('connected');
    };
  }, [roomId, token, pollRoom]);

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
            videoId: payload.videoId || metadata?.videoId || playbackState?.videoId,
            provider: payload.provider || metadata?.videoProvider || playbackState?.provider,
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
            videoId: payload.videoId || metadata?.videoId || playbackState?.videoId,
            provider: payload.provider || metadata?.videoProvider || playbackState?.provider,
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
            videoId: payload.videoId || metadata?.videoId || playbackState?.videoId,
            provider: payload.provider || metadata?.videoProvider || playbackState?.provider,
          }),
        }).catch(() => {});
      } else if (type === 'video:change') {
        fetch(`/api/rooms/${roomId}/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, videoId: payload.videoId, title: payload.title, provider: payload.provider }),
        }).catch(() => {});
      } else if (type === 'call:start') {
        fetch(`/api/rooms/${roomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'start', mode: payload.mode || 'video' }),
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
      } else if (type === 'p2p_stream:signal') {
        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            targetParticipantId: payload.targetParticipantId,
            payload: { ...payload, isP2PStream: true },
          }),
        }).catch(() => {});
      } else if (type === 'p2p_stream:state') {
        fetch(`/api/rooms/${roomId}/playback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            action: payload.action || 'play',
            position: payload.position ?? 0,
            playbackRate: payload.playbackRate ?? 1,
          }),
        }).catch(() => {});
      }
    },
    [roomId, token]
  );

  // Optimistic chat message sender with delivery status
  const emitChatMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const cleanText = text.trim();
      if (!cleanText) return false;
      const tempId = 'temp_' + Math.random().toString(36).substring(2, 9);
      const tempMsg: ChatMessage = {
        id: tempId,
        roomId,
        senderId: 'me',
        senderName: 'You',
        senderRole: 'guest',
        senderColor: '#6366f1',
        text: cleanText,
        timestamp: Date.now(),
        status: 'sending',
      };

      setChatMessages((prev) => [...prev, tempMsg]);

      try {
        const res = await fetch(`/api/rooms/${roomId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, text: cleanText }),
        });

        if (!res.ok) {
          throw new Error('Failed to send message');
        }

        const data = await res.json();
        if (data.success && data.message) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...data.message, status: 'sent' } : m))
          );
          lastChatTimestampRef.current = Math.max(
            lastChatTimestampRef.current,
            data.message.timestamp
          );
          return true;
        } else {
          throw new Error('Invalid response');
        }
      } catch {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
        return false;
      }
    },
    [roomId, token]
  );

  // Retry sending failed message
  const emitRetryMessage = useCallback(
    async (failedMsg: ChatMessage): Promise<boolean> => {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
      );
      try {
        const res = await fetch(`/api/rooms/${roomId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, text: failedMsg.text }),
        });
        if (!res.ok) throw new Error('Retry failed');
        const data = await res.json();
        if (data.success && data.message) {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === failedMsg.id ? { ...data.message, status: 'sent' } : m))
          );
          return true;
        }
        throw new Error('Invalid data');
      } catch {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
        );
        return false;
      }
    },
    [roomId, token]
  );

  const emitPlay = useCallback(
    (position: number) =>
      send('playback:play', {
        position,
        videoId: metadata?.videoId || playbackState?.videoId,
        provider: metadata?.videoProvider || playbackState?.provider,
      }),
    [send, metadata?.videoId, metadata?.videoProvider, playbackState?.videoId, playbackState?.provider]
  );
  const emitPause = useCallback(
    (position: number) =>
      send('playback:pause', {
        position,
        videoId: metadata?.videoId || playbackState?.videoId,
        provider: metadata?.videoProvider || playbackState?.provider,
      }),
    [send, metadata?.videoId, metadata?.videoProvider, playbackState?.videoId, playbackState?.provider]
  );
  const emitSeek = useCallback(
    (position: number) =>
      send('playback:seek', {
        position,
        videoId: metadata?.videoId || playbackState?.videoId,
        provider: metadata?.videoProvider || playbackState?.provider,
      }),
    [send, metadata?.videoId, metadata?.videoProvider, playbackState?.videoId, playbackState?.provider]
  );
  const emitRate = useCallback((playbackRate: number) => send('playback:rate', { playbackRate }), [send]);
  const emitVideoChange = useCallback(
    (videoId: string, title?: string, provider?: string) => send('video:change', { videoId, title, provider }),
    [send]
  );
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
  const emitToggleLock = useCallback(
    (isLocked: boolean, passcode?: string) => send('room:lock', { isLocked, passcode }),
    [send]
  );
  const emitAddToQueue = useCallback(
    (videoId: string, title: string, thumbnailUrl: string) =>
      send('queue:add', { videoId, title, thumbnailUrl }),
    [send]
  );
  const emitRemoveFromQueue = useCallback((itemId: string) => send('queue:remove', { itemId }), [send]);
  const emitPlayNextQueue = useCallback(() => send('queue:next', {}), [send]);

  // Video & Audio Call Emitters (Creator selects mode)
  const emitStartCall = useCallback(
    (mode: 'audio' | 'video' = 'video') => send('call:start', { mode }),
    [send]
  );
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

  // Direct WebRTC P2P Video Streaming Emitters (Host & Viewer)
  const emitP2PStreamSignal = useCallback(
    (targetParticipantId: string, signal: any) =>
      send('p2p_stream:signal', { targetParticipantId, ...signal }),
    [send]
  );
  const emitP2PStreamState = useCallback(
    (state: any) => send('p2p_stream:state', state),
    [send]
  );

  const emitAudioEvent = useCallback(
    (type: string, payload: any = {}) => {
      send(type, payload);
    },
    [send]
  );

  // Section 15: Room Termination and Leave Emitters
  const emitTerminateRoom = useCallback(
    (reason?: string) => {
      send('room:terminate', { reason });
      fetch(`/api/rooms/${roomId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      }).catch(() => {});
    },
    [roomId, token, send]
  );

  const emitLeaveRoom = useCallback(() => {
    send('room:leave', {});
    fetch(`/api/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [roomId, token, send]);

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
    callMode,
    callParticipants,
    callHostName,
    emitPlay,
    emitPause,
    emitSeek,
    emitRate,
    emitVideoChange,
    emitChatMessage,
    emitRetryMessage,
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
    emitP2PStreamSignal,
    emitP2PStreamState,
    emitAudioEvent,
    emitTerminateRoom,
    emitLeaveRoom,
  };
}
