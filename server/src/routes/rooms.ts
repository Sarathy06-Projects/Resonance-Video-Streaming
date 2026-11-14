import { Router, Request, Response } from 'express';
import { roomManager } from '../room/manager';
import {
  extractYouTubeId,
  fetchYouTubeMetadata,
  isValidYouTubeUrl,
  CURATED_DEMO_VIDEOS,
} from '../utils/youtube';
import {
  generateUserId,
  getRandomColor,
  signSessionToken,
  verifySessionToken,
} from '../utils/auth';
import { query } from '../db';

const router = Router();

// Validate YouTube URL preview
router.post('/validate-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
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
    res.status(500).json({ error: err.message || 'Error validating URL' });
  }
});

// Create Room (P0)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { videoUrl, hostName, isPrivate, passcode, theme } = req.body;

    if (!videoUrl || !isValidYouTubeUrl(videoUrl)) {
      res.status(400).json({ error: 'Valid YouTube URL is required' });
      return;
    }

    const hostDisplayName = (hostName && typeof hostName === 'string' && hostName.trim()) || 'Host';

    const { roomId, hostId, coordinator, videoInfo } = await roomManager.createRoom({
      videoUrl,
      hostName: hostDisplayName,
      isPrivate: Boolean(isPrivate),
      passcode,
      theme,
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
    res.status(500).json({ error: err.message || 'Failed to create room' });
  }
});

// Fetch Room metadata and access rules (P0)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
    res.status(500).json({ error: err.message || 'Error fetching room' });
  }
});

// Join Room and issue signed session (P0)
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { guestName, passcode, existingToken } = req.body;

    const coordinator = await roomManager.getCoordinator(id);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found or has expired' });
      return;
    }

    // Check if client has existing valid token (reconnect)
    if (existingToken) {
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

    // Check passcode if room is private
    if (coordinator.metadata.isPrivate && coordinator.metadata.passcode) {
      if (!passcode || passcode.trim() !== coordinator.metadata.passcode) {
        res.status(401).json({ error: 'Incorrect room passcode', code: 'PASSCODE_REQUIRED' });
        return;
      }
    }

    const name = (guestName && typeof guestName === 'string' && guestName.trim()) || 'Guest';
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
    res.status(500).json({ error: err.message || 'Error joining room' });
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
    res.status(500).json({ error: err.message || 'Error locking room' });
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
    res.status(500).json({ error: err.message || 'Error removing member' });
  }
});

// Get curated demo rooms
router.get('/curated/demos', async (_req: Request, res: Response) => {
  res.json({ demos: CURATED_DEMO_VIDEOS });
});

export default router;
