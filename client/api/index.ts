import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

// YouTube Utilities
function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /(?:youtube\.com\/shorts\/)([^"&?\/\s]{11})/i,
    /(?:youtube\.com\/live\/)([^"&?\/\s]{11})/i,
    /(?:tube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1] && match[1].length === 11) return match[1];
  }
  return null;
}

async function fetchYouTubeMetadata(videoId: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return {
        videoId,
        title: data.title || 'YouTube Video',
        authorName: data.author_name || 'YouTube Creator',
        thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {}
  return {
    videoId,
    title: 'YouTube Video',
    authorName: 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

const CURATED_DEMOS = [
  {
    id: 'demo-1',
    videoId: 'dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    channel: 'Rick Astley',
    genre: 'Music Video',
    category: 'music',
  },
  {
    id: 'demo-2',
    videoId: 'jNQXAC9IVRw',
    title: 'Me at the zoo (First YouTube Video Ever)',
    thumbnail: 'https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    channel: 'jawed',
    genre: 'Classic / History',
    category: 'vlog',
  },
  {
    id: 'demo-3',
    videoId: 'L_LUpnjgPso',
    title: 'Lofi Girl - Synthwave Radio / Beats to Chill / Game to',
    thumbnail: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg',
    channel: 'Lofi Girl',
    genre: 'Lofi / Ambience',
    category: 'chill',
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

// 3. Validate URL
routeBoth('post', '/rooms/validate-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || url.length > 500) {
      res.status(400).json({ error: 'Please enter a valid YouTube link' });
      return;
    }
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      res.status(400).json({
        error: 'Unsupported URL format. Please paste a standard YouTube video, Shorts, or watch link.',
      });
      return;
    }
    const info = await fetchYouTubeMetadata(videoId);
    res.json({ valid: true, videoId, info });
  } catch (err: any) {
    res.status(500).json({ error: 'Error validating URL' });
  }
});

// 4. Create Room
routeBoth('post', '/rooms', async (req: Request, res: Response) => {
  try {
    const { videoUrl, hostName, isPrivate, passcode, theme } = req.body;
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.length > 500) {
      res.status(400).json({ error: 'Valid YouTube URL is required' });
      return;
    }

    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      res.status(400).json({ error: 'Unsupported YouTube URL format' });
      return;
    }

    const rawName = typeof hostName === 'string' ? hostName.trim() : '';
    const hostDisplayName = rawName.slice(0, 50) || 'Host';
    const cleanPasscode = typeof passcode === 'string' ? passcode.trim().slice(0, 30) : null;
    const cleanTheme = typeof theme === 'string' ? theme.trim().slice(0, 20) : 'obsidian';
    const isPrivateBool = Boolean(isPrivate);

    const videoInfo = await fetchYouTubeMetadata(videoId);
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
      status: 'paused',
      position: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    };

    // 2. Create Room in Neon DB
    await query(
      `INSERT INTO rooms (id, host_id, title, video_provider, video_id, is_private, passcode, is_locked, max_participants, theme, status, playback_state, created_at)
       VALUES ($1, $2, $3, 'youtube', $4, $5, $6, false, 3, $7, 'active', $8, NOW())`,
      [roomId, hostId, videoInfo.title, videoId, isPrivateBool, cleanPasscode, cleanTheme, JSON.stringify(initialPlayback)]
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
      title: videoInfo.title,
      videoProvider: 'youtube',
      videoId,
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
      videoInfo,
      shareUrl: `/room/${roomId}`,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms] Error:', err);
    res.status(500).json({ error: 'Failed to create room. Please try again.' });
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

    if (room.is_locked) {
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

    if (room.is_private && room.passcode) {
      const providedPasscode = typeof passcode === 'string' ? passcode.trim() : '';
      if (!providedPasscode || !timingSafeCompare(providedPasscode, room.passcode)) {
        res.status(401).json({ error: 'Incorrect room passcode', code: 'PASSCODE_REQUIRED' });
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

// 7. Lock Room
routeBoth('post', '/rooms/:id/lock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, isLocked } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can lock the room' });
      return;
    }
    await query('UPDATE rooms SET is_locked = $1 WHERE id = $2', [Boolean(isLocked), id]);
    res.json({ success: true, isLocked: Boolean(isLocked) });
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

    const playback = {
      videoId: videoId || undefined,
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
    if (videoUrl) {
      const extracted = extractYouTubeId(videoUrl);
      if (extracted) {
        finalVideoId = extracted;
        const meta = await fetchYouTubeMetadata(extracted);
        finalTitle = meta.title;
      }
    }

    if (!finalVideoId) {
      res.status(400).json({ error: 'Invalid video' });
      return;
    }

    const newPlayback = {
      videoId: finalVideoId,
      status: 'playing',
      position: 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    };

    await query(
      'UPDATE rooms SET video_id = $1, title = $2, playback_state = $3 WHERE id = $4',
      [finalVideoId, finalTitle || 'YouTube Video', JSON.stringify(newPlayback), id]
    );

    res.json({ success: true, videoId: finalVideoId, title: finalTitle, playback: newPlayback });
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

    const msgId = 'msg_' + crypto.randomBytes(6).toString('hex');
    await query(
      `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_role, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

// 12. Video Call Management (Host starts/ends; participants join/leave)
routeBoth('post', '/rooms/:id/call', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, action } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    const rRes = await query('SELECT is_call_active, call_participants, call_host_name, host_id FROM rooms WHERE id = $1', [id]);
    if (rRes.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const room = rRes.rows[0];
    let participants: string[] = Array.isArray(room.call_participants) ? room.call_participants : [];

    if (action === 'start') {
      if (decoded.role !== 'host') {
        res.status(403).json({ error: 'Only host can start a group call' });
        return;
      }
      participants = [decoded.userId];
      await query(
        'UPDATE rooms SET is_call_active = true, call_host_name = $1, call_participants = $2 WHERE id = $3',
        [decoded.name, JSON.stringify(participants), id]
      );
    } else if (action === 'end') {
      if (decoded.role !== 'host') {
        res.status(403).json({ error: 'Only host can end a group call' });
        return;
      }
      await query(
        'UPDATE rooms SET is_call_active = false, call_participants = \'[]\'::jsonb WHERE id = $1',
        [id]
      );
    } else if (action === 'join') {
      if (!participants.includes(decoded.userId)) {
        participants.push(decoded.userId);
        await query(
          'UPDATE rooms SET call_participants = $1 WHERE id = $2',
          [JSON.stringify(participants), id]
        );
      }
    } else if (action === 'leave') {
      participants = participants.filter((p) => p !== decoded.userId);
      await query(
        'UPDATE rooms SET call_participants = $1 WHERE id = $2',
        [JSON.stringify(participants), id]
      );
    }

    res.json({ success: true, isCallActive: action === 'start' ? true : action === 'end' ? false : room.is_call_active, callParticipants: participants });
  } catch (err: any) {
    res.status(500).json({ error: 'Error managing call' });
  }
});

// 13. WebRTC Signaling for Video Call
routeBoth('post', '/rooms/:id/signal', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, targetParticipantId, payload } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    await query(
      `INSERT INTO room_signals (room_id, sender_id, recipient_id, payload, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, decoded.userId, targetParticipantId, JSON.stringify(payload)]
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

    // Playback state
    let playback = room.playback_state;
    if (typeof playback === 'string') {
      try { playback = JSON.parse(playback); } catch {}
    }
    if (!playback) {
      playback = {
        videoId: room.video_id,
        status: 'paused',
        position: 0,
        updatedAt: Date.now(),
        playbackRate: 1,
      };
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
    const sinceDate = new Date(since);
    const chatRes = await query(
      `SELECT rm.id, rm.room_id, rm.sender_id, rm.sender_name, rm.sender_role, rm.message, rm.created_at, u.avatar_color
       FROM room_messages rm
       LEFT JOIN users u ON rm.sender_id = u.id
       WHERE rm.room_id = $1 AND rm.created_at > $2
       ORDER BY rm.created_at ASC
       LIMIT 50`,
      [id, sinceDate]
    );
    const recentChat = chatRes.rows.map((m) => ({
      id: m.id,
      roomId: m.room_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderRole: m.sender_role,
      senderColor: m.avatar_color || '#6366f1',
      text: m.message,
      timestamp: new Date(m.created_at).getTime(),
    }));

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
