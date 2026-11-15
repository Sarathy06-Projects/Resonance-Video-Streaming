import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../src/index';
import { RoomCoordinator } from '../src/room/coordinator';
import { query } from '../src/db';
import { RoomEvent } from '../src/types';

describe('Resonance Production-Ready 5-Person Audio Calling Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRoomId: string;
  let hostId: string;
  let hostToken: string;
  let guestTokens: string[] = [];
  let guestIds: string[] = [];

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
        hostName: 'Host Alice',
      }),
    });
    const roomData = await roomRes.json();
    assert.equal(roomRes.status, 201);
    testRoomId = roomData.roomId;
    hostToken = roomData.token;
    hostId = roomData.hostId;

    // 2. Join 5 Guests via API
    for (let i = 1; i <= 5; i++) {
      const joinRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: `Guest ${i}` }),
      });
      const joinData = await joinRes.json();
      assert.equal(joinRes.status, 200);
      guestTokens.push(joinData.token);
      guestIds.push(joinData.userId);
    }
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

  const createMockWs = (onMessage: (evt: RoomEvent) => void) => ({
    readyState: 1,
    send: (msg: string) => {
      try {
        const evt = JSON.parse(msg);
        onMessage(evt);
      } catch {}
    },
  });

  const createTestCoordinator = () => {
    return new RoomCoordinator({
      id: testRoomId,
      title: 'Audio Mesh Room',
      videoId: 'aqz-KE-bpKQ',
      videoProvider: 'youtube',
      hostId: hostId,
      isLocked: false,
      createdAt: Date.now(),
    });
  };

  describe('1. RoomCoordinator Mesh Audio Call Lifecycle', () => {
    it('Host starts audio call, transitions state to active', async () => {
      const coordinator = createTestCoordinator();
      const receivedEvents: RoomEvent[] = [];

      coordinator.addClient(createMockWs((evt) => receivedEvents.push(evt)) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      // Host starts call
      await coordinator.handleEvent(hostId, {
        id: 'evt_start',
        roomId: testRoomId,
        type: 'audio.call.start',
        senderId: hostId,
        sequence: 1,
        sentAt: Date.now(),
        payload: { hostId, hostName: 'Host Alice' },
      });

      assert.equal(coordinator.audioCallActive, true);
      assert.equal(coordinator.audioCallParticipants.size, 1);
      assert.equal(coordinator.audioCallParticipants.has(hostId), true);

      // Verify broadcasted audio.call.state
      const stateEvt = receivedEvents.find((e) => e.type === 'audio.call.state');
      assert.ok(stateEvt);
      assert.equal(stateEvt.payload.audioCallActive, true);
    });

    it('Non-host cannot start audio call', async () => {
      const coordinator = createTestCoordinator();
      const receivedEvents: RoomEvent[] = [];

      const guestId = guestIds[0];
      coordinator.addClient(createMockWs((evt) => receivedEvents.push(evt)) as any, {
        id: guestId,
        name: 'Guest 1',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      await coordinator.handleEvent(guestId, {
        id: 'evt_unauth_start',
        roomId: testRoomId,
        type: 'audio.call.start',
        senderId: guestId,
        sequence: 1,
        sentAt: Date.now(),
        payload: {},
      });

      // Call must remain inactive
      assert.equal(coordinator.audioCallActive, false);
      const errEvt = receivedEvents.find((e) => e.type === 'audio.call.state' && e.payload?.error);
      assert.ok(errEvt);
      assert.match(errEvt.payload.error, /Only the room (host|creator) can start/i);
    });
  });

  describe('2. Five-Participant Mesh Limit & 6th Participant Strict Rejection', () => {
    it('Allows exactly 5 participants (Host + 4 Guests) to join the audio call', async () => {
      const coordinator = createTestCoordinator();

      // Connect Host and 4 Guests
      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      await coordinator.handleEvent(hostId, {
        id: 'evt_start',
        roomId: testRoomId,
        type: 'audio.call.start',
        senderId: hostId,
        sequence: 1,
        sentAt: Date.now(),
        payload: {},
      });

      // Guests 1 to 4 join
      for (let i = 0; i < 4; i++) {
        const gid = guestIds[i];
        coordinator.addClient(createMockWs(() => {}) as any, {
          id: gid,
          name: `Guest ${i + 1}`,
          role: 'guest',
          color: '#10b981',
          joinedAt: Date.now(),
        });
        await coordinator.handleEvent(gid, {
          id: `evt_join_${i}`,
          roomId: testRoomId,
          type: 'audio.call.join',
          senderId: gid,
          sequence: i + 2,
          sentAt: Date.now(),
          payload: { participantId: gid, participantName: `Guest ${i + 1}` },
        });
      }

      // Exact 5 participants in mesh
      assert.equal(coordinator.audioCallParticipants.size, 5);
      assert.equal(coordinator.audioCallParticipants.has(hostId), true);
      assert.equal(coordinator.audioCallParticipants.has(guestIds[0]), true);
      assert.equal(coordinator.audioCallParticipants.has(guestIds[1]), true);
      assert.equal(coordinator.audioCallParticipants.has(guestIds[2]), true);
      assert.equal(coordinator.audioCallParticipants.has(guestIds[3]), true);
    });

    it('Strictly rejects 6th participant when room already has 5 participants', async () => {
      const coordinator = createTestCoordinator();

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      await coordinator.handleEvent(hostId, {
        id: 'evt_start',
        roomId: testRoomId,
        type: 'audio.call.start',
        senderId: hostId,
        sequence: 1,
        sentAt: Date.now(),
        payload: {},
      });

      // Join 4 guests to hit 5 participants
      for (let i = 0; i < 4; i++) {
        const gid = guestIds[i];
        coordinator.addClient(createMockWs(() => {}) as any, {
          id: gid,
          name: `Guest ${i + 1}`,
          role: 'guest',
          color: '#10b981',
          joinedAt: Date.now(),
        });
        await coordinator.handleEvent(gid, {
          id: `evt_join_${i}`,
          roomId: testRoomId,
          type: 'audio.call.join',
          senderId: gid,
          sequence: i + 2,
          sentAt: Date.now(),
          payload: { participantId: gid, participantName: `Guest ${i + 1}` },
        });
      }

      assert.equal(coordinator.audioCallParticipants.size, 5);

      // 6th participant attempts to join
      const sixthGuestId = guestIds[4];
      const receivedBySixth: RoomEvent[] = [];
      coordinator.addClient(createMockWs((evt) => receivedBySixth.push(evt)) as any, {
        id: sixthGuestId,
        name: 'Guest 5',
        role: 'guest',
        color: '#ec4899',
        joinedAt: Date.now(),
      });

      await coordinator.handleEvent(sixthGuestId, {
        id: 'evt_join_6th',
        roomId: testRoomId,
        type: 'audio.call.join',
        senderId: sixthGuestId,
        sequence: 10,
        sentAt: Date.now(),
        payload: { participantId: sixthGuestId, participantName: 'Guest 5' },
      });

      // Participant count must NOT increase
      assert.equal(coordinator.audioCallParticipants.size, 5);
      assert.equal(coordinator.audioCallParticipants.has(sixthGuestId), false);

      // Rejection event must be sent directly to the 6th participant
      const rejection = receivedBySixth.find((e) => e.type === 'audio.call.state' && e.payload?.error);
      assert.ok(rejection, 'Rejection event must be returned');
      assert.match(rejection.payload.error, /maximum 5 participants/i);
    });
  });

  describe('3. Targeted WebRTC Signaling & STUN-Only Enforcement', () => {
    it('Routes audio.offer and audio.answer exclusively to targeted peer', async () => {
      const coordinator = createTestCoordinator();
      const peerA = hostId;
      const peerB = guestIds[0];
      const peerC = guestIds[1];

      const receivedByB: RoomEvent[] = [];
      const receivedByC: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, { id: peerA, name: 'Host', role: 'host', color: '#6366f1', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByB.push(evt)) as any, { id: peerB, name: 'Peer B', role: 'guest', color: '#10b981', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByC.push(evt)) as any, { id: peerC, name: 'Peer C', role: 'guest', color: '#f59e0b', joinedAt: Date.now() });

      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(peerA, { id: peerA, name: 'Host', isMuted: false, joinedAt: Date.now() });
      coordinator.audioCallParticipants.set(peerB, { id: peerB, name: 'Peer B', isMuted: false, joinedAt: Date.now() });

      // Peer A sends targeted audio.offer to Peer B
      await coordinator.handleEvent(peerA, {
        id: 'evt_offer_1',
        roomId: testRoomId,
        type: 'audio.offer',
        senderId: peerA,
        sequence: 1,
        sentAt: Date.now(),
        payload: {
          targetParticipantId: peerB,
          sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 50000 RTP/SAVPF 111\r\n',
        },
      });

      const offerEvt = receivedByB.find((e) => e.type === 'audio.offer');
      assert.ok(offerEvt);
      assert.equal(offerEvt.senderId, peerA);
      // Peer C must receive NOTHING
      const offerForC = receivedByC.find((e) => e.type === 'audio.offer');
      assert.equal(offerForC, undefined);
    });

    it('Allows valid STUN server-reflexive (srflx) candidate', async () => {
      const coordinator = createTestCoordinator();
      const peerA = hostId;
      const peerB = guestIds[0];
      const receivedByB: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, { id: peerA, name: 'Host', role: 'host', color: '#6366f1', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByB.push(evt)) as any, { id: peerB, name: 'Peer B', role: 'guest', color: '#10b981', joinedAt: Date.now() });

      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(peerA, { id: peerA, name: 'Host', isMuted: false, joinedAt: Date.now() });
      coordinator.audioCallParticipants.set(peerB, { id: peerB, name: 'Peer B', isMuted: false, joinedAt: Date.now() });

      // Send valid STUN candidate (srflx / host)
      await coordinator.handleEvent(peerA, {
        id: 'evt_cand_stun',
        roomId: testRoomId,
        type: 'audio.ice_candidate',
        senderId: peerA,
        sequence: 2,
        sentAt: Date.now(),
        payload: {
          targetParticipantId: peerB,
          candidate: {
            candidate: 'candidate:1 1 UDP 2130706431 192.168.1.50 54321 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0,
          },
        },
      });

      const candEvt = receivedByB.find((e) => e.type === 'audio.ice_candidate');
      assert.ok(candEvt);
    });

    it('Strictly drops any relay (TURN) ICE candidate', async () => {
      const coordinator = createTestCoordinator();
      const peerA = hostId;
      const peerB = guestIds[0];
      const receivedByB: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, { id: peerA, name: 'Host', role: 'host', color: '#6366f1', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByB.push(evt)) as any, { id: peerB, name: 'Peer B', role: 'guest', color: '#10b981', joinedAt: Date.now() });

      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(peerA, { id: peerA, name: 'Host', isMuted: false, joinedAt: Date.now() });
      coordinator.audioCallParticipants.set(peerB, { id: peerB, name: 'Peer B', isMuted: false, joinedAt: Date.now() });

      // Send forbidden TURN relay candidate
      await coordinator.handleEvent(peerA, {
        id: 'evt_cand_relay',
        roomId: testRoomId,
        type: 'audio.ice_candidate',
        senderId: peerA,
        sequence: 3,
        sentAt: Date.now(),
        payload: {
          targetParticipantId: peerB,
          candidate: {
            candidate: 'candidate:2 1 UDP 16777215 203.0.113.1 54321 typ relay raddr 0.0.0.0 rport 0',
            type: 'relay',
            sdpMid: '0',
            sdpMLineIndex: 0,
          },
        },
      });

      // Must be completely dropped
      const relayEvt = receivedByB.find((e) => e.type === 'audio.ice_candidate');
      assert.equal(relayEvt, undefined);
    });
  });

  describe('4. Mute Synchronization & Teardown', () => {
    it('Broadcasts mute and unmute events across room', async () => {
      const coordinator = createTestCoordinator();
      const peerA = hostId;
      const peerB = guestIds[0];
      const receivedByB: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, { id: peerA, name: 'Host', role: 'host', color: '#6366f1', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByB.push(evt)) as any, { id: peerB, name: 'Peer B', role: 'guest', color: '#10b981', joinedAt: Date.now() });

      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(peerA, {
        id: peerA,
        name: 'Host',
        isMuted: false,
        joinedAt: Date.now(),
      });

      // Peer A mutes
      await coordinator.handleEvent(peerA, {
        id: 'evt_mute',
        roomId: testRoomId,
        type: 'audio.participant.muted',
        senderId: peerA,
        sequence: 5,
        sentAt: Date.now(),
        payload: {},
      });

      assert.equal(coordinator.audioCallParticipants.get(peerA)?.isMuted, true);
      const muteEvt = receivedByB.find((e) => e.type === 'audio.participant.muted');
      assert.ok(muteEvt);
      assert.equal(muteEvt.payload.participantId, peerA);
      assert.equal(muteEvt.payload.isMuted, true);
    });

    it('Host ends call for everyone and resets coordinator audio state', async () => {
      const coordinator = createTestCoordinator();
      const peerA = hostId;
      const peerB = guestIds[0];
      const receivedByB: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, { id: peerA, name: 'Host', role: 'host', color: '#6366f1', joinedAt: Date.now() });
      coordinator.addClient(createMockWs((evt) => receivedByB.push(evt)) as any, { id: peerB, name: 'Peer B', role: 'guest', color: '#10b981', joinedAt: Date.now() });

      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(peerA, { id: peerA, name: 'Host', isMuted: false, joinedAt: Date.now() });
      coordinator.audioCallParticipants.set(peerB, { id: peerB, name: 'Peer B', isMuted: false, joinedAt: Date.now() });

      // Host ends call
      await coordinator.handleEvent(peerA, {
        id: 'evt_end',
        roomId: testRoomId,
        type: 'audio.call.end',
        senderId: peerA,
        sequence: 6,
        sentAt: Date.now(),
        payload: {},
      });

      assert.equal(coordinator.audioCallActive, false);
      assert.equal(coordinator.audioCallParticipants.size, 0);

      const endEvt = receivedByB.find((e) => e.type === 'audio.call.end');
      assert.ok(endEvt);
    });
  });

  describe('5. HTTP Serverless API 5-Person Cap', () => {
    it('Rejects 6th participant joining via HTTP with 403 status', async () => {
      // 1. Host starts call
      await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken, action: 'start', mode: 'audio' }),
      });

      // 2. Guests 1 to 4 join (total 5)
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: guestTokens[i], action: 'join' }),
        });
        assert.equal(res.status, 200);
      }

      // 3. Guest 5 (6th participant) attempts to join
      const res6 = await fetch(`${baseUrl}/api/rooms/${testRoomId}/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guestTokens[4], action: 'join' }),
      });

      assert.equal(res6.status, 403);
      const data6 = await res6.json();
      assert.match(data6.error, /Call is full \(maximum 5 participants\)/i);
    });
  });
});
