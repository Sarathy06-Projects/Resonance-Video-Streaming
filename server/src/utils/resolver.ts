import { URL } from 'url';
import {
  VideoProviderType,
  CompatibilityStatus,
  PlaybackCapabilities,
} from '../types';

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

// SSRF Protection: Block private, local, and metadata IP ranges
export function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '169.254.169.254' || // AWS / cloud instance metadata
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [_, b1, b2] = ipv4Match.map(Number);
    if (b1 === 10) return true;
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
    if (b1 === 192 && b2 === 168) return true;
    if (b1 === 169 && b2 === 254) return true;
    if (b1 === 127) return true;
  }

  return false;
}

// Regex patterns for known video platforms
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
  // Video tube sites enforcing X-Frame-Options: SAMEORIGIN & CSP frame-ancestors 'self'
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
  Buffer.from('eGhhbXN0ZXI=', 'base64').toString('ascii'),
];

// Authentication-dependent platforms
const AUTH_REQUIRED_PATTERNS = [
  /patreon\.com\/posts\//,
  /facebook\.com\/watch\//,
];

/**
 * Universal Source Resolver
 * Safely accepts any valid HTTP/HTTPS URL, classifies it into the optimal playback category,
 * and declares its true playback and synchronization capabilities.
 */
export async function resolveMediaUrl(rawUrl: string): Promise<ResolvedMediaInfo> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please enter a valid video link or webpage URL');
  }

  const trimmed = rawUrl.trim();

  // If already an 11-char YouTube ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return resolveYouTube(trimmed, `https://www.youtube.com/watch?v=${trimmed}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format. Please paste a valid web URL starting with https://');
  }

  // Security: Protocol enforcement
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only secure HTTP and HTTPS web URLs are permitted');
  }

  // Disallow insecure http in production
  if (parsed.protocol === 'http:' && !parsed.hostname.includes('localhost') && process.env.NODE_ENV === 'production') {
    throw new Error('Only secure HTTPS video streams are supported');
  }

  // Security: SSRF Protection
  if (isForbiddenHost(parsed.hostname)) {
    throw new Error('Access to private or local network resources is restricted');
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // =========================================================================
  // CATEGORY E: RESTRICTED SOURCES (DRM & BLOCKED EMBEDDING)
  // =========================================================================
  const isFrameBlocked = FRAME_BLOCKED_DOMAINS.some(
    (domain) => host.includes(domain) || (parsed.hostname + parsed.pathname).toLowerCase().includes(domain)
  );
  if (isFrameBlocked) {
    const matchedDomain = FRAME_BLOCKED_DOMAINS.find((d) => host.includes(d)) || host;
    const serviceName = matchedDomain.replace(/^www\./, '').split('.')[0].toUpperCase();
    const pathSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const cleanTitle = pathSegment ? decodeURIComponent(pathSegment).replace(/[-_]/g, ' ') : `${serviceName} Protected Video`;

    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle,
      authorName: host,
      thumbnailUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
      provider: 'external',
      capabilities: {
        canSeek: false,
        canPause: true,
        canSyncRate: false,
        isLive: false,
      },
      supported: true,
      compatibility: 'embedding_blocked',
      playbackMode: 'external',
      explanation: `${serviceName} enforces security policies (Widevine/FairPlay DRM, X-Frame-Options: SAMEORIGIN, or CSP frame-ancestors) that block third-party in-frame embedding. Resonance provides External Playback Mode with synchronized session controls and room chat.`,
    };
  }

  // Authentication Required check
  const isAuthRequired = AUTH_REQUIRED_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (isAuthRequired) {
    return {
      videoId: trimmed,
      url: trimmed,
      title: `Private Video (${host})`,
      authorName: host,
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
      provider: 'external',
      capabilities: {
        canSeek: false,
        canPause: true,
        canSyncRate: false,
        isLive: false,
      },
      supported: true,
      compatibility: 'auth_required',
      playbackMode: 'external',
      explanation: 'This video requires private account login or user permissions. Resonance opens this link in External Playback Mode to keep your room synchronized.',
    };
  }

  // =========================================================================
  // CATEGORY A: DIRECT VIDEO FILES (MP4, WEBM, OGG)
  // =========================================================================
  if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.ogg') || path.endsWith('.ogv')) {
    let format = 'mp4';
    if (path.endsWith('.webm')) format = 'webm';
    if (path.endsWith('.ogg') || path.endsWith('.ogv')) format = 'ogg';

    const filename = parsed.pathname.split('/').pop() || `Direct ${format.toUpperCase()} Video`;
    const cleanTitle = decodeURIComponent(filename).replace(/[-_]/g, ' ').replace(/\.\w+$/, '');

    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle || `Direct ${format.toUpperCase()} Video`,
      authorName: parsed.hostname,
      thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
      provider: 'direct',
      format,
      capabilities: {
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: `Direct HTML5 ${format.toUpperCase()} video. Full synchronized playback with play, pause, seek, and rate-nudging.`,
    };
  }

  // =========================================================================
  // CATEGORY B: STREAMING MEDIA (HLS .m3u8, MPEG-DASH .mpd)
  // =========================================================================
  if (path.endsWith('.m3u8') || path.includes('/hls/')) {
    const filename = parsed.pathname.split('/').pop() || 'HLS Live/VOD Stream';
    const cleanTitle = decodeURIComponent(filename).replace(/\.m3u8.*$/, '').replace(/[-_]/g, ' ');

    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle ? `HLS: ${cleanTitle}` : 'HLS Adaptive Video Stream',
      authorName: parsed.hostname,
      thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
      provider: 'hls',
      format: 'hls',
      capabilities: {
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: 'HLS adaptive bitrate video stream. Full synchronized playback with dynamic buffer recovery.',
    };
  }

  if (path.endsWith('.mpd') || path.includes('/dash/')) {
    const filename = parsed.pathname.split('/').pop() || 'DASH Stream';
    const cleanTitle = decodeURIComponent(filename).replace(/\.mpd.*$/, '').replace(/[-_]/g, ' ');

    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle ? `DASH: ${cleanTitle}` : 'MPEG-DASH Adaptive Stream',
      authorName: parsed.hostname,
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
      provider: 'dash',
      format: 'dash',
      capabilities: {
        canSeek: true,
        canPause: true,
        canSyncRate: true,
        isLive: false,
      },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: 'MPEG-DASH adaptive bitrate stream. Full synchronized playback via Media Source Extensions.',
    };
  }

  // =========================================================================
  // CATEGORY C: KNOWN VIDEO PLATFORMS WITH OFFICIAL APIS / EMBEDS
  // =========================================================================

  // 1. YouTube
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    const match = trimmed.match(YOUTUBE_REGEX);
    if (!match) {
      throw new Error('Invalid or unsupported YouTube link structure');
    }
    return resolveYouTube(match[1], trimmed);
  }

  // 2. Vimeo
  if (host.includes('vimeo.com')) {
    const match = trimmed.match(VIMEO_REGEX);
    if (match) {
      return resolveVimeo(match[1], trimmed);
    }
  }

  // 3. Dailymotion
  if (host.includes('dailymotion.com') || host.includes('dai.ly')) {
    const match = trimmed.match(DAILYMOTION_REGEX);
    if (match) {
      return resolveDailymotion(match[1], trimmed);
    }
  }

  // 4. Twitch (VOD vs Live)
  if (host.includes('twitch.tv')) {
    const vodMatch = trimmed.match(TWITCH_VOD_REGEX);
    if (vodMatch) {
      const vodId = vodMatch[1];
      return {
        videoId: vodId,
        url: trimmed,
        title: `Twitch VOD: #${vodId}`,
        authorName: 'Twitch',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        provider: 'twitch',
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: false,
          isLive: false,
        },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'player',
        explanation: 'Twitch VOD stream. Full seek, play, and pause synchronization.',
      };
    }

    const channelMatch = trimmed.match(TWITCH_CHANNEL_REGEX);
    if (channelMatch && !['directory', 'p', 'search', 'settings', 'downloads'].includes(channelMatch[1].toLowerCase())) {
      const channel = channelMatch[1];
      return {
        videoId: channel,
        url: trimmed,
        title: `Twitch Live Stream: ${channel}`,
        authorName: channel,
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        provider: 'twitch',
        capabilities: {
          canSeek: false, // Live streams cannot seek to arbitrary points
          canPause: true,
          canSyncRate: false,
          isLive: true,
        },
        supported: true,
        compatibility: 'limited_sync',
        playbackMode: 'player',
        explanation: 'Twitch Live Stream. Play/pause synchronized with live stream. Live streams cannot seek to past time.',
      };
    }
  }

  // 5. Streamable
  if (host.includes('streamable.com')) {
    const match = trimmed.match(STREAMABLE_REGEX);
    if (match) {
      const streamableId = match[1];
      return {
        videoId: streamableId,
        url: trimmed,
        title: `Streamable Video (${streamableId})`,
        authorName: 'Streamable',
        thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
        provider: 'streamable',
        embedUrl: `https://streamable.com/e/${streamableId}`,
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: true,
          isLive: false,
        },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Streamable video embed. Full synchronized playback enabled.',
      };
    }
  }

  // 6. Loom
  if (host.includes('loom.com')) {
    const match = trimmed.match(LOOM_REGEX);
    if (match) {
      const loomId = match[1];
      return {
        videoId: loomId,
        url: trimmed,
        title: `Loom Video Recording (${loomId})`,
        authorName: 'Loom Creator',
        thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
        provider: 'loom',
        embedUrl: `https://www.loom.com/embed/${loomId}`,
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: false,
          isLive: false,
        },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Loom video presentation. Synchronized playback enabled.',
      };
    }
  }

  // 7. Wistia
  if (host.includes('wistia.com') || host.includes('wi.st')) {
    const match = trimmed.match(WISTIA_REGEX);
    if (match) {
      const wistiaId = match[1];
      return {
        videoId: wistiaId,
        url: trimmed,
        title: `Wistia Video (${wistiaId})`,
        authorName: 'Wistia Creator',
        thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
        provider: 'wistia',
        embedUrl: `https://fast.wistia.net/embed/iframe/${wistiaId}`,
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: true,
          isLive: false,
        },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Wistia video embed. Synchronized playback enabled.',
      };
    }
  }

  // 8. Internet Archive
  if (host.includes('archive.org')) {
    const match = trimmed.match(ARCHIVE_ORG_REGEX);
    if (match) {
      const archiveId = match[1];
      return {
        videoId: archiveId,
        url: trimmed,
        title: `Internet Archive: ${archiveId.replace(/[-_]/g, ' ')}`,
        authorName: 'Internet Archive',
        thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
        provider: 'generic_embed',
        embedUrl: `https://archive.org/embed/${archiveId}`,
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: false,
          isLive: false,
        },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Internet Archive public media embed. Synchronized playback enabled.',
      };
    }
  }

  // 9. Google Drive Video
  if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
    const match = trimmed.match(GOOGLE_DRIVE_REGEX);
    if (match) {
      const fileId = match[1] || match[2];
      return {
        videoId: fileId,
        url: trimmed,
        title: `Google Drive Video (${fileId.slice(0, 8)}...)`,
        authorName: 'Google Drive',
        thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
        provider: 'gdrive',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        capabilities: {
          canSeek: false,
          canPause: true,
          canSyncRate: false,
          isLive: false,
        },
        supported: true,
        compatibility: 'limited_sync',
        playbackMode: 'embed',
        explanation: 'Google Drive video preview. Play/pause session status and room presence are coordinated. In-player seeking is controlled locally within the video.',
      };
    }
  }

  // =========================================================================
  // CATEGORY D: GENERIC VIDEO WEBPAGE / EMBEDDABLE LINK
  // =========================================================================
  // We do NOT reject the URL simply because it is an unknown domain!
  // It is classified as generic video webpage, loaded in secure sandboxed embed frame.
  const domainParts = host.replace(/^www\./, '').split('.');
  const siteName = domainParts.length > 1 ? domainParts[0].toUpperCase() : host;
  const pathSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
  const pageTitle = pathSegment ? decodeURIComponent(pathSegment).replace(/[-_]/g, ' ') : `${siteName} Video`;

  return {
    videoId: trimmed,
    url: trimmed,
    title: pageTitle,
    authorName: host,
    thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    provider: 'generic_embed',
    embedUrl: trimmed,
    capabilities: {
      canSeek: false,
      canPause: true,
      canSyncRate: false,
      isLive: false,
    },
    supported: true,
    compatibility: 'limited_sync',
    playbackMode: 'embed',
    explanation: `Generic web video page from ${host}. Loaded in secure sandboxed embed player. Play/pause session timer is coordinated across the room.`,
  };
}

