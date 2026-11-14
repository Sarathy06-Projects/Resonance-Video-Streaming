import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { extractYouTubeId, isValidYouTubeUrl } from '../src/utils/youtube';
import { generateRoomId, signSessionToken, verifySessionToken } from '../src/utils/auth';
import { roomManager } from '../src/room/manager';
import { query, pool } from '../src/db';

describe('Together Watch Party - Core Engine Tests', () => {
  after(async () => {
    await pool.end();
  });

  it('correctly validates and extracts YouTube IDs from various formats', () => {
    assert.strictEqual(extractYouTubeId('https://www.youtube.com/watch?v=aqz-KE-bpKQ'), 'aqz-KE-bpKQ');
    assert.strictEqual(extractYouTubeId('https://youtu.be/jfKfPfyJRdk'), 'jfKfPfyJRdk');
    assert.strictEqual(extractYouTubeId('https://www.youtube.com/embed/e-ORhEE9VVg'), 'e-ORhEE9VVg');
    assert.strictEqual(extractYouTubeId('https://www.youtube.com/shorts/qC0vDKVPCrw'), 'qC0vDKVPCrw');
    assert.strictEqual(extractYouTubeId('aqz-KE-bpKQ'), 'aqz-KE-bpKQ');
    assert.strictEqual(extractYouTubeId('https://google.com'), null);
    assert.strictEqual(isValidYouTubeUrl('https://youtu.be/jfKfPfyJRdk'), true);
    assert.strictEqual(isValidYouTubeUrl('invalid-link'), false);
  });

  it('signs and verifies room session tokens correctly', () => {
    const token = signSessionToken({
      roomId: 'test1234',
      userId: 'usr_abc',
      name: 'Sarah',
      role: 'host',
      color: '#6366f1',
    });

    const decoded = verifySessionToken(token);
    assert.ok(decoded);
    assert.strictEqual(decoded.roomId, 'test1234');
    assert.strictEqual(decoded.name, 'Sarah');
    assert.strictEqual(decoded.role, 'host');
  });

  it('creates room in Neon DB and manages coordinator state', async () => {
    const { roomId, hostId, coordinator } = await roomManager.createRoom({
      videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      hostName: 'TestHost',
      isPrivate: false,
    });

    assert.ok(roomId);
    assert.ok(hostId);
    assert.strictEqual(coordinator.playbackState.videoId, 'aqz-KE-bpKQ');
    assert.strictEqual(coordinator.playbackState.status, 'paused');

    // Verify record in Neon PostgreSQL
    const res = await query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].id, roomId);
    assert.strictEqual(res.rows[0].video_id, 'aqz-KE-bpKQ');
    assert.strictEqual(res.rows[0].host_id, hostId);
  });
});
