import { Router, Request, Response } from 'express';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { roomManager } from '../room/manager';
import { resolveMediaUrl, CURATED_DEMO_VIDEOS } from '../utils/resolver';
import {
  generateUserId,
  getRandomColor,
  signSessionToken,
  verifySessionToken,
  timingSafeCompare,
} from '../utils/auth';
import { query } from '../db';

const router = Router();

// Validate Video URL preview across all supported providers
router.post('/validate-url', async (req: Request, res: Response) => {
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
      capabilities: resolved.capabilities,
      compatibility: resolved.compatibility,
      playbackMode: resolved.playbackMode,
      info: {
        title: resolved.title,
        authorName: resolved.authorName,
        thumbnailUrl: resolved.thumbnailUrl,
        provider: resolved.provider,
        format: resolved.format,
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

// Create Room (P0) — Supports YouTube, Direct MP4/WebM, HLS, Vimeo, Dailymotion, DASH, Twitch
router.post('/', async (req: Request, res: Response) => {
  try {
    const { videoUrl, hostName, isPrivate, passcode, theme } = req.body;

    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.length > 1000) {
      res.status(400).json({ error: 'Valid video URL is required' });
      return;
    }

    // Sanitize and bound host name
    const rawName = typeof hostName === 'string' ? hostName.trim() : '';
    const hostDisplayName = (rawName.slice(0, 50)) || 'Host';

    // Sanitize passcode if provided
    const cleanPasscode = typeof passcode === 'string' ? passcode.trim().slice(0, 30) : undefined;
    const cleanTheme = typeof theme === 'string' ? theme.trim().slice(0, 20) : 'obsidian';

    const { roomId, hostId, coordinator, videoInfo } = await roomManager.createRoom({
      videoUrl: videoUrl.trim(),
      hostName: hostDisplayName,
      isPrivate: Boolean(isPrivate),
      passcode: cleanPasscode,
      theme: cleanTheme,
    });

    const hostColor = getRandomColor();
    const token = signSessionToken({
      roomId,
      userId: hostId,
      name: hostDisplayName,
      role: 'host',
      color: hostColor,
    });

    res.status(201).json({
      success: true,
      roomId,
      hostId,
      token,
      metadata: coordinator.metadata,
      videoInfo,
      shareUrl: `/room/${roomId}`,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms] Error:', err);
    res.status(400).json({ error: err.message || 'Failed to create room with this video URL.' });
  }
});

// Fetch Room metadata and access rules (P0)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 30) {
      res.status(400).json({ error: 'Invalid room identifier' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);

    if (!coordinator) {
      res.status(404).json({ error: 'Room not found or has expired' });
      return;
    }

    const memberCount = coordinator.participants.size;
    res.json({
      id: coordinator.roomId,
      title: coordinator.metadata.title,
      videoId: coordinator.playbackState.videoId,
      isPrivate: coordinator.metadata.isPrivate,
      isLocked: coordinator.metadata.isLocked,
      maxParticipants: coordinator.metadata.maxParticipants,
      currentParticipants: memberCount,
      theme: coordinator.metadata.theme,
      status: coordinator.metadata.status,
      hasPasscode: Boolean(coordinator.metadata.passcode),
    });
  } catch (err: any) {
    console.error('[GET /api/rooms/:id] Error:', err);
    res.status(500).json({ error: 'Error fetching room details' });
  }
});

// Join Room and issue signed session (P0)
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { guestName, passcode, existingToken } = req.body;

    if (!id || typeof id !== 'string' || id.length > 30) {
      res.status(400).json({ error: 'Invalid room identifier' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found or has expired' });
      return;
    }

    // Check if client has existing valid token (reconnect)
    if (existingToken && typeof existingToken === 'string') {
      const decoded = verifySessionToken(existingToken);
      if (decoded && decoded.roomId === id) {
        res.json({
          success: true,
          token: existingToken,
          userId: decoded.userId,
          name: decoded.name,
          role: decoded.role,
          color: decoded.color,
          metadata: coordinator.metadata,
        });
        return;
      }
    }

    // Check room lock
    if (coordinator.metadata.isLocked) {
      res.status(403).json({ error: 'Room is locked by the host' });
      return;
    }

    // Check capacity
    if (coordinator.participants.size >= coordinator.metadata.maxParticipants) {
      res.status(403).json({
        error: `Room is at maximum capacity (${coordinator.metadata.maxParticipants} participants)`,
        code: 'CAPACITY_REACHED',
      });
      return;
    }

    // Check passcode if room is private (Constant-time comparison)
    if (coordinator.metadata.isPrivate && coordinator.metadata.passcode) {
      const providedPasscode = typeof passcode === 'string' ? passcode.trim() : '';
      if (!providedPasscode || !timingSafeCompare(providedPasscode, coordinator.metadata.passcode)) {
        res.status(401).json({ error: 'Incorrect room passcode', code: 'PASSCODE_REQUIRED' });
        return;
      }
    }

    const rawGuestName = typeof guestName === 'string' ? guestName.trim() : '';
    const name = (rawGuestName.slice(0, 50)) || 'Guest';
    const userId = generateUserId();
    const color = getRandomColor();
    const role = 'guest';

    // Persist user in Neon DB
    await query(
      `INSERT INTO users (id, display_name, is_guest, avatar_color, created_at)
       VALUES ($1, $2, true, $3, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, name, color]
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
      metadata: coordinator.metadata,
    });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/join] Error:', err);
    res.status(500).json({ error: 'Error joining room' });
  }
});

// Lock / Unlock Room
router.post('/:id/lock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, isLocked } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can lock the room' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    coordinator.metadata.isLocked = Boolean(isLocked);
    await query('UPDATE rooms SET is_locked = $1 WHERE id = $2', [coordinator.metadata.isLocked, id]);

    coordinator.broadcast({
      id: generateUserId(),
      roomId: id,
      type: 'room:lock',
      senderId: decoded.userId,
      sequence: coordinator.getNextSequence(),
      sentAt: Date.now(),
      payload: { isLocked: coordinator.metadata.isLocked },
    });

    res.json({ success: true, isLocked: coordinator.metadata.isLocked });
  } catch (err: any) {
    console.error('[POST /api/rooms/:id/lock] Error:', err);
    res.status(500).json({ error: 'Error locking room' });
  }
});

// Kick / Remove Member (P0)
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    const decoded = verifySessionToken(token);

    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can remove members' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    coordinator.handleEvent(decoded.userId, {
      id: generateUserId(),
      roomId: id,
      type: 'member:kick',
      senderId: decoded.userId,
      sequence: coordinator.getNextSequence(),
      sentAt: Date.now(),
      payload: { targetMemberId: memberId },
    });

    res.json({ success: true, removed: memberId });
  } catch (err: any) {
    console.error('[DELETE /api/rooms/:id/members] Error:', err);
    res.status(500).json({ error: 'Error removing member' });
  }
});

// Playback Sync Endpoint
router.post('/:id/playback', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, status, position, updatedAt, playbackRate, videoId } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host controls playback' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);
    if (coordinator) {
      coordinator.playbackState = {
        ...coordinator.playbackState,
        videoId: videoId || coordinator.playbackState.videoId,
        status: status || 'paused',
        position: typeof position === 'number' ? position : 0,
        updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
        playbackRate: typeof playbackRate === 'number' ? playbackRate : 1,
      };

      coordinator.broadcast({
        id: generateUserId(),
        roomId: id,
        type: status === 'playing' ? 'playback:play' : status === 'paused' ? 'playback:pause' : 'playback:seek',
        senderId: decoded.userId,
        sequence: coordinator.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          position: coordinator.playbackState.position,
          updatedAt: coordinator.playbackState.updatedAt,
          playbackRate: coordinator.playbackState.playbackRate,
          status: coordinator.playbackState.status,
        },
      });
    }

    const playback = {
      videoId: videoId || coordinator?.playbackState.videoId,
      provider: req.body.provider || coordinator?.playbackState.provider || coordinator?.metadata.videoProvider,
      status: status || 'paused',
      position: typeof position === 'number' ? position : 0,
      updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
      playbackRate: typeof playbackRate === 'number' ? playbackRate : 1,
    };

    await query('UPDATE rooms SET playback_state = $1 WHERE id = $2', [JSON.stringify(playback), id]);
    res.json({ success: true, playback });
  } catch (err: any) {
    res.status(500).json({ error: 'Error updating playback' });
  }
});

// Change Video Endpoint
router.post('/:id/video', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, videoUrl, videoId, title, provider: requestedProvider } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id || decoded.role !== 'host') {
      res.status(403).json({ error: 'Unauthorized: only host can change video' });
      return;
    }

    let finalVideoId = videoId;
    let finalTitle = title;
    let finalProvider = requestedProvider || 'youtube';

    if (videoUrl) {
      const resolved = await resolveMediaUrl(videoUrl);
      finalVideoId = resolved.videoId;
      finalTitle = resolved.title;
      finalProvider = resolved.provider;
    }

    if (!finalVideoId) {
      res.status(400).json({ error: 'Invalid video' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(id);
    if (coordinator) {
      coordinator.playbackState = {
        ...coordinator.playbackState,
        videoId: finalVideoId,
        provider: finalProvider,
        status: 'playing',
        position: 0,
        updatedAt: Date.now(),
        playbackRate: 1,
      };
      coordinator.metadata.videoId = finalVideoId;
      coordinator.metadata.videoProvider = finalProvider;
      coordinator.metadata.title = finalTitle || 'Video';
      coordinator.broadcast({
        id: generateUserId(),
        roomId: id,
        type: 'video:change',
        senderId: decoded.userId,
        sequence: coordinator.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          videoId: finalVideoId,
          provider: finalProvider,
          title: finalTitle,
          position: 0,
          status: 'playing',
        },
      });
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
      'UPDATE rooms SET video_provider = $1, video_id = $2, title = $3, playback_state = $4 WHERE id = $5',
      [finalProvider, finalVideoId, finalTitle || 'Video', JSON.stringify(newPlayback), id]
    );

    res.json({ success: true, provider: finalProvider, videoId: finalVideoId, title: finalTitle, playback: newPlayback });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error changing video' });
  }
});

// Send Chat Message Endpoint
router.post('/:id/chat', async (req: Request, res: Response) => {
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

    const coordinator = await roomManager.getCoordinator(id);
    const msgId = 'msg_' + generateUserId();
    const chatMsg = {
      id: msgId,
      roomId: id,
      senderId: decoded.userId,
      senderName: decoded.name,
      senderRole: decoded.role,
      senderColor: decoded.color || '#6366f1',
      text: cleanText,
      timestamp: Date.now(),
    };

    if (coordinator) {
      coordinator.chatHistory.push(chatMsg);
      coordinator.broadcast({
        id: generateUserId(),
        roomId: id,
        type: 'chat:message',
        senderId: decoded.userId,
        sequence: coordinator.getNextSequence(),
        sentAt: Date.now(),
        payload: { message: chatMsg },
      });
    }

    await query(
      `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_role, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [msgId, id, decoded.userId, decoded.name, decoded.role, cleanText]
    );

    res.json({ success: true, message: chatMsg });
  } catch (err: any) {
    res.status(500).json({ error: 'Error sending message' });
  }
});

