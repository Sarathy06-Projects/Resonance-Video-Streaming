export type VideoProviderType =
  | 'youtube'
  | 'direct'
  | 'hls'
  | 'vimeo'
  | 'dailymotion'
  | 'dash'
  | 'twitch';

export interface PlayerCapabilities {
  canSeek: boolean;
  canPause: boolean;
  canSyncRate: boolean;
  isLive: boolean;
}

export interface ResolvedMediaInfo {
  videoId: string;
  url: string;
  title: string;
  authorName?: string;
  thumbnailUrl: string;
  provider: VideoProviderType;
  format?: string;
  capabilities: PlayerCapabilities;
  supported: boolean;
  reason?: string;
}

const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/)?|player\.vimeo\.com\/video\/)(\d+)/;
const DAILYMOTION_REGEX = /(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/;
const TWITCH_VOD_REGEX = /twitch\.tv\/videos\/(\d+)/;
const TWITCH_CHANNEL_REGEX = /twitch\.tv\/([a-zA-Z0-9_]{3,25})/;

export function detectProviderQuick(rawUrl: string): { provider: VideoProviderType; videoId: string } | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  // 11-char YouTube ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return { provider: 'youtube', videoId: trimmed };
  }

  const lower = trimmed.toLowerCase();

  // YouTube
  const ytMatch = trimmed.match(YOUTUBE_REGEX);
  if (ytMatch) {
    return { provider: 'youtube', videoId: ytMatch[1] };
  }

  // Direct MP4 / WebM
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return { provider: 'direct', videoId: trimmed };
  }

  // HLS
  if (lower.endsWith('.m3u8') || lower.includes('/hls/')) {
    return { provider: 'hls', videoId: trimmed };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(VIMEO_REGEX);
  if (vimeoMatch) {
    return { provider: 'vimeo', videoId: vimeoMatch[1] };
  }

  // Dailymotion
  const dmMatch = trimmed.match(DAILYMOTION_REGEX);
  if (dmMatch) {
    return { provider: 'dailymotion', videoId: dmMatch[1] };
  }

  // DASH
  if (lower.endsWith('.mpd') || lower.includes('/dash/')) {
    return { provider: 'dash', videoId: trimmed };
  }

  // Twitch
  const twVod = trimmed.match(TWITCH_VOD_REGEX);
  if (twVod) {
    return { provider: 'twitch', videoId: twVod[1] };
  }
  const twChan = trimmed.match(TWITCH_CHANNEL_REGEX);
  if (twChan && !['directory', 'p', 'search', 'settings', 'downloads'].includes(twChan[1].toLowerCase())) {
    return { provider: 'twitch', videoId: twChan[1] };
  }

  return null;
}

export const PROVIDER_META = {
  youtube: {
    name: 'YouTube',
    color: '#ff0000',
    badgeBg: 'bg-red-500/15 border-red-500/30 text-red-400',
    capabilitiesText: 'Full Sync: Play, Pause, Seek, Rate',
  },
  direct: {
    name: 'Direct MP4 / WebM',
    color: '#3b82f6',
    badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    capabilitiesText: 'Full Native Sync: Play, Pause, Seek, Rate',
  },
  hls: {
    name: 'HLS Stream (.m3u8)',
    color: '#10b981',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    capabilitiesText: 'Adaptive Sync: Play, Pause, Seek',
  },
  vimeo: {
    name: 'Vimeo',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    capabilitiesText: 'Full Sync: Play, Pause, Seek, Rate',
  },
  dailymotion: {
    name: 'Dailymotion',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    capabilitiesText: 'Full Sync: Play, Pause, Seek',
  },
  dash: {
    name: 'MPEG-DASH (.mpd)',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    capabilitiesText: 'Adaptive Sync: Play, Pause, Seek',
  },
  twitch: {
    name: 'Twitch',
    color: '#a855f7',
    badgeBg: 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400',
    capabilitiesText: 'Live Stream: Play, Pause',
  },
};
