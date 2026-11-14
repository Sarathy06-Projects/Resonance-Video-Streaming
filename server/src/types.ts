export type PlaybackStatus = 'playing' | 'paused' | 'ended';

export type PlaybackState = {
  videoId: string;
  status: PlaybackStatus;
  position: number;
  updatedAt: number;
  playbackRate: number;
  sequence: number;
  hostId: string;
};

export type Participant = {
  id: string;
  userId?: string;
  name: string;
  role: 'host' | 'guest';
  color: string;
  joinedAt: number;
  lastActive: number;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'host' | 'guest';
  senderColor: string;
  text: string;
  timestamp: number;
};

export type Reaction = {
  id: string;
  type: string; // 'heart' | 'laugh' | 'fire' | 'clap' | 'party' | 'wow'
  emoji: string;
  senderId: string;
  senderName: string;
  sentAt: number;
};

export type QueueItem = {
  id: string;
  roomId: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  addedBy: string;
  addedAt: number;
  position: number;
};

export type RoomEvent = {
  id: string;
  roomId: string;
  type:
    | 'room:join'
    | 'room:state'
    | 'playback:play'
    | 'playback:pause'
    | 'playback:seek'
    | 'playback:rate'
    | 'video:change'
    | 'chat:message'
    | 'reaction:send'
    | 'member:join'
    | 'member:leave'
    | 'member:kick'
    | 'host:transfer'
    | 'room:lock'
    | 'room:closed'
    | 'queue:add'
    | 'queue:remove'
    | 'queue:next'
    | 'queue:sync'
    | 'call:start'
    | 'call:end'
    | 'call:join'
    | 'call:leave'
    | 'call:signal'
    | 'call:media-state'
    | 'call:started'
    | 'call:ended'
    | 'call:participant_joined'
    | 'call:participant_left'
    | 'ping'
    | 'pong';
  senderId: string;
  sequence: number;
  sentAt: number;
  payload: Record<string, any>;
};

export type RoomMetadata = {
  id: string;
  hostId: string;
  title: string;
  videoProvider: string;
  videoId: string;
  isPrivate: boolean;
  passcode?: string;
  isLocked: boolean;
  maxParticipants: number;
  theme: string;
  status: 'active' | 'ended';
  createdAt: string;
  expiresAt?: string;
};
