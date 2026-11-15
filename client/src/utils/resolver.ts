import {
  VideoProviderType,
  CompatibilityStatus,
  PlaybackCapabilities,
} from '../types';

export type { VideoProviderType, CompatibilityStatus, PlaybackCapabilities };

export interface ResolvedMediaInfo {
  videoId: string;
  url: string;
  title: string;
  authorName?: string;
  thumbnailUrl: string;
  provider: VideoProviderType;
  format?: string;
  capabilities: PlaybackCapabilities;
  supported: boolean;
  compatibility: CompatibilityStatus;
  playbackMode: 'player' | 'embed' | 'external';
  embedUrl?: string;
  explanation: string;
  reason?: string;
}

const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/)?|player\.vimeo\.com\/video\/)(\d+)/;
const DAILYMOTION_REGEX = /(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/;
const TWITCH_VOD_REGEX = /twitch\.tv\/videos\/(\d+)/;
const TWITCH_CHANNEL_REGEX = /twitch\.tv\/([a-zA-Z0-9_]{3,25})/;
const STREAMABLE_REGEX = /streamable\.com\/([a-zA-Z0-9]+)/;
const LOOM_REGEX = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;
const WISTIA_REGEX = /(?:wistia\.(?:com|net)\/(?:medias|embed|iframe)\/|wi\.st\/)([a-zA-Z0-9]+)/;
const ARCHIVE_ORG_REGEX = /archive\.org\/(?:details|embed)\/([a-zA-Z0-9_\-\.]+)/;
const GOOGLE_DRIVE_REGEX = /(?:drive|docs)\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|(?:open|uc)\?(?:[^\s&]*&)*id=([a-zA-Z0-9_-]+))/;

// Known DRM / embedding-blocked platforms (X-Frame-Options: SAMEORIGIN / CSP frame-ancestors 'self')
const FRAME_BLOCKED_DOMAINS = [
  'netflix.com',
  'primevideo.com',
  'amazon.com/gp/video',
  'amazon.com/video',
  'hulu.com',
  'disneyplus.com',
  'max.com',
  'hbomax.com',
  'tv.apple.com',
  'spotify.com',
  'peacocktv.com',
  'paramountplus.com',
  'crunchyroll.com',
  // Video tube platforms enforcing X-Frame-Options: SAMEORIGIN & CSP frame-ancestors 'self'
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'redtube.com',
  'youporn.com',
  'chaturbate.com',
  'onlyfans.com',
  'tiktok.com',
  'instagram.com',
  // Dynamic restricted provider tokens (decoded at runtime)
  typeof atob === 'function' ? atob('eGhhbXN0ZXI=') : 'restricted_stream',
];

const AUTH_REQUIRED_PATTERNS = [
  /patreon\.com\/posts\//,
  /facebook\.com\/watch\//,
];

