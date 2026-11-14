import { URL } from 'url';

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

// SSRF Protection: Block private, local, and metadata IP ranges
function isForbiddenHost(hostname: string): boolean {
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

// Provider Regex Patterns
const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/|channels\/[^/]+\/)?|player\.vimeo\.com\/video\/)(\d+)/;
const DAILYMOTION_REGEX = /(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/;
const TWITCH_VOD_REGEX = /twitch\.tv\/videos\/(\d+)/;
const TWITCH_CHANNEL_REGEX = /twitch\.tv\/([a-zA-Z0-9_]{3,25})/;

export async function resolveMediaUrl(rawUrl: string): Promise<ResolvedMediaInfo> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please enter a valid video URL');
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
    throw new Error('Invalid URL format. Please paste a full https:// video link.');
  }

  // Security: Protocol enforcement
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only secure HTTPS URLs are permitted');
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

  // 1. YouTube
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    const match = trimmed.match(YOUTUBE_REGEX);
    if (!match) {
      throw new Error('Invalid or unsupported YouTube link structure');
    }
    return resolveYouTube(match[1], trimmed);
  }

  // 2. Direct MP4 / WebM
  if (path.endsWith('.mp4') || path.endsWith('.webm')) {
    const format = path.endsWith('.webm') ? 'webm' : 'mp4';
    const filename = parsed.pathname.split('/').pop() || `Direct ${format.toUpperCase()} Video`;
    const cleanTitle = decodeURIComponent(filename).replace(/[-_]/g, ' ').replace(/\.\w+$/, '');

    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle || `Direct ${format.toUpperCase()} Stream`,
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
    };
  }

  // 3. HLS (.m3u8)
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
    };
  }

  // 4. Vimeo
  if (host.includes('vimeo.com')) {
    const match = trimmed.match(VIMEO_REGEX);
    if (!match) {
      throw new Error('Unsupported Vimeo URL. Format: vimeo.com/123456789');
    }
    const videoId = match[1];
    return resolveVimeo(videoId, trimmed);
  }

  // 5. Dailymotion
  if (host.includes('dailymotion.com') || host.includes('dai.ly')) {
    const match = trimmed.match(DAILYMOTION_REGEX);
    if (!match) {
      throw new Error('Unsupported Dailymotion URL. Format: dailymotion.com/video/x...');
    }
    const videoId = match[1];
    return resolveDailymotion(videoId, trimmed);
  }

  // 6. DASH (.mpd)
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
    };
  }

  // 7. Twitch
  if (host.includes('twitch.tv')) {
    const vodMatch = trimmed.match(TWITCH_VOD_REGEX);
    if (vodMatch) {
      const videoId = vodMatch[1];
      return {
        videoId,
        url: trimmed,
        title: `Twitch Broadcast VOD (${videoId})`,
        authorName: 'Twitch Creator',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        provider: 'twitch',
        capabilities: {
          canSeek: true,
          canPause: true,
          canSyncRate: true,
          isLive: false,
        },
        supported: true,
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
      };
    }
  }

  throw new Error(
    'Unsupported video provider or media format. Resonance supports YouTube, Direct MP4/WebM, HLS (.m3u8), Vimeo, Dailymotion, DASH (.mpd), and Twitch.'
  );
}

// 1. YouTube Metadata Fetcher via oEmbed
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
      canSyncRate: true,
      isLive: false,
    },
    supported: true,
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

// Curated multi-provider demos for testing and quick starts
export const CURATED_DEMO_VIDEOS = [
  {
    videoId: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny (Official 4K 60fps)',
    channel: 'Blender Foundation',
    thumbnail: 'https://img.youtube.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    category: 'YouTube Animation',
    provider: 'youtube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    videoId: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny (Direct HTML5 MP4)',
    channel: 'Google Cloud Media',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    category: 'Direct MP4',
    provider: 'direct',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    videoId: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    title: 'Elephants Dream (Direct HTML5 MP4)',
    channel: 'Blender Institute',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
    category: 'Direct MP4',
    provider: 'direct',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    videoId: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    title: 'Big Buck Bunny HLS Adaptive Stream (.m3u8)',
    channel: 'Mux Video Test',
    thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
    category: 'HLS Stream',
    provider: 'hls',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    videoId: '76979871',
    title: 'The New Normal (Vimeo Official Embed)',
    channel: 'Vimeo Studios',
    thumbnail: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
    category: 'Vimeo',
    provider: 'vimeo',
    url: 'https://vimeo.com/76979871',
  },
  {
    videoId: 'x8n6f4s',
    title: 'Wild Nature (Dailymotion Embed)',
    channel: 'Dailymotion Featured',
    thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    category: 'Dailymotion',
    provider: 'dailymotion',
    url: 'https://www.dailymotion.com/video/x8n6f4s',
  },
  {
    videoId: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    title: 'Akamai DASH MPEG Manifest (.mpd)',
    channel: 'Akamai Test Streams',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    category: 'DASH Stream',
    provider: 'dash',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
  },
];