// Manage Call Endpoint
router.post('/:id/call', async (req: Request, res: Response) => {
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

    const coordinator = await roomManager.getCoordinator(id);

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
      if (coordinator) {
        coordinator.isCallActive = true;
        coordinator.callParticipants = new Set([decoded.userId]);
        coordinator.broadcast({
          id: generateUserId(),
          roomId: id,
          type: 'call:started',
          senderId: decoded.userId,
          sequence: coordinator.getNextSequence(),
          sentAt: Date.now(),
          payload: { hostName: decoded.name, callMode, callParticipants: [decoded.userId] },
        });
      }
    } else if (action === 'end') {
      if (decoded.role !== 'host') {
        res.status(403).json({ error: 'Only the creator can end the call for everyone' });
        return;
      }
      await query("UPDATE rooms SET is_call_active = false, call_mode = NULL, call_participants = '[]'::jsonb WHERE id = $1", [id]);
      if (coordinator) {
        coordinator.isCallActive = false;
        coordinator.callParticipants.clear();
        coordinator.broadcast({
          id: generateUserId(),
          roomId: id,
          type: 'call:ended',
          senderId: decoded.userId,
          sequence: coordinator.getNextSequence(),
          sentAt: Date.now(),
          payload: {},
        });
      }
    } else if (action === 'join') {
      if (!room.is_call_active) {
        res.status(400).json({ error: 'No active call to join' });
        return;
      }
      if (!participants.includes(decoded.userId)) {
        participants.push(decoded.userId);
        await query('UPDATE rooms SET call_participants = $1 WHERE id = $2', [JSON.stringify(participants), id]);
      }
      if (coordinator) {
        coordinator.callParticipants.add(decoded.userId);
        coordinator.broadcast({
          id: generateUserId(),
          roomId: id,
          type: 'call:participant_joined',
          senderId: decoded.userId,
          sequence: coordinator.getNextSequence(),
          sentAt: Date.now(),
          payload: { participantId: decoded.userId, callParticipants: Array.from(coordinator.callParticipants) },
        });
      }
    } else if (action === 'leave') {
      participants = participants.filter((p) => p !== decoded.userId);
      const stillActive = participants.length > 0;
      await query('UPDATE rooms SET is_call_active = $1, call_participants = $2 WHERE id = $3', [stillActive, JSON.stringify(participants), id]);
      if (coordinator) {
        coordinator.callParticipants.delete(decoded.userId);
        if (!stillActive) {
          coordinator.isCallActive = false;
        }
        coordinator.broadcast({
          id: generateUserId(),
          roomId: id,
          type: 'call:participant_left',
          senderId: decoded.userId,
          sequence: coordinator.getNextSequence(),
          sentAt: Date.now(),
          payload: { participantId: decoded.userId, callParticipants: Array.from(coordinator.callParticipants) },
        });
      }
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

// LiveKit Token Issuer Endpoint (Phase 3, 4, 5)
router.post('/:id/call/token', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { token, mode: requestedMode } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    const rRes = await query('SELECT is_call_active, call_mode FROM rooms WHERE id = $1', [id]);
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
      const at = new AccessToken(apiKey, apiSecret, {
        identity: decoded.userId,
        name: decoded.name,
        ttl: '15m',
      });
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

    res.json({
      success: true,
      provider: 'fallback',
      mode,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error generating call token' });
  }
});

// Signal Exchange Endpoint
router.post('/:id/signal', async (req: Request, res: Response) => {
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

// Real-time Poll Endpoint
router.get('/:id/poll', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    const since = parseInt(req.query.since as string, 10) || 0;

    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== id) {
      res.status(401).json({ error: 'Unauthorized session' });
      return;
    }

    await query(
      'UPDATE room_members SET last_seen_at = NOW() WHERE room_id = $1 AND user_id = $2',
      [id, decoded.userId]
    );

    const coordinator = await roomManager.getCoordinator(id);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found or expired' });
      return;
    }

    const participants = Array.from(coordinator.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      color: p.color,
      joinedAt: p.joinedAt,
      lastActive: p.lastActive,
    }));

    const recentChat = coordinator.chatHistory.filter((m) => m.timestamp > since);

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

    const rModeRes = await query('SELECT call_mode FROM rooms WHERE id = $1', [id]);
    const callMode = rModeRes.rows[0]?.call_mode || 'video';

    res.json({
      success: true,
      metadata: coordinator.metadata,
      hostId: coordinator.metadata.hostId,
      playback: coordinator.playbackState,
      participants,
      recentChat,
      queue: coordinator.queue,
      isCallActive: coordinator.isCallActive,
      callMode,
      callParticipants: Array.from(coordinator.callParticipants),
      callHostName: coordinator.metadata.title,
      signals,
      serverTime: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error polling room state' });
  }
});

// Get curated demo rooms
router.get('/curated/demos', async (_req: Request, res: Response) => {
  res.json({ demos: CURATED_DEMO_VIDEOS });
});

export default router;