// 1. YouTube Metadata Fetcher via official oEmbed
async function resolveYouTube(videoId: string, originalUrl: string): Promise<ResolvedMediaInfo> {
  const defaultInfo: ResolvedMediaInfo = {
    videoId,
    url: originalUrl,
    title: `YouTube Video (${videoId})`,
    authorName: 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    provider: 'youtube',
    capabilities: {
      canSeek: true,
      canPause: true,
      canSyncRate: true,
      isLive: false,
    },
    supported: true,
    compatibility: 'fully_syncable',
    playbackMode: 'player',
    explanation: 'YouTube official player API. Full synchronized playback with drift rate-nudging.',
  };

  try {
    const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.title) {
        defaultInfo.title = data.title;
        defaultInfo.authorName = data.author_name || 'YouTube Creator';
        if (data.thumbnail_url) defaultInfo.thumbnailUrl = data.thumbnail_url;
      }
    }
  } catch {}

  return defaultInfo;
}

// 2. Vimeo Metadata Fetcher via official oEmbed
async function resolveVimeo(videoId: string, originalUrl: string): Promise<ResolvedMediaInfo> {
  const defaultInfo: ResolvedMediaInfo = {
    videoId,
    url: originalUrl,
    title: `Vimeo Video (${videoId})`,
    authorName: 'Vimeo Creator',
    thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
    provider: 'vimeo',
    capabilities: {
      canSeek: true,
      canPause: true,
      canSyncRate: true,
      isLive: false,
    },
    supported: true,
    compatibility: 'fully_syncable',
    playbackMode: 'player',
    explanation: 'Vimeo player SDK. Full synchronized playback with variable rate correction.',
  };

  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${videoId}`)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.title) {
        defaultInfo.title = data.title;
        defaultInfo.authorName = data.author_name || 'Vimeo Creator';
        if (data.thumbnail_url) defaultInfo.thumbnailUrl = data.thumbnail_url;
      }
    }
  } catch {}

  return defaultInfo;
}

// 3. Dailymotion Metadata Fetcher via official oEmbed
async function resolveDailymotion(videoId: string, originalUrl: string): Promise<ResolvedMediaInfo> {
  const defaultInfo: ResolvedMediaInfo = {
    videoId,
    url: originalUrl,
    title: `Dailymotion Video (${videoId})`,
    authorName: 'Dailymotion Creator',
    thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    provider: 'dailymotion',
    capabilities: {
      canSeek: true,
      canPause: true,
      canSyncRate: false,
      isLive: false,
    },
    supported: true,
    compatibility: 'fully_syncable',
    playbackMode: 'player',
    explanation: 'Dailymotion official embed. Synchronized play, pause, and seek.',
  };

  try {
    const oembedUrl = `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(`https://www.dailymotion.com/video/${videoId}`)}`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.title) {
        defaultInfo.title = data.title;
        defaultInfo.authorName = data.author_name || 'Dailymotion Creator';
        if (data.thumbnail_url) defaultInfo.thumbnailUrl = data.thumbnail_url;
      }
    }
  } catch {}

  return defaultInfo;
}

export const CURATED_DEMO_VIDEOS = [
  {
    id: 'demo-1',
    videoId: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny (Official 4K 60fps)',
    thumbnail: 'https://img.youtube.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    channel: 'Blender Foundation',
    category: 'YouTube (Full Sync)',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    id: 'demo-2',
    videoId: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny (Direct HTML5 MP4)',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    channel: 'Google Cloud Media',
    category: 'Direct MP4 (Full Sync)',
    provider: 'direct',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id: 'demo-3',
    videoId: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    title: 'Big Buck Bunny HLS Adaptive Stream (.m3u8)',
    thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
    channel: 'Mux Video Test',
    category: 'HLS Stream (Full Sync)',
    provider: 'hls',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'demo-4',
    videoId: '76979871',
    title: 'The New Normal (Vimeo Official Embed)',
    thumbnail: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
    channel: 'Vimeo Studios',
    category: 'Vimeo (Full Sync)',
    provider: 'vimeo',
    url: 'https://vimeo.com/76979871',
  },
  {
    id: 'demo-5',
    videoId: 'https://archive.org/details/ElectraGlideInBlue_1973',
    title: 'Classic Film Archive (Public Domain)',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    channel: 'Internet Archive',
    category: 'Generic Embed (Sync)',
    provider: 'generic_embed',
    url: 'https://archive.org/details/ElectraGlideInBlue_1973',
  },
  {
    id: 'demo-6',
    videoId: 'https://www.netflix.com/title/80057281',
    title: 'Stranger Things (Netflix - DRM / External)',
    thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
    channel: 'Netflix Streaming',
    category: 'DRM / External Playback',
    provider: 'external',
    url: 'https://www.netflix.com/title/80057281',
  },
];
