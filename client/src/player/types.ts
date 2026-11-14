import { Reaction, VideoProviderType, CompatibilityStatus, PlaybackCapabilities, PlaybackState } from '../types';

export type { PlaybackCapabilities, CompatibilityStatus };
export type PlayerCapabilities = PlaybackCapabilities;

export type PlaybackMode = 'player' | 'embed' | 'external';

export interface AdapterCallbacks {
  onReady: () => void;
  onPlay: (pos: number) => void;
  onPause: (pos: number) => void;
  onSeek: (pos: number) => void;
  onEnded: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onBuffering: (isBuffering: boolean) => void;
  onError: (err: string) => void;
}

/**
 * Common playback provider interface requested in Resonance specifications
 */
export interface PlaybackProvider {
  load(url: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackState(): PlaybackState;
  getCapabilities(): PlaybackCapabilities;
  destroy(): void;
}

export interface PlayerAdapter {
  play: () => Promise<void> | void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setRate?: (rate: number) => void;
  setVolume: (volume: number) => void; // 0 to 100
  setMuted: (muted: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getCapabilities: () => PlaybackCapabilities;
  destroy: () => void;
}

export interface UniversalPlayerProps {
  videoId: string;
  provider?: VideoProviderType;
  videoUrl?: string;
  compatibility?: CompatibilityStatus;
  playbackMode?: PlaybackMode;
  isHost: boolean;
  hostName: string;
  authoritativePlayback: {
    status: 'playing' | 'paused' | 'ended';
    position: number;
    updatedAt: number;
    playbackRate: number;
  } | null;
  reactions: Reaction[];
  onTriggerReaction: (emoji: string, type: string) => void;
  onHostPlay: (pos: number) => void;
  onHostPause: (pos: number) => void;
  onHostSeek: (pos: number) => void;
  onHostRate: (rate: number) => void;
  onPlayNextQueue?: () => void;
  hasQueueItem?: boolean;
}