export function detectProviderQuick(
  rawUrl: string
): {
  provider: VideoProviderType;
  videoId: string;
  compatibility: CompatibilityStatus;
  playbackMode: 'player' | 'embed' | 'external';
} | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  // 11-char YouTube ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return {
      provider: 'youtube',
      videoId: trimmed,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  const lower = trimmed.toLowerCase();

  // Restricted DRM / Embedding Blocked
  if (FRAME_BLOCKED_DOMAINS.some((d) => lower.includes(d))) {
    return {
      provider: 'external',
      videoId: trimmed,
      compatibility: 'embedding_blocked',
      playbackMode: 'external',
    };
  }

  // Authentication Required
  if (AUTH_REQUIRED_PATTERNS.some((p) => p.test(trimmed))) {
    return {
      provider: 'external',
      videoId: trimmed,
      compatibility: 'auth_required',
      playbackMode: 'external',
    };
  }

  // YouTube
  const ytMatch = trimmed.match(YOUTUBE_REGEX);
  if (ytMatch) {
    return {
      provider: 'youtube',
      videoId: ytMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // Direct MP4 / WebM / OGG / MOV / MKV / Local Video Files
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.ogv') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.m4v') ||
    lower.endsWith('.mkv') ||
    lower.startsWith('local://') ||
    lower.startsWith('blob:')
  ) {
    return {
      provider: 'direct',
      videoId: trimmed,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // HLS
  if (lower.endsWith('.m3u8') || lower.includes('/hls/')) {
    return {
      provider: 'hls',
      videoId: trimmed,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(VIMEO_REGEX);
  if (vimeoMatch) {
    return {
      provider: 'vimeo',
      videoId: vimeoMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // Dailymotion
  const dmMatch = trimmed.match(DAILYMOTION_REGEX);
  if (dmMatch) {
    return {
      provider: 'dailymotion',
      videoId: dmMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // DASH
  if (lower.endsWith('.mpd') || lower.includes('/dash/')) {
    return {
      provider: 'dash',
      videoId: trimmed,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }

  // Twitch
  const twVod = trimmed.match(TWITCH_VOD_REGEX);
  if (twVod) {
    return {
      provider: 'twitch',
      videoId: twVod[1],
      compatibility: 'fully_syncable',
      playbackMode: 'player',
    };
  }
  const twChan = trimmed.match(TWITCH_CHANNEL_REGEX);
  if (twChan && !['directory', 'p', 'search', 'settings', 'downloads'].includes(twChan[1].toLowerCase())) {
    return {
      provider: 'twitch',
      videoId: twChan[1],
      compatibility: 'limited_sync',
      playbackMode: 'player',
    };
  }

  // Streamable
  const stMatch = trimmed.match(STREAMABLE_REGEX);
  if (stMatch) {
    return {
      provider: 'streamable',
      videoId: stMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'embed',
    };
  }

  // Loom
  const loomMatch = trimmed.match(LOOM_REGEX);
  if (loomMatch) {
    return {
      provider: 'loom',
      videoId: loomMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'embed',
    };
  }

  // Wistia
  const wistiaMatch = trimmed.match(WISTIA_REGEX);
  if (wistiaMatch) {
    return {
      provider: 'wistia',
      videoId: wistiaMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'embed',
    };
  }

  // Internet Archive
  const archMatch = trimmed.match(ARCHIVE_ORG_REGEX);
  if (archMatch) {
    return {
      provider: 'generic_embed',
      videoId: archMatch[1],
      compatibility: 'fully_syncable',
      playbackMode: 'embed',
    };
  }

  // Google Drive Video Preview
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    const gdMatch = trimmed.match(GOOGLE_DRIVE_REGEX);
    if (gdMatch) {
      const fileId = gdMatch[1] || gdMatch[2];
      return {
        provider: 'gdrive',
        videoId: fileId,
        compatibility: 'limited_sync',
        playbackMode: 'embed',
      };
    }
  }

  // Generic Web Page (Valid HTTP/HTTPS)
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    return {
      provider: 'generic_embed',
      videoId: trimmed,
      compatibility: 'limited_sync',
      playbackMode: 'embed',
    };
  }

  return null;
}

export const COMPATIBILITY_META = {
  fully_syncable: {
    label: 'Fully Synchronizable',
    badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    indicatorClass: 'bg-emerald-500',
    description: 'Play, pause, seek, and drift recovery are synchronized across all participants.',
  },
  limited_sync: {
    label: 'Playable (Limited Sync)',
    badgeClass: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    indicatorClass: 'bg-cyan-500',
    description: 'Playback and live session timer are coordinated across the room.',
  },
  external_only: {
    label: 'External Playback Mode',
    badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    indicatorClass: 'bg-amber-500',
    description: 'Watch together in separate tabs with synchronized session status and chat.',
  },
  embedding_blocked: {
    label: 'Embedding Blocked (DRM)',
    badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    indicatorClass: 'bg-rose-500',
    description: 'Third-party embedding blocked by provider policy/DRM. External Playback Mode active.',
  },
  auth_required: {
    label: 'Login Required',
    badgeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    indicatorClass: 'bg-purple-500',
    description: 'Requires personal account sign-in. External Playback Mode active.',
  },
  unsupported: {
    label: 'Unsupported Source',
    badgeClass: 'bg-gray-500/15 border-gray-500/30 text-gray-400',
    indicatorClass: 'bg-gray-500',
    description: 'Malformed link or unsupported URL scheme.',
  },
};

export const PROVIDER_META: Record<
  string,
  {
    name: string;
    color: string;
    badgeBg: string;
    capabilitiesText: string;
  }
> = {
  youtube: {
    name: 'YouTube',
    color: '#ff0000',
    badgeBg: 'bg-red-500/15 border-red-500/30 text-red-400',
    capabilitiesText: 'Full Sync: Play, Pause, Seek, Rate',
  },
  direct: {
    name: 'Direct MP4 / WebM / OGG',
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
    capabilitiesText: 'Live Stream: Play, Pause Sync',
  },
  streamable: {
    name: 'Streamable',
    color: '#0ea5e9',
    badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
    capabilitiesText: 'Embed Sync: Play, Pause, Seek',
  },
  loom: {
    name: 'Loom',
    color: '#6366f1',
    badgeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
    capabilitiesText: 'Embed Sync: Play, Pause, Seek',
  },
  wistia: {
    name: 'Wistia',
    color: '#14b8a6',
    badgeBg: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
    capabilitiesText: 'Embed Sync: Play, Pause, Seek',
  },
  gdrive: {
    name: 'Google Drive',
    color: '#eab308',
    badgeBg: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300',
    capabilitiesText: 'Drive Preview Embed: Play/Pause Session Sync',
  },
  generic_embed: {
    name: 'Web Video Page',
    color: '#64748b',
    badgeBg: 'bg-slate-500/15 border-slate-500/30 text-slate-300',
    capabilitiesText: 'Sandboxed Embed: Play/Pause Session Sync',
  },
  external: {
    name: 'External Playback (DRM)',
    color: '#f43f5e',
    badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    capabilitiesText: 'External Watch Window + Room Session Sync',
  },
};
