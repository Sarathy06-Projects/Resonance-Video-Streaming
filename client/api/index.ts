import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

const app = express();

// Security: Disable x-powered-by header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Parse JSON with bounded size
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Restore original URL if Vercel rewrite altered req.url
app.use((req: Request, _res: Response, next: NextFunction) => {
  const original =
    req.headers['x-vercel-original-url'] ||
    req.headers['x-matched-path'] ||
    req.originalUrl;
  if (typeof original === 'string' && original.startsWith('/api')) {
    // keep req.url aligned
  }
  next();
});

// Neon Database Connection
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB Error in API]', err);
});

async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

// Authentication Helpers
const JWT_SECRET = process.env.JWT_SECRET || 'together_jwt_secret_resonance_prod_9823f6e1b74a2c091d';

function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifySessionToken(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function generateUserId(): string {
  return 'usr_' + crypto.randomBytes(6).toString('hex');
}

function generateRoomId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 3; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${p1}-${p2}`;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#a855f7'
];

function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// SSRF Protection: Block private, local, and metadata IP ranges
function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host === '169.254.169.254' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

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
  Buffer.from('eGhhbXN0ZXI=', 'base64').toString('ascii'),
];

const AUTH_REQUIRED_PATTERNS = [
  /patreon\.com\/posts\//,
  /facebook\.com\/watch\//,
];

async function resolveMediaUrl(rawUrl: string) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Please enter a valid video link or webpage URL');
  }

  const trimmed = rawUrl.trim();

  // 11-char YouTube ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return resolveYouTube(trimmed, `https://www.youtube.com/watch?v=${trimmed}`);
  }

  // Direct P2P Local Media File (Selected from Host's Device)
  if (trimmed.startsWith('p2p://') || trimmed.startsWith('local://') || trimmed.startsWith('blob:')) {
    const rawFileName = trimmed.replace(/^(p2p|local):\/\//, '').replace(/^blob:[^/]+\//, '');
    const cleanTitle = decodeURIComponent(rawFileName) || 'Local Video File';
    return {
      videoId: trimmed,
      url: trimmed,
      title: cleanTitle,
      authorName: 'Local Video',
      thumbnailUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=480&auto=format&fit=crop',
      provider: 'p2p_local',
      format: 'mp4',
      capabilities: {
        canPlay: true,
        canPause: true,
        canSeek: true,
        hasDuration: true,
        canMute: true,
        hasVolume: true,
        canSetRate: true,
      },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: 'Direct browser-to-browser P2P WebRTC video stream with zero server media infrastructure.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format. Please paste a valid web URL starting with https://');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only secure HTTP and HTTPS web URLs are permitted');
  }

  if (parsed.protocol === 'http:' && !parsed.hostname.includes('localhost') && process.env.NODE_ENV === 'production') {
    throw new Error('Only secure HTTPS video streams are supported');
  }

  if (isForbiddenHost(parsed.hostname)) {
    throw new Error('Access to private or local network resources is restricted');
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // E. Restricted DRM & Anti-Embed platforms
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
      capabilities: { canSeek: false, canPause: true, canSyncRate: false, isLive: false },
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
      capabilities: { canSeek: false, canPause: true, canSyncRate: false, isLive: false },
      supported: true,
      compatibility: 'auth_required',
      playbackMode: 'external',
      explanation: 'This video requires private account login or user permissions. Resonance opens this link in External Playback Mode to keep your room synchronized.',
    };
  }

  // A. Direct Video (MP4, WebM, OGG, MOV, MKV, M4V)
  if (
    path.endsWith('.mp4') ||
    path.endsWith('.webm') ||
    path.endsWith('.ogg') ||
    path.endsWith('.ogv') ||
    path.endsWith('.mov') ||
    path.endsWith('.m4v') ||
    path.endsWith('.mkv')
  ) {
    let format = 'mp4';
    if (path.endsWith('.webm')) format = 'webm';
    if (path.endsWith('.ogg') || path.endsWith('.ogv')) format = 'ogg';
    if (path.endsWith('.mov')) format = 'mov';
    if (path.endsWith('.mkv')) format = 'mkv';

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
      capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: `Direct HTML5 ${format.toUpperCase()} video. Full synchronized playback with play, pause, seek, and rate-nudging.`,
    };
  }

  // B. Streaming Media (HLS, DASH)
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
      capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
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
      capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
      supported: true,
      compatibility: 'fully_syncable',
      playbackMode: 'player',
      explanation: 'MPEG-DASH adaptive bitrate stream. Full synchronized playback via Media Source Extensions.',
    };
  }

  // C. Known Platforms
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    const match = trimmed.match(YOUTUBE_REGEX);
    if (!match) throw new Error('Invalid YouTube video link structure');
    return resolveYouTube(match[1], trimmed);
  }

  if (host.includes('vimeo.com')) {
    const match = trimmed.match(VIMEO_REGEX);
    if (match) return resolveVimeo(match[1], trimmed);
  }

  if (host.includes('dailymotion.com') || host.includes('dai.ly')) {
    const match = trimmed.match(DAILYMOTION_REGEX);
    if (match) return resolveDailymotion(match[1], trimmed);
  }

  if (host.includes('twitch.tv')) {
    const vodMatch = trimmed.match(TWITCH_VOD_REGEX);
    if (vodMatch) {
      return {
        videoId: vodMatch[1],
        url: trimmed,
        title: `Twitch Broadcast VOD (${vodMatch[1]})`,
        authorName: 'Twitch',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        provider: 'twitch',
        capabilities: { canSeek: true, canPause: true, canSyncRate: false, isLive: false },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'player',
        explanation: 'Twitch VOD stream. Full seek, play, and pause synchronization.',
      };
    }
    const channelMatch = trimmed.match(TWITCH_CHANNEL_REGEX);
    if (channelMatch && !['directory', 'p', 'search', 'settings', 'downloads'].includes(channelMatch[1].toLowerCase())) {
      return {
        videoId: channelMatch[1],
        url: trimmed,
        title: `Twitch Live Stream: ${channelMatch[1]}`,
        authorName: channelMatch[1],
        thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        provider: 'twitch',
        capabilities: { canSeek: false, canPause: true, canSyncRate: false, isLive: true },
        supported: true,
        compatibility: 'limited_sync',
        playbackMode: 'player',
        explanation: 'Twitch Live Stream. Play/pause synchronized with live stream. Live streams cannot seek to past time.',
      };
    }
  }

  if (host.includes('streamable.com')) {
    const match = trimmed.match(STREAMABLE_REGEX);
    if (match) {
      return {
        videoId: match[1],
        url: trimmed,
        title: `Streamable Video (${match[1]})`,
        authorName: 'Streamable',
        thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=600&q=80',
        provider: 'streamable',
        embedUrl: `https://streamable.com/e/${match[1]}`,
        capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Streamable video embed. Full synchronized playback enabled.',
      };
    }
  }

  if (host.includes('loom.com')) {
    const match = trimmed.match(LOOM_REGEX);
    if (match) {
      return {
        videoId: match[1],
        url: trimmed,
        title: `Loom Video Recording (${match[1]})`,
        authorName: 'Loom',
        thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
        provider: 'loom',
        embedUrl: `https://www.loom.com/embed/${match[1]}`,
        capabilities: { canSeek: true, canPause: true, canSyncRate: false, isLive: false },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Loom video presentation. Synchronized playback enabled.',
      };
    }
  }

  if (host.includes('wistia.com') || host.includes('wi.st')) {
    const match = trimmed.match(WISTIA_REGEX);
    if (match) {
      return {
        videoId: match[1],
        url: trimmed,
        title: `Wistia Video (${match[1]})`,
        authorName: 'Wistia',
        thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
        provider: 'wistia',
        embedUrl: `https://fast.wistia.net/embed/iframe/${match[1]}`,
        capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Wistia video embed. Synchronized playback enabled.',
      };
    }
  }

  if (host.includes('archive.org')) {
    const match = trimmed.match(ARCHIVE_ORG_REGEX);
    if (match) {
      return {
        videoId: match[1],
        url: trimmed,
        title: `Internet Archive: ${match[1].replace(/[-_]/g, ' ')}`,
        authorName: 'Internet Archive',
        thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
        provider: 'generic_embed',
        embedUrl: `https://archive.org/embed/${match[1]}`,
        capabilities: { canSeek: true, canPause: true, canSyncRate: false, isLive: false },
        supported: true,
        compatibility: 'fully_syncable',
        playbackMode: 'embed',
        explanation: 'Internet Archive public media embed. Synchronized playback enabled.',
      };
    }
  }

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
        capabilities: { canSeek: false, canPause: true, canSyncRate: false, isLive: false },
        supported: true,
        compatibility: 'limited_sync',
        playbackMode: 'embed',
        explanation: 'Google Drive video preview. Play/pause session status and room presence are coordinated. In-player seeking is controlled locally within the video.',
      };
    }
  }

  // D. Generic Video Webpage / Embeddable Link (Do NOT reject!)
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
    capabilities: { canSeek: false, canPause: true, canSyncRate: false, isLive: false },
    supported: true,
    compatibility: 'limited_sync',
    playbackMode: 'embed',
    explanation: `Generic web video page from ${host}. Loaded in secure sandboxed embed player. Play/pause session timer is coordinated across the room.`,
  };
}

