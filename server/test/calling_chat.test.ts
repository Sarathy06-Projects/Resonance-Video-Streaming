import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { app } from '../src/index';
import { query } from '../src/db';
import { signSessionToken } from '../src/utils/auth';

describe('Resonance Realtime Features — Live Chat & Audio/Video Calling', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRoomId: string;
  let hostToken: string;
  let hostUserId: string;
  let guestToken: string;
  let guestUserId: string;

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    // 1. Create Room via API
    const roomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
        hostName: 'Alice Host',
      }),
    });
    const roomData = await roomRes.json();
    assert.strictEqual(roomRes.status, 201);
    testRoomId = roomData.roomId;
    hostToken = roomData.token;
    hostUserId = roomData.hostId;

    // 2. Join as Guest via API
    const joinRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: 'Bob Viewer' }),
    });
    const joinData = await joinRes.json();
    assert.strictEqual(joinRes.status, 200);
    guestToken = joinData.token;
    guestUserId = joinData.userId;
  });

  after(async () => {
    try {
      await query('DELETE FROM room_messages WHERE room_id = $1', [testRoomId]);
      await query('DELETE FROM room_members WHERE room_id = $1', [testRoomId]);
      await query('DELETE FROM rooms WHERE id = $1', [testRoomId]);
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setTimeout(() => process.exit(0), 100);
  });

  // ==========================================
  // PHASE 2: LIVE CHAT AUDIT & VERIFICATION
  // ==========================================
  describe('Phase 2 — Live Chat', () => {
    test('Rejects chat message with unauthorized or mismatched session token', async () => {
      const wrongToken = signSessionToken({
        roomId: 'some_other_room',
        userId: 'intruder',
        name: 'Intruder',
        role: 'guest',
        color: '#ff0000',
      });

      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: wrongToken, text: 'Hello unauthorized' }),
      });

      assert.strictEqual(res.status, 401);
    });

    test('Rejects empty or whitespace-only messages', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, text: '   ' }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Message cannot be empty');
    });

    test('Successfully sends and persists chat message with sender info and timestamp', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, text: 'Hello everyone in Resonance!' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.message.id);
      assert.strictEqual(data.message.roomId, testRoomId);
      assert.strictEqual(data.message.senderId, hostUserId);
      assert.strictEqual(data.message.senderName, 'Alice Host');
      assert.strictEqual(data.message.senderRole, 'host');
      assert.strictEqual(data.message.text, 'Hello everyone in Resonance!');
      assert.ok(typeof data.message.timestamp === 'number');

      // Verify in Neon DB
      const dbRes = await query('SELECT * FROM room_messages WHERE room_id = $1', [testRoomId]);
      assert.strictEqual(dbRes.rows.length, 1);
      assert.strictEqual(dbRes.rows[0].message, 'Hello everyone in Resonance!');
    });

    test('Retrieves chat messages accurately via polling without message loss', async () => {
      // Guest sends a message
      await fetch(`${baseUrl}/api/rooms/${testRoomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, text: 'Hey Alice! Watching along.' }),
      });

      const pollRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/poll?since=0&token=${guestToken}`);
      assert.strictEqual(pollRes.status, 200);
      const pollData = await pollRes.json();

      assert.ok(Array.isArray(pollData.recentChat));
      assert.strictEqual(pollData.recentChat.length, 2);
      assert.strictEqual(pollData.recentChat[0].text, 'Hello everyone in Resonance!');
      assert.strictEqual(pollData.recentChat[1].text, 'Hey Alice! Watching along.');
    });
  });

  // ==========================================
  // PHASE 3: GROUP VIDEO CALLING
  // ==========================================
  describe('Phase 3 — Group Video Calling', () => {
    test('Non-creator cannot start a group video call', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'start', mode: 'video' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Only the room creator can initiate a group call');
    });

    test('Room Creator starts group video call', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, action: 'start', mode: 'video' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isCallActive, true);
      assert.strictEqual(data.callMode, 'video');
      assert.deepStrictEqual(data.callParticipants, [hostUserId]);
    });

    test('Guest joins active group video call', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'join' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.callParticipants.includes(guestUserId));
      assert.ok(data.callParticipants.includes(hostUserId));
    });

    test('Generates call token with video permissions', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, mode: 'video' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.mode, 'video');
    });

    test('Non-creator cannot end call for everyone', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'end' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Only the creator can end the call for everyone');
    });

    test('Creator ends video call for everyone', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, action: 'end' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isCallActive, false);
    });
  });

  // ==========================================
  // PHASE 4 & 5: GROUP AUDIO CALLING
  // ==========================================
  describe('Phase 4 & 5 — Group Audio Calling & Access Tokens', () => {
    test('Non-creator cannot start an audio call', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'start', mode: 'audio' }),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.error, 'Only the room creator can initiate a group call');
    });

    test('Room Creator starts group audio-only call', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, action: 'start', mode: 'audio' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isCallActive, true);
      assert.strictEqual(data.callMode, 'audio');
      assert.deepStrictEqual(data.callParticipants, [hostUserId]);

      // Check DB persistence
      const dbRes = await query('SELECT is_call_active, call_mode FROM rooms WHERE id = $1', [testRoomId]);
      assert.strictEqual(dbRes.rows[0].is_call_active, true);
      assert.strictEqual(dbRes.rows[0].call_mode, 'audio');
    });

    test('Generates audio-scoped call token with mode=audio', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, mode: 'audio' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.mode, 'audio');
    });

    test('Guest can join and independently leave active audio call without ending it', async () => {
      // Guest joins
      const joinRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'join' }),
      });
      assert.strictEqual(joinRes.status, 200);

      // Guest leaves
      const leaveRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestToken, action: 'leave' }),
      });
      assert.strictEqual(leaveRes.status, 200);
      const leaveData = await leaveRes.json();
      // Host is still in the call, so call remains active
      assert.strictEqual(leaveData.isCallActive, true);
      assert.strictEqual(leaveData.callParticipants.includes(guestUserId), false);
      assert.strictEqual(leaveData.callParticipants.includes(hostUserId), true);
    });

    test('Creator ends audio call for everyone', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, action: 'end' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.isCallActive, false);

      const dbRes = await query('SELECT is_call_active, call_mode FROM rooms WHERE id = $1', [testRoomId]);
      assert.strictEqual(dbRes.rows[0].is_call_active, false);
      assert.strictEqual(dbRes.rows[0].call_mode, null);
    });
  });
});
