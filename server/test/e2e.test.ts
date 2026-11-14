process.env.NODE_ENV = 'test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { WebSocket } from 'ws';
import { app, server } from '../src/index';
import { pool, query } from '../src/db';

const TEST_PORT = 4123;
let baseUrl: string;
let wsBaseUrl: string;

describe('Together Watch Party - End-to-End Test Suite with Neon DB', () => {
  let createdRoomId = '';
  let hostToken = '';
  let guestToken = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => {
        baseUrl = `http://localhost:${TEST_PORT}`;
        wsBaseUrl = `ws://localhost:${TEST_PORT}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      await pool.end();
    } catch (e) {}
    setTimeout(() => process.exit(0), 100);
  });

  it('1. Health check verifies Neon PostgreSQL database connection', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.database.includes('Neon PostgreSQL'));
  });

  it('2. POST /api/rooms creates room with YouTube video and saves to Neon DB', async () => {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        hostName: 'AliceHost',
        isPrivate: false,
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.roomId);
    assert.ok(data.token);
    assert.strictEqual(data.metadata.videoId, 'aqz-KE-bpKQ');

    createdRoomId = data.roomId;
    hostToken = data.token;

    // Verify record in Neon PostgreSQL table 'rooms'
    const dbRes = await query('SELECT * FROM rooms WHERE id = $1', [createdRoomId]);
    assert.strictEqual(dbRes.rows.length, 1);
    assert.strictEqual(dbRes.rows[0].video_id, 'aqz-KE-bpKQ');
  });

  it('3. GET /api/rooms/:id retrieves room details', async () => {
    const res = await fetch(`${baseUrl}/api/rooms/${createdRoomId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, createdRoomId);
    assert.strictEqual(data.videoId, 'aqz-KE-bpKQ');
    assert.strictEqual(data.isLocked, false);
    assert.strictEqual(data.maxParticipants, 3);
  });

  it('4. POST /api/rooms/:id/join allows a guest to join without registration', async () => {
    const res = await fetch(`${baseUrl}/api/rooms/${createdRoomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: 'BobViewer',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    assert.strictEqual(data.name, 'BobViewer');
    assert.strictEqual(data.role, 'guest');

    guestToken = data.token;

    // Verify user in Neon PostgreSQL table 'users'
    const userRes = await query('SELECT * FROM users WHERE id = $1', [data.userId]);
    assert.strictEqual(userRes.rows.length, 1);
    assert.strictEqual(userRes.rows[0].display_name, 'BobViewer');
  });

  it('5. Host and Guest connect via WebSocket and receive initial state', async () => {
    const hostWs = new WebSocket(`${wsBaseUrl}/api/rooms/${createdRoomId}/connect?token=${encodeURIComponent(hostToken)}`);
    const guestWs = new WebSocket(`${wsBaseUrl}/api/rooms/${createdRoomId}/connect?token=${encodeURIComponent(guestToken)}`);

    const hostReady = new Promise<any>((resolve) => {
      hostWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'room:state') resolve(ev);
      });
    });

    const guestReady = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'room:state') resolve(ev);
      });
    });

    const [hostState, guestState] = await Promise.all([hostReady, guestReady]);

    assert.strictEqual(hostState.payload.roomId, createdRoomId);
    assert.strictEqual(guestState.payload.roomId, createdRoomId);

    // 6. Test Host Play command broadcast to Guest
    const playReceivedPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'playback:play') resolve(ev);
      });
    });

    hostWs.send(
      JSON.stringify({
        type: 'playback:play',
        roomId: createdRoomId,
        sentAt: Date.now(),
        payload: { position: 42.5 },
      })
    );

    const playEvent = await playReceivedPromise;
    assert.strictEqual(playEvent.payload.position, 42.5);

    // 7. Test Chat Message from Guest to Room and verify Neon DB persistence
    const chatReceivedPromise = new Promise<any>((resolve) => {
      hostWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'chat:message') resolve(ev);
      });
    });

    guestWs.send(
      JSON.stringify({
        type: 'chat:message',
        roomId: createdRoomId,
        sentAt: Date.now(),
        payload: { text: 'Hey Alice! Watching together is awesome!' },
      })
    );

    const chatEvent = await chatReceivedPromise;
    assert.strictEqual(chatEvent.payload.message.text, 'Hey Alice! Watching together is awesome!');

    // Poll for async Neon DB write to complete across network
    let msgRes: any = { rows: [] };
    for (let i = 0; i < 15; i++) {
      msgRes = await query('SELECT * FROM room_messages WHERE room_id = $1', [createdRoomId]);
      if (msgRes.rows.length >= 1) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(msgRes.rows.length >= 1);
    assert.strictEqual(msgRes.rows[0].message, 'Hey Alice! Watching together is awesome!');

    // 8. Test Reactions broadcast
    const reactionReceivedPromise = new Promise<any>((resolve) => {
      hostWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'reaction:send') resolve(ev);
      });
    });

    guestWs.send(
      JSON.stringify({
        type: 'reaction:send',
        roomId: createdRoomId,
        sentAt: Date.now(),
        payload: { emoji: '🔥', type: 'fire' },
      })
    );

    const reactionEvent = await reactionReceivedPromise;
    assert.strictEqual(reactionEvent.payload.reaction.emoji, '🔥');

    hostWs.close();
    guestWs.close();
  });

  it('6. Host upgrades room to Premium (₹199) and expands capacity to 15 in Neon DB', async () => {
    const res = await fetch(`${baseUrl}/api/billing/upgrade-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: createdRoomId,
        token: hostToken,
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.maxParticipants, 15);

    // Verify Neon DB updated
    const roomCheck = await query('SELECT max_participants FROM rooms WHERE id = $1', [createdRoomId]);
    assert.strictEqual(roomCheck.rows[0].max_participants, 15);

    // Verify subscription record inserted in Neon DB
    const subCheck = await query('SELECT * FROM subscriptions WHERE plan = $1', ['premium']);
    assert.ok(subCheck.rows.length >= 1);
  });
});