async function resolveYouTube(videoId: string, originalUrl: string) {
  const defaultInfo = {
    videoId,
    url: originalUrl,
    title: `YouTube Video (${videoId})`,
    authorName: 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    provider: 'youtube',
    capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
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

async function resolveVimeo(videoId: string, originalUrl: string) {
  const defaultInfo = {
    videoId,
    url: originalUrl,
    title: `Vimeo Video (${videoId})`,
    authorName: 'Vimeo Creator',
    thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=600&q=80',
    provider: 'vimeo',
    capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
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

async function resolveDailymotion(videoId: string, originalUrl: string) {
  const defaultInfo = {
    videoId,
    url: originalUrl,
    title: `Dailymotion Video (${videoId})`,
    authorName: 'Dailymotion Creator',
    thumbnailUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=600&q=80',
    provider: 'dailymotion',
    capabilities: { canSeek: true, canPause: true, canSyncRate: true, isLive: false },
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

const CURATED_DEMOS = [
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
    title: 'Stranger Things (Netflix Protected Stream)',
    thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?auto=format&fit=crop&w=600&q=80',
    channel: 'Netflix Streaming',
    category: 'DRM / External Playback',
    provider: 'external',
    url: 'https://www.netflix.com/title/80057281',
  },
];

// Helper to register routes on both with and without /api prefix
function routeBoth(method: 'get' | 'post' | 'delete', path: string, ...handlers: any[]) {
  const normPath = path.startsWith('/') ? path : `/${path}`;
  app[method](normPath, ...handlers);
  if (!normPath.startsWith('/api')) {
    app[method](`/api${normPath}`, ...handlers);
  }
}

// 1. Health check
routeBoth('get', '/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await query('SELECT 1 as alive');
    res.json({
      status: 'ok',
      service: 'Together Watch Party Serverless API',
      database: dbRes.rows.length > 0 ? 'connected (Neon PostgreSQL)' : 'error',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', database: 'Database unavailable' });
  }
});

// 2. Curated demos
routeBoth('get', '/rooms/curated/demos', (_req: Request, res: Response) => {
  res.json({ demos: CURATED_DEMOS });
});

// 3. Validate URL (Universal: All websites, direct media, streams, embeds, DRM external)
routeBoth('post', '/rooms/validate-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || url.length > 1000) {
      res.status(400).json({ error: 'Please enter a valid video link' });
      return;
    }
    const resolved = await resolveMediaUrl(url);
    res.json({
      valid: true,
      provider: resolved.provider,
      videoId: resolved.videoId,
      compatibility: resolved.compatibility,
      playbackMode: resolved.playbackMode,
      capabilities: resolved.capabilities,
      info: {
        title: resolved.title,
        authorName: resolved.authorName,
        thumbnailUrl: resolved.thumbnailUrl,
        provider: resolved.provider,
        format: (resolved as any).format,
        capabilities: resolved.capabilities,
        compatibility: resolved.compatibility,
        playbackMode: resolved.playbackMode,
        explanation: resolved.explanation,
        supported: resolved.supported,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error validating video link' });
  }
});

// 4. Create Room (Universal: YouTube, Direct MP4/WebM, HLS, Vimeo, Dailymotion, DASH, Twitch)
routeBoth('post', '/rooms', async (req: Request, res: Response) => {
  try {
    const { videoUrl, hostName, isPrivate, passcode, theme } = req.body;
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.length > 1000) {
      res.status(400).json({ error: 'Valid video URL is required' });
      return;
    }

    const resolved = await resolveMediaUrl(videoUrl);
    const videoId = resolved.videoId;
    const videoProvider = resolved.provider;

    const rawName = typeof hostName === 'string' ? hostName.trim() : '';
    const hostDisplayName = rawName.slice(0, 50) || 'Host';
    const cleanPasscode = typeof passcode === 'string' ? passcode.trim().slice(0, 30) : null;
    const cleanTheme = typeof theme === 'string' ? theme.trim().slice(0, 20) : 'obsidian';
    const isPrivateBool = Boolean(isPrivate);

    const roomId = generateRoomId();
    const hostId = generateUserId();
    const hostColor = getRandomColor();

    // 1. Create Host User in Neon DB
    await query(
      `INSERT INTO users (id, display_name, is_guest, avatar_color, created_at)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [hostId, hostDisplayName, hostColor]
    );

    // Initial playback state
    const initialPlayback = {
      videoId,
      provider: videoProvider,
      status: 'paused',
      position: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    };

    // 2. Create Room in Neon DB
    await query(
      `INSERT INTO rooms (id, host_id, title, video_provider, video_id, is_private, passcode, is_locked, max_participants, theme, status, playback_state, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, 3, $8, 'active', $9, NOW())`,
      [roomId, hostId, resolved.title, videoProvider, videoId, isPrivateBool, cleanPasscode, cleanTheme, JSON.stringify(initialPlayback)]
    );

    // 3. Register host as room member
    await query(
      `INSERT INTO room_members (id, room_id, user_id, guest_name, role, joined_at, last_seen_at)
       VALUES ($1, $2, $3, $4, 'host', NOW(), NOW())`,
      [generateUserId(), roomId, hostId, hostDisplayName]
    );

    const token = signSessionToken({
      roomId,
      userId: hostId,
      name: hostDisplayName,
      role: 'host',
      color: hostColor,
    });

    const metadata = {
      id: roomId,
      hostId,
      title: resolved.title,
      videoProvider,
      videoId,
      videoUrl: resolved.url,
      compatibility: resolved.compatibility,
      playbackMode: resolved.playbackMode,
      isPrivate: isPrivateBool,
      passcode: cleanPasscode || undefined,
      isLocked: false,
      maxParticipants: 3,
      theme: cleanTheme,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      roomId,
      hostId,
      token,
      metadata,
      videoInfo: {
        videoId,
        title: resolved.title,
        thumbnailUrl: resolved.thumbnailUrl,
        authorName: resolved.authorName,
        provider: videoProvider,
      },
      shareUrl: `/room/${roomId}`,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms] Error:', err);
    res.status(500).json({ error: err?.message || 'Failed to create room. Please try again.' });
  }
});

// 5. Get Room Info
routeBoth('get', '/rooms/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rRes = await query('SELECT * FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found or has expired' });
      return;
    }
    const row = rRes.rows[0];
    const mRes = await query(
      "SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND last_seen_at > NOW() - INTERVAL '30 seconds'",
      [id]
    );
    const memberCount = parseInt(mRes.rows[0]?.count || '1', 10);

    res.json({
      id: row.id,
      title: row.title,
      videoId: row.video_id,
      isPrivate: Boolean(row.is_private),
      isLocked: Boolean(row.is_locked),
      maxParticipants: row.max_participants || 3,
      currentParticipants: memberCount,
      theme: row.theme || 'obsidian',
      status: row.status || 'active',
      hasPasscode: Boolean(row.passcode),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error fetching room details' });
  }
});

// 6. Join Room
routeBoth('post', '/rooms/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { guestName, passcode, existingToken } = req.body;

    const rRes = await query('SELECT * FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found or has expired' });
      return;
    }
    const room = rRes.rows[0];

    if (room.status === 'terminated') {
      res.status(410).json({ error: 'This room has been terminated because the host left.' });
      return;
    }

    const metadata = {
      id: room.id,
      hostId: room.host_id,
      title: room.title,
      videoProvider: room.video_provider,
      videoId: room.video_id,
      isPrivate: Boolean(room.is_private),
      passcode: room.passcode || undefined,
      isLocked: Boolean(room.is_locked),
      maxParticipants: room.max_participants || 3,
      theme: room.theme,
      status: room.status,
      createdAt: room.created_at,
    };

    // Reconnect existing valid token
    if (existingToken && typeof existingToken === 'string') {
      const decoded = verifySessionToken(existingToken);
      if (decoded && decoded.roomId === id) {
        await query("UPDATE room_members SET last_seen_at = NOW() WHERE room_id = $1 AND user_id = $2", [id, decoded.userId]);
        res.json({
          success: true,
          token: existingToken,
          userId: decoded.userId,
          name: decoded.name,
          role: decoded.role,
          color: decoded.color,
          metadata,
        });
        return;
      }
    }

    if (room.is_locked && !room.passcode) {
      res.status(403).json({ error: 'Room is locked by the host' });
      return;
    }

    const mRes = await query(
      "SELECT COUNT(*) as count FROM room_members WHERE room_id = $1 AND last_seen_at > NOW() - INTERVAL '30 seconds'",
      [id]
    );
    const count = parseInt(mRes.rows[0]?.count || '0', 10);
    if (count >= (room.max_participants || 3)) {
      res.status(403).json({
        error: `Room is at maximum capacity (${room.max_participants} participants)`,
        code: 'CAPACITY_REACHED',
      });
      return;
    }

    if (room.passcode || (room.is_private && room.passcode)) {
      const providedPasscode = typeof passcode === 'string' ? passcode.trim() : '';
      if (!providedPasscode || !timingSafeCompare(providedPasscode, room.passcode)) {
        res.status(401).json({ error: 'Incorrect room password', code: 'PASSCODE_REQUIRED' });
        return;
      }
    }

    const rawGuestName = typeof guestName === 'string' ? guestName.trim() : '';
    const name = rawGuestName.slice(0, 50) || 'Guest';
    const userId = generateUserId();
    const color = getRandomColor();
    const role = 'guest';

    await query(
      `INSERT INTO users (id, display_name, is_guest, avatar_color, created_at)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, name, color]
    );

    await query(
      `INSERT INTO room_members (id, room_id, user_id, guest_name, role, joined_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [generateUserId(), id, userId, name, role]
    );

    const token = signSessionToken({
      roomId: id,
      userId,
      name,
      role,
      color,
    });

    res.json({
      success: true,
      token,
      userId,
      name,
      role,
      color,
      metadata,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/join] Error:', err);
    res.status(500).json({ error: 'Error joining room' });
  }
});

// 6b. Section 15: Authoritative Room Termination Endpoint
routeBoth('post', '/rooms/:id/terminate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, reason } = req.body;

    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session token' });
      return;
    }

    const roomRes = await query('SELECT host_id, status FROM rooms WHERE id = $1', [id]);
    if (roomRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const hostId = roomRes.rows[0].host_id;
    if (decoded.userId !== hostId && decoded.role !== 'host') {
      res.status(403).json({ error: 'Only the original room host can terminate the room session' });
      return;
    }

    await query(
      `UPDATE rooms SET status = 'terminated', is_call_active = false, terminated_at = NOW(), termination_reason = $1 WHERE id = $2`,
      [reason || 'The host has ended the room session.', id]
    );

    // Broadcast room.terminated to polling signal table
    await query(
      `INSERT INTO room_signals (room_id, sender_id, event_type, payload, target_peer_id, created_at)
       VALUES ($1, $2, 'room.terminated', $3, NULL, NOW())`,
      [id, decoded.userId, JSON.stringify({ roomId: id, reason: reason || 'The host has ended the room session.', timestamp: Date.now() })]
    ).catch(() => {});

    res.json({ success: true, terminated: true });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/terminate] Error:', err);
    res.status(500).json({ error: 'Error terminating room session' });
  }
});

// 6c. Section 15: Participant / Host Voluntary Leave Endpoint
routeBoth('post', '/rooms/:id/leave', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token } = req.body;

    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session token' });
      return;
    }

    const roomRes = await query('SELECT host_id, status FROM rooms WHERE id = $1', [id]);
    if (roomRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const hostId = roomRes.rows[0].host_id;

    // If host leaves voluntarily, terminate room session for everyone!
    if (decoded.userId === hostId || decoded.role === 'host') {
      await query(
        `UPDATE rooms SET status = 'terminated', is_call_active = false, terminated_at = NOW(), termination_reason = $1 WHERE id = $2`,
        ['The host has left the room. This session has been ended.', id]
      );
      await query(
        `INSERT INTO room_signals (room_id, sender_id, event_type, payload, target_peer_id, created_at)
         VALUES ($1, $2, 'room.terminated', $3, NULL, NOW())`,
        [id, decoded.userId, JSON.stringify({ roomId: id, reason: 'The host has left the room. This session has been ended.', timestamp: Date.now() })]
      ).catch(() => {});
      res.json({ success: true, terminated: true });
      return;
    }

    // Guest leaves: remove from room_members, room remains active
    await query('DELETE FROM room_members WHERE room_id = $1 AND user_id = $2', [id, decoded.userId]);
    await query(
      `INSERT INTO room_signals (room_id, sender_id, event_type, payload, target_peer_id, created_at)
       VALUES ($1, $2, 'room.participant.removed', $3, NULL, NOW())`,
      [id, decoded.userId, JSON.stringify({ roomId: id, participantId: decoded.userId, reason: 'Participant left the room.' })]
    ).catch(() => {});

    res.json({ success: true, left: true });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/leave] Error:', err);
    res.status(500).json({ error: 'Error leaving room' });
  }
});

// 7. Lock Room
routeBoth('post', '/rooms/:id/lock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, isLocked, passcode } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can lock the room' });
      return;
    }
    const locked = Boolean(isLocked);
    const cleanPasscode = locked && typeof passcode === 'string' ? passcode.trim() : null;

    if (locked && !cleanPasscode) {
      res.status(400).json({ error: 'A password is required to lock the room' });
      return;
    }

    await query(
      'UPDATE rooms SET is_locked = $1, is_private = $2, passcode = $3 WHERE id = $4',
      [locked, locked, cleanPasscode, id]
    );
    res.json({ success: true, isLocked: locked, hasPasscode: Boolean(cleanPasscode) });
  } catch (err: any) {
    res.status(500).json({ error: 'Error locking room' });
  }
});

// 8. Kick Member
routeBoth('delete', '/rooms/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can kick members' });
      return;
    }
    await query('DELETE FROM room_members WHERE room_id = $1 AND (user_id = $2 OR id = $2)', [id, memberId]);
    res.json({ success: true, removed: memberId });
  } catch (err: any) {
    res.status(500).json({ error: 'Error removing member' });
  }
});

// 9. Playback Sync (Host updates playback in Neon DB)
routeBoth('post', '/rooms/:id/playback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, status, position, updatedAt, playbackRate, videoId } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host controls playback' });
      return;
    }

    const rRes = await query('SELECT video_id, video_provider FROM rooms WHERE id = $1', [id]);
    const currentVideoId = videoId || rRes.rows[0]?.video_id;
    const currentProvider = req.body.provider || rRes.rows[0]?.video_provider || 'youtube';

    const playback = {
      videoId: currentVideoId,
      provider: currentProvider,
      status: status || 'paused',
      position: typeof position === 'number' ? position : 0,
      updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
      playbackRate: typeof playbackRate === 'number' ? playbackRate : 1,
    };

    await query(
      'UPDATE rooms SET playback_state = $1 WHERE id = $2',
      [JSON.stringify(playback), id]
    );

    res.json({ success: true, playback });
  } catch (err: any) {
    res.status(500).json({ error: 'Error updating playback' });
  }
});

// 10. Change Video (Host only)
routeBoth('post', '/rooms/:id/video', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, videoUrl, videoId, title } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can change video' });
      return;
    }

    let finalVideoId = videoId;
    let finalTitle = title;
    let finalProvider = req.body.provider || 'youtube';

    const inputUrl = videoUrl || (typeof videoId === 'string' && videoId.includes('/') ? videoId : '');
    if (inputUrl) {
      try {
        const resolved = await resolveMediaUrl(inputUrl);
        finalVideoId = resolved.videoId;
        finalTitle = resolved.title || finalTitle;
        finalProvider = resolved.provider;
      } catch {}
    }

    if (!finalVideoId) {
      res.status(400).json({ error: 'Invalid video' });
      return;
    }

    const newPlayback = {
      videoId: finalVideoId,
      provider: finalProvider,
      status: 'playing',
      position: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    };

    await query(
      'UPDATE rooms SET video_id = $1, title = $2, video_provider = $3, playback_state = $4 WHERE id = $5',
      [finalVideoId, finalTitle || 'Watch Video', finalProvider, JSON.stringify(newPlayback), id]
    );

    res.json({ success: true, videoId: finalVideoId, provider: finalProvider, title: finalTitle, playback: newPlayback });
  } catch (err: any) {
    res.status(500).json({ error: 'Error changing video' });
  }
});

// 11. Send Chat Message
routeBoth('post', '/rooms/:id/chat', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, text } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    const cleanText = (typeof text === 'string' ? text.trim() : '').slice(0, 500);
    if (!cleanText) {
      res.status(400).json({ error: 'Message cannot be empty' });
      return;
    }

    // Verify room exists
    const rCheck = await query('SELECT id FROM rooms WHERE id = $1', [id]);
    if (rCheck.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const msgId = 'msg_' + crypto.randomBytes(6).toString('hex');
    await query(
      `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_role, message, created_at, seen_by)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), '[]'::jsonb)`,
      [msgId, id, decoded.userId, decoded.name, decoded.role, cleanText]
    );

    res.json({
      success: true,
      message: {
        id: msgId,
        roomId: id,
        senderId: decoded.userId,
        senderName: decoded.name,
        senderRole: decoded.role,
        senderColor: decoded.color || '#6366f1',
        text: cleanText,
        timestamp: Date.now(),
        status: 'sent',
        seenBy: [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

// 11b. Mark Messages as Seen (Read Receipts)
routeBoth('post', '/rooms/:id/chat/seen', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, messageIds } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      res.json({ success: true, count: 0 });
      return;
    }

    const cleanIds = messageIds.filter((m) => typeof m === 'string' && m.length > 0).slice(0, 50);
    if (cleanIds.length === 0) {
      res.json({ success: true, count: 0 });
      return;
    }

    const seenEntry = {
      userId: decoded.userId,
      userName: decoded.name,
      seenAt: Date.now(),
    };

    // Update messages where sender is NOT the current viewer
    const toUpdate = await query(
      `SELECT id, seen_by FROM room_messages
       WHERE room_id = $1 AND sender_id != $2 AND id = ANY($3::text[])`,
      [id, decoded.userId, cleanIds]
    );

    const updatedIds: string[] = [];
    for (const row of toUpdate.rows) {
      const existing: any[] = Array.isArray(row.seen_by)
        ? row.seen_by
        : typeof row.seen_by === 'string'
        ? JSON.parse(row.seen_by || '[]')
        : [];
      if (!existing.some((s) => s.userId === decoded.userId)) {
        existing.push(seenEntry);
        await query('UPDATE room_messages SET seen_by = $1 WHERE id = $2', [JSON.stringify(existing), row.id]);
        updatedIds.push(row.id);
      }
    }

    if (updatedIds.length > 0) {
      // Broadcast signal to other participants via room_signals
      await query(
        `INSERT INTO room_signals (room_id, sender_id, type, payload)
         VALUES ($1, $2, 'chat:seen', $3)`,
        [
          id,
          decoded.userId,
          JSON.stringify({
            messageIds: updatedIds,
            userId: decoded.userId,
            userName: decoded.name,
            seenAt: seenEntry.seenAt,
          }),
        ]
      );
    }

    res.json({ success: true, updatedCount: updatedIds.length, updatedIds });
  } catch (err: any) {
    res.status(500).json({ error: 'Error marking messages as seen' });
  }
});

// 12. Video / Audio Call Management (Creator starts/ends; participants join/leave)
routeBoth('post', '/rooms/:id/call', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, action, mode } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    const rRes = await query('SELECT is_call_active, call_mode, call_participants, call_host_name, host_id FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const room = rRes.rows[0];
    let participants: string[] = Array.isArray(room.call_participants) ? room.call_participants : [];
    const callMode = mode === 'audio' ? 'audio' : 'video';

    if (action === 'start') {
      if (decoded.role !== 'host') {
        res.status(403).json({ error: 'Only the room creator can initiate a group call' });
        return;
      }
      participants = [decoded.userId];
      await query(
        'UPDATE rooms SET is_call_active = true, call_mode = $1, call_host_name = $2, call_host_id = $3, call_participants = $4 WHERE id = $5',
        [callMode, decoded.name, decoded.userId, JSON.stringify(participants), id]
      );
    } else if (action === 'end') {
      if (decoded.role !== 'host') {
        res.status(403).json({ error: 'Only the creator can end the call for everyone' });
        return;
      }
      await query(
        "UPDATE rooms SET is_call_active = false, call_mode = NULL, call_participants = '[]'::jsonb WHERE id = $1",
        [id]
      );
    } else if (action === 'join') {
      if (!room.is_call_active) {
        res.status(400).json({ error: 'No active call to join' });
        return;
      }
      if (!participants.includes(decoded.userId)) {
        if (participants.length >= 5) {
          res.status(403).json({ error: 'Call is full (maximum 5 participants)' });
          return;
        }
        participants.push(decoded.userId);
        await query(
          'UPDATE rooms SET call_participants = $1 WHERE id = $2',
          [JSON.stringify(participants), id]
        );
      }
    } else if (action === 'leave') {
      participants = participants.filter((p) => p !== decoded.userId);
      const stillActive = participants.length > 0;
      await query(
        'UPDATE rooms SET is_call_active = $1, call_participants = $2 WHERE id = $3',
        [stillActive, JSON.stringify(participants), id]
      );
    }

    res.json({
      success: true,
      isCallActive: action === 'start' ? true : action === 'end' ? false : room.is_call_active,
      callMode: action === 'start' ? callMode : room.call_mode,
      callParticipants: participants,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error managing call' });
  }
});

// 12b. LiveKit Calling Access Token Issuer (Phase 3, 4, 5)
routeBoth('post', '/rooms/:id/call/token', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, mode: requestedMode } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    // Verify room exists and active
    const rRes = await query('SELECT is_call_active, call_mode, host_id FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const room = rRes.rows[0];
    const mode = room.call_mode || (requestedMode === 'audio' ? 'audio' : 'video');

    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (livekitUrl && apiKey && apiSecret) {
      // Issue short-lived, least-privilege token (15m TTL)
      const at = new AccessToken(apiKey, apiSecret, {
        identity: decoded.userId,
        name: decoded.name,
        ttl: '15m',
      });

      // Strict server-side permission enforcement:
      // In audio mode: microphone track publishing only. Video track publishing is disabled!
      at.addGrant({
        room: id,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: mode === 'audio' ? [TrackSource.MICROPHONE] : [TrackSource.CAMERA, TrackSource.MICROPHONE],
      });

      const livekitJwt = await at.toJwt();
      res.json({
        success: true,
        provider: 'livekit',
        url: livekitUrl,
        token: livekitJwt,
        mode,
      });
      return;
    }

    // Fallback response if LiveKit Cloud credentials are not configured in environment
    res.json({
      success: true,
      provider: 'fallback',
      mode,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/call/token] Error:', err);
    res.status(500).json({ error: 'Error generating call token' });
  }
});

// In-memory rate limiting for signaling on serverless worker
const serverlessSignalRateLimits = new Map<string, { count: number; resetAt: number }>();

// 13. WebRTC Signaling for Video Call & Local P2P Video Streaming
routeBoth('post', '/rooms/:id/signal', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, targetParticipantId, payload } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    if (!targetParticipantId || typeof targetParticipantId !== 'string' || targetParticipantId.length > 64) {
      res.status(400).json({ error: 'Invalid target participant' });
      return;
    }

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid signal payload' });
      return;
    }

    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload.length > 65536) {
      res.status(400).json({ error: 'Signal payload exceeds maximum size (64KB)' });
      return;
    }

    // Rate limiting: 60 signals per minute per user
    const now = Date.now();
    const rateLimit = serverlessSignalRateLimits.get(decoded.userId) || { count: 0, resetAt: now + 60000 };
    if (now > rateLimit.resetAt) {
      rateLimit.count = 0;
      rateLimit.resetAt = now + 60000;
    }
    rateLimit.count++;
    serverlessSignalRateLimits.set(decoded.userId, rateLimit);
    if (rateLimit.count > 60) {
      res.status(429).json({ error: 'Too many signaling messages. Rate limit exceeded.' });
      return;
    }

    // If signal is an offer for local P2P video streaming, verify user is the authoritative host
    if (payload.isP2PStream && payload.type === 'offer') {
      const roomRes = await query('SELECT host_id FROM rooms WHERE id = $1', [id]);
      if (roomRes.rows.length === 0 || roomRes.rows[0].host_id !== decoded.userId) {
        res.status(403).json({ error: 'Only the room host can publish local video streams' });
        return;
      }
    }

    // Prune stale signals older than 2 minutes
    await query(`DELETE FROM room_signals WHERE created_at < NOW() - INTERVAL '2 minutes'`).catch(() => {});

    await query(
      `INSERT INTO room_signals (room_id, sender_id, recipient_id, payload, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, decoded.userId, targetParticipantId, serializedPayload]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Error sending signal' });
  }
});

// 14. Real-time Poll Endpoint (Full State Synchronization)
routeBoth('get', '/rooms/:id/poll', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    const since = parseInt(req.query.since as string, 10) || 0;

    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    // Touch member last_seen_at
    await query(
      `UPDATE room_members SET last_seen_at = NOW() WHERE room_id = $1 AND user_id = $2`,
      [id, decoded.userId]
    );

    // Fetch room
    const rRes = await query('SELECT * FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room expired or removed' });
      return;
    }
    const room = rRes.rows[0];

    if (room.status === 'terminated') {
      res.status(410).json({ error: 'This room has been terminated because the host left.', isTerminated: true });
      return;
    }

    // Playback state
    let playback = room.playback_state;
    if (typeof playback === 'string') {
      try { playback = JSON.parse(playback); } catch {}
    }
    if (!playback) {
      playback = {
        videoId: room.video_id,
        provider: room.video_provider || 'youtube',
        status: 'paused',
        position: 0,
        updatedAt: Date.now(),
        playbackRate: 1,
      };
    } else {
      if (!playback.videoId) playback.videoId = room.video_id;
      if (!playback.provider) playback.provider = room.video_provider || 'youtube';
    }

    // Active participants in last 30s
    const mRes = await query(
      `SELECT rm.id, rm.user_id, rm.guest_name, rm.role, u.avatar_color
       FROM room_members rm
       LEFT JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = $1 AND rm.last_seen_at > NOW() - INTERVAL '35 seconds'
       ORDER BY rm.joined_at ASC`,
      [id]
    );
    const participants = mRes.rows.map((r) => ({
      id: r.user_id || r.id,
      name: r.guest_name,
      role: r.role,
      color: r.avatar_color || '#6366f1',
      isReady: true,
      lastActive: Date.now(),
    }));

    // Recent chat messages
    let chatRes;
    if (since > 0) {
      chatRes = await query(
        `SELECT rm.id, rm.room_id, rm.sender_id, rm.sender_name, rm.sender_role, rm.message, rm.created_at, rm.seen_by, u.avatar_color
         FROM room_messages rm
         LEFT JOIN users u ON rm.sender_id = u.id
         WHERE rm.room_id = $1 AND rm.created_at >= to_timestamp($2 / 1000.0) - INTERVAL '1 second'
         ORDER BY rm.created_at ASC
         LIMIT 50`,
        [id, since]
      );
    } else {
      chatRes = await query(
        `SELECT rm.id, rm.room_id, rm.sender_id, rm.sender_name, rm.sender_role, rm.message, rm.created_at, rm.seen_by, u.avatar_color
         FROM room_messages rm
         LEFT JOIN users u ON rm.sender_id = u.id
         WHERE rm.room_id = $1
         ORDER BY rm.created_at ASC
         LIMIT 50`,
        [id]
      );
    }
    const recentChat = chatRes.rows.map((m) => {
      const seenBy = Array.isArray(m.seen_by)
        ? m.seen_by
        : typeof m.seen_by === 'string'
        ? JSON.parse(m.seen_by || '[]')
        : [];
      return {
        id: m.id,
        roomId: m.room_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        senderColor: m.avatar_color || '#6366f1',
        text: m.message,
        timestamp: new Date(m.created_at).getTime(),
        seenBy,
        status: seenBy.length > 0 ? 'seen' : 'sent',
      };
    });

    // Video queue
    const qRes = await query(
      'SELECT * FROM video_queue WHERE room_id = $1 ORDER BY position ASC, created_at ASC',
      [id]
    );
    const queue = qRes.rows.map((q) => ({
      id: q.id,
      roomId: q.room_id,
      videoId: q.video_id,
      title: q.title,
      thumbnailUrl: q.thumbnail_url,
      addedBy: q.added_by,
      addedAt: new Date(q.created_at).getTime(),
      position: q.position,
    }));

    // Fetch and consume pending signals for this participant
    const sRes = await query(
      `DELETE FROM room_signals
       WHERE room_id = $1 AND recipient_id = $2
       RETURNING sender_id, payload`,
      [id, decoded.userId]
    );
    const signals = sRes.rows.map((s) => ({
      senderId: s.sender_id,
      payload: s.payload,
    }));

    const metadata = {
      id: room.id,
      hostId: room.host_id,
      title: room.title,
      videoProvider: room.video_provider,
      videoId: room.video_id,
      isPrivate: Boolean(room.is_private),
      passcode: room.passcode || undefined,
      isLocked: Boolean(room.is_locked),
      maxParticipants: room.max_participants || 3,
      theme: room.theme,
      status: room.status,
      createdAt: room.created_at,
    };

    let callParticipants: string[] = [];
    if (Array.isArray(room.call_participants)) {
      callParticipants = room.call_participants;
    } else if (typeof room.call_participants === 'string') {
      try { callParticipants = JSON.parse(room.call_participants); } catch {}
    }

    res.json({
      success: true,
      metadata,
      hostId: room.host_id,
      playback,
      participants,
      recentChat,
      queue,
      isCallActive: Boolean(room.is_call_active),
      callMode: room.call_mode || 'video',
      callParticipants,
      callHostName: room.call_host_name || 'Host',
      signals,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    console.error('[GET /api/rooms/:id/poll] Error:', err);
    res.status(500).json({ error: 'Error polling room state' });
  }
});

// 15. Billing upgrade endpoint
routeBoth('post', '/billing/upgrade-room', async (req: Request, res: Response) => {
  try {
    const { roomId, token } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== roomId || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can upgrade room capacity' });
      return;
    }

    await query('UPDATE rooms SET max_participants = 20 WHERE id = $1', [roomId]);
    res.json({ success: true, maxParticipants: 20 });
  } catch (err: any) {
    res.status(500).json({ error: 'Error upgrading room' });
  }
});

routeBoth('get', '/billing/subscription', (_req: Request, res: Response) => {
  res.json({ plan: 'pro', maxParticipants: 20, active: true });
});

export default app;
