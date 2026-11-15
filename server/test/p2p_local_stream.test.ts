import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../src/index';
import { resolveMediaUrl } from '../src/utils/resolver';
import { query, pool } from '../src/db';

describe('Resonance Zero-Media-Server-Cost Local Video Streaming Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRoomId: string;
  let hostToken: string;
  let hostId: string;
  let guest1Token: string;
  let guest1Id: string;

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

    // 1. Create Room with local video via API
    const roomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: 'local://my_family_vacation.mp4',
        hostName: 'Host User',
      }),
    });
    const roomData = await roomRes.json();
    assert.equal(roomRes.status, 201);
    testRoomId = roomData.roomId;
    hostToken = roomData.token;
    hostId = roomData.hostId || roomData.userId;

    // 2. Join Guest 1
    const joinRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Guest One',
      }),
    });
    const joinData = await joinRes.json();
    assert.equal(joinRes.status, 200);
    guest1Token = joinData.token;
    guest1Id = joinData.user?.id || joinData.userId;
  });

  after(async () => {
    if (testRoomId) {
      await query(`DELETE FROM room_signals WHERE room_id = $1`, [testRoomId]).catch(() => {});
      await query(`DELETE FROM room_members WHERE room_id = $1`, [testRoomId]).catch(() => {});
      await query(`DELETE FROM rooms WHERE id = $1`, [testRoomId]).catch(() => {});
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    setTimeout(() => process.exit(0), 500);
  });

  describe('1. P2P Local Media URL Resolver', () => {
    it('Resolves local:// URLs to p2p_local provider with zero-media-server architecture', async () => {
      const res = await resolveMediaUrl('local://my_family_vacation.mp4');
      assert.equal(res.provider, 'p2p_local');
      assert.equal(res.format, 'mp4');
      assert.equal(res.title, 'my_family_vacation.mp4');
      assert.equal(res.supported, true);
      assert.equal(res.compatibility, 'fully_syncable');
      assert.match(res.explanation, /zero server media infrastructure/i);
    });

    it('Resolves p2p:// URLs to p2p_local provider', async () => {
      const res = await resolveMediaUrl('p2p://holiday_event.webm');
      assert.equal(res.provider, 'p2p_local');
      assert.equal(res.format, 'mp4');
      assert.equal(res.title, 'holiday_event.webm');
      assert.equal(res.supported, true);
    });
  });

  describe('2. WebRTC P2P Signaling & Security Enforcement', () => {
    it('Rejects signaling request with unauthorized session token', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid_token_xyz',
          targetParticipantId: guest1Id,
          payload: { type: 'offer', sdp: 'fake_sdp', isP2PStream: true },
        }),
      });
      assert.equal(res.status, 401);
    });

    it('Rejects signaling payload exceeding maximum size limit (64KB)', async () => {
      const largePayload = {
        type: 'offer',
        sdp: 'x'.repeat(70000), // > 64KB
        isP2PStream: true,
      };

      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: hostToken,
          targetParticipantId: guest1Id,
          payload: largePayload,
        }),
      });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /exceeds maximum size/i);
    });

    it('Rejects non-host attempting to publish a local video stream offer', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: guest1Token, // Guest attempts to publish offer
          targetParticipantId: hostId,
          payload: {
            type: 'offer',
            sdp: 'v=0\r\no=FakeOffer 12345 2 IN IP4 127.0.0.1\r\n',
            isP2PStream: true,
          },
        }),
      });
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /only the room host can publish local video streams/i);
    });

    it('Authoritative Host publishes P2P stream offer to Guest 1 successfully', async () => {
      const fakeOfferSdp = 'v=0\r\no=HostP2P 11111 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: hostToken,
          targetParticipantId: guest1Id,
          payload: {
            type: 'offer',
            sdp: fakeOfferSdp,
            isP2PStream: true,
          },
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
    });

    it('Guest 1 receives and consumes the pending P2P offer via polling fallback', async () => {
      const pollRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/poll?token=${guest1Token}`);
      assert.equal(pollRes.status, 200);
      const pollData = await pollRes.json();

      assert.equal(pollData.success, true);
      assert.ok(Array.isArray(pollData.signals));
      assert.ok(pollData.signals.length >= 1);

      const streamSignal = pollData.signals.find((s: any) => s.payload?.isP2PStream === true);
      assert.ok(streamSignal);
      assert.equal(streamSignal.senderId, hostId);
      assert.equal(streamSignal.payload.type, 'offer');
      assert.match(streamSignal.payload.sdp, /HostP2P/);
    });

    it('Guest 1 sends WebRTC answer back to Host successfully', async () => {
      const fakeAnswerSdp = 'v=0\r\no=GuestAnswer 22222 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
      const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: guest1Token,
          targetParticipantId: hostId,
          payload: {
            type: 'answer',
            sdp: fakeAnswerSdp,
            isP2PStream: true,
          },
        }),
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
    });

    it('Host receives and consumes the answer signal via polling', async () => {
      const pollRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/poll?token=${hostToken}`);
      assert.equal(pollRes.status, 200);
      const pollData = await pollRes.json();

      assert.equal(pollData.success, true);
      const answerSignal = pollData.signals.find((s: any) => s.payload?.isP2PStream === true);
      assert.ok(answerSignal);
      assert.equal(answerSignal.senderId, guest1Id);
      assert.equal(answerSignal.payload.type, 'answer');
      assert.match(answerSignal.payload.sdp, /GuestAnswer/);
    });
  });
});
