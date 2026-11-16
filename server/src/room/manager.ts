import { RoomCoordinator } from './coordinator';
import { RoomMetadata, QueueItem } from '../types';
import { query } from '../db';
import { generateRoomId, generateUserId, getRandomColor } from '../utils/auth';
import { extractYouTubeId, fetchYouTubeMetadata } from '../utils/youtube';
import { resolveMediaUrl } from '../utils/resolver';

class RoomManager {
  private coordinators: Map<string, RoomCoordinator> = new Map();

  public async getCoordinator(roomId: string): Promise<RoomCoordinator | null> {
    // 1. Check in-memory active coordinator
    if (this.coordinators.has(roomId)) {
      return this.coordinators.get(roomId)!;
    }

    // 2. Otherwise load from Neon PostgreSQL
    const res = await query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const isLocal = row.video_provider === 'p2p_local' || row.video_provider === 'local' || (row.video_id && row.video_id.startsWith('local://'));
    const maxCapacity = row.max_participants || (isLocal ? 3 : 20);

    const metadata: RoomMetadata = {
      id: row.id,
      hostId: row.host_id,
      title: row.title || 'Together Watch Party',
      videoProvider: row.video_provider || 'youtube',
      videoId: row.video_id,
      isPrivate: Boolean(row.is_private),
      passcode: row.passcode || undefined,
      isLocked: Boolean(row.is_locked),
      maxParticipants: maxCapacity,
      theme: row.theme || 'obsidian',
      status: row.status || 'active',
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };

    const coordinator = new RoomCoordinator(metadata);

    // Load queue from Neon DB
    try {
      const qRes = await query(
        'SELECT * FROM video_queue WHERE room_id = $1 ORDER BY position ASC, created_at ASC',
        [roomId]
      );
      coordinator.queue = qRes.rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        videoId: r.video_id,
        title: r.title,
        thumbnailUrl: r.thumbnail_url,
        addedBy: r.added_by,
        addedAt: new Date(r.created_at).getTime(),
        position: r.position,
      }));
    } catch (e) {
      console.error('[RoomManager] Failed loading queue from DB', e);
    }

    // Load recent chat messages from Neon DB
    try {
      const chatRes = await query(
        'SELECT * FROM room_messages WHERE room_id = $1 ORDER BY created_at ASC LIMIT 50',
        [roomId]
      );
      coordinator.chatHistory = chatRes.rows.map((m) => ({
        id: m.id,
        roomId: m.room_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        senderColor: getRandomColor(),
        text: m.message,
        timestamp: new Date(m.created_at).getTime(),
      }));
    } catch (e) {
      console.error('[RoomManager] Failed loading chat from DB', e);
    }

    this.coordinators.set(roomId, coordinator);
    return coordinator;
  }

  public async createRoom(params: {
    videoUrl: string;
    hostName: string;
    isPrivate?: boolean;
    passcode?: string;
    theme?: string;
  }): Promise<{ roomId: string; hostId: string; coordinator: RoomCoordinator; videoInfo: any }> {
    const videoInfo = await resolveMediaUrl(params.videoUrl);
    const videoId = videoInfo.videoId;
    const provider = videoInfo.provider;
    const title = videoInfo.title;

    const roomId = generateRoomId();
    const hostId = generateUserId();
    const isPrivate = Boolean(params.isPrivate);
    const passcode = params.passcode ? String(params.passcode).trim() : null;
    const theme = params.theme || 'obsidian';

    // 1. Create or persist host in Neon DB
    await query(
      `INSERT INTO users (id, display_name, is_guest, avatar_color, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [hostId, params.hostName.trim() || 'Host', true, getRandomColor()]
    );

    const isLocalVideo = (provider as string) === 'p2p_local' || (provider as string) === 'local' || videoId.startsWith('local://');
    const roomCapacity = isLocalVideo ? 3 : 20;

    // 2. Persist room in Neon DB
    await query(
      `INSERT INTO rooms (id, host_id, title, video_provider, video_id, is_private, passcode, is_locked, max_participants, theme, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, 'active', NOW())`,
      [roomId, hostId, title, provider, videoId, isPrivate, passcode, roomCapacity, theme]
    );

    const metadata: RoomMetadata = {
      id: roomId,
      hostId,
      title,
      videoProvider: provider,
      videoId,
      videoUrl: videoInfo.url || params.videoUrl,
      compatibility: videoInfo.compatibility,
      playbackMode: videoInfo.playbackMode,
      isPrivate,
      passcode: passcode || undefined,
      isLocked: false,
      maxParticipants: roomCapacity,
      theme,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const coordinator = new RoomCoordinator(metadata);
    this.coordinators.set(roomId, coordinator);

    return { roomId, hostId, coordinator, videoInfo };
  }

  public removeCoordinator(roomId: string) {
    this.coordinators.delete(roomId);
  }
}

export const roomManager = new RoomManager();
