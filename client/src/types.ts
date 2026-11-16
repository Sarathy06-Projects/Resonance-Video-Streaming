export type VideoProviderType =
  | 'youtube'
  | 'direct'
  | 'p2p_local'
  | 'hls'
  | 'vimeo'
  | 'dailymotion'
  | 'dash'
  | 'twitch'
  | 'streamable'
  | 'loom'
  | 'wistia'
  | 'gdrive'
  | 'generic_embed'
  | 'external';

export type CompatibilityStatus =
  | 'fully_syncable'
  | 'limited_sync'
  | 'external_only'
  | 'embedding_blocked'
  | 'auth_required'
  | 'unsupported';

export interface PlaybackCapabilities {
  canSeek: boolean;
  canPause: boolean;
  canSyncRate: boolean;
  isLive: boolean;
}

export type PlaybackStatus = 'playing' | 'paused' | 'ended';

export type PlaybackState = {
  videoId: string;
  provider?: string;
  compatibility?: CompatibilityStatus;
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

export type ChatSeenInfo = {
  userId: string;
  userName: string;
  seenAt: number;
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
  status?: 'sending' | 'sent' | 'failed' | 'seen';
  seenBy?: ChatSeenInfo[];
};

export type Reaction = {
  id: string;
  type: string;
  emoji: string;
  senderId: string;
  senderName: string;
  sentAt: number;
};

export type QueueItem = {
  id: string;
  roomId: string;
  videoId: string;
  provider?: string;
  title: string;
  thumbnailUrl: string;
  addedBy: string;
  addedAt: number;
  position: number;
};

export type RoomMetadata = {
  id: string;
  hostId: string;
  title: string;
  videoProvider: string;
  videoId: string;
  videoUrl?: string;
  compatibility?: CompatibilityStatus;
  playbackMode?: 'player' | 'embed' | 'external';
  isPrivate: boolean;
  passcode?: string;
  hasPasscode?: boolean;
  isLocked: boolean;
  maxParticipants: number;
  theme: string;
  status: 'active' | 'host_reconnecting' | 'terminating' | 'terminated' | 'ended';
  createdAt: string;
  expiresAt?: string;
  terminatedAt?: string;
  terminationReason?: string;
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
    | 'chat:seen'
    | 'reaction:send'
    | 'reaction:broadcast'
    | 'member:join'
    | 'member:joined'
    | 'member:leave'
    | 'member:left'
    | 'member:kick'
    | 'member:kicked'
    | 'host:transfer'
    | 'host:transferred'
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
    | 'audio.call.start'
    | 'audio.call.join'
    | 'audio.call.leave'
    | 'audio.call.end'
    | 'audio.participant.joined'
    | 'audio.participant.left'
    | 'audio.participant.reconnecting'
    | 'audio.offer'
    | 'audio.answer'
    | 'audio.ice_candidate'
    | 'audio.participant.muted'
    | 'audio.participant.unmuted'
    | 'audio.call.state'
    | 'room.host.disconnected'
    | 'room.host.reconnected'
    | 'room.termination.pending'
    | 'room.terminated'
    | 'room.participant.removed'
    | 'room:leave'
    | 'room:terminate'
    | 'p2p_stream:signal'
    | 'p2p_stream:state'
    | 'ping'
    | 'pong';
  senderId: string;
  sequence: number;
  sentAt: number;
  payload: Record<string, any>;
};
