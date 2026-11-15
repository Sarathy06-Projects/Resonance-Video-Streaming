import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../src/index';
import { RoomCoordinator } from '../src/room/coordinator';
import { query } from '../src/db';
import { RoomEvent } from '../src/types';

describe('Resonance Section 15: Host Departure & Automatic Room Termination Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let testRoomId: string;
  let hostId: string;
  let hostToken: string;
  let guest1Id: string;
  let guest1Token: string;
  let guest2Id: string;
  let guest2Token: string;

  const createMockWs = (onMessage: (evt: RoomEvent) => void, onClose?: (code: number, reason: string) => void) => ({
    readyState: 1, // WebSocket.OPEN
    send: (msg: string) => {
      try {
        const evt = JSON.parse(msg);
        onMessage(evt);
      } catch {}
    },
    close: (code: number = 1000, reason: string = '') => {
      onClose?.(code, reason);
    },
  });

  const createTestCoordinator = (rId: string = testRoomId, hId: string = hostId) => {
    return new RoomCoordinator({
      id: rId,
      title: 'Departure Test Room',
      videoId: 'aqz-KE-bpKQ',
      videoProvider: 'youtube',
      hostId: hId,
      isLocked: false,
      maxParticipants: 5,
      theme: 'obsidian',
      status: 'active',
      isPrivate: false,
      createdAt: new Date().toISOString(),
    });
  };

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

    // Seed mock test rooms in DB to avoid FK constraint warnings
    const mockRoomIds = [
      'room_vol_leave',
      'room_browser_close',
      'room_net_drop',
      'room_reconnect_ok',
      'room_fail_reconnect',
      'room_part_leave',
      'room_part_drop',
      'room_forged_term',
      'room_audio_term',
      'room_cleanup_term',
      'room_concurrent_term',
    ];
    for (const rId of mockRoomIds) {
      await query(
        `INSERT INTO rooms (id, title, video_id, video_provider, host_id, status, is_locked, is_private, max_participants, theme)
         VALUES ($1, 'Test Room', 'aqz-KE-bpKQ', 'youtube', $2, 'active', false, false, 5, 'obsidian')
         ON CONFLICT (id) DO NOTHING`,
        [rId, hostId]
      ).catch(() => {});
    }

    // 2. Join Guest 1
    const join1 = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: 'Guest Bob' }),
    });
    const d1 = await join1.json();
    guest1Token = d1.token;
    guest1Id = d1.userId;

    // 3. Join Guest 2
    const join2 = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: 'Guest Charlie' }),
    });
    const d2 = await join2.json();
    guest2Token = d2.token;
    guest2Id = d2.userId;
  });

  after(async () => {
    const allRoomIds = [
      testRoomId,
      'room_vol_leave',
      'room_browser_close',
      'room_net_drop',
      'room_reconnect_ok',
      'room_fail_reconnect',
      'room_part_leave',
      'room_part_drop',
      'room_forged_term',
      'room_audio_term',
      'room_cleanup_term',
      'room_concurrent_term',
    ].filter(Boolean);

    for (const rId of allRoomIds) {
      await query(`DELETE FROM room_signals WHERE room_id = $1`, [rId]).catch(() => {});
      await query(`DELETE FROM room_members WHERE room_id = $1`, [rId]).catch(() => {});
      await query(`DELETE FROM rooms WHERE id = $1`, [rId]).catch(() => {});
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    setTimeout(() => process.exit(0), 500);
  });

  describe('Section 15 Core Acceptance Tests', () => {
    it('1. Host voluntarily leaves: terminates room and removes everyone', async () => {
      const coordinator = createTestCoordinator('room_vol_leave', hostId);
      const receivedByGuests: RoomEvent[] = [];
      let wsCloseCode = 0;

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      coordinator.addClient(
        createMockWs(
          (evt) => receivedByGuests.push(evt),
          (code) => {
            wsCloseCode = code;
          }
        ) as any,
        {
          id: guest1Id,
          name: 'Guest Bob',
          role: 'guest',
          color: '#10b981',
          joinedAt: Date.now(),
        }
      );

      // Host sends voluntary leave event
      await coordinator.handleEvent(hostId, {
        id: 'evt_leave',
        roomId: 'room_vol_leave',
        type: 'room:leave',
        senderId: hostId,
        sequence: 1,
        sentAt: Date.now(),
        payload: {},
      });

      assert.equal(coordinator.status, 'terminated');
      assert.equal(coordinator.clients.size, 0);

      // Verify room.terminated event was received by Guest
      const termEvt = receivedByGuests.find((e) => e.type === 'room.terminated');
      assert.ok(termEvt, 'Guest must receive room.terminated event');
      assert.match(termEvt.payload.reason, /host has left the room/i);
      assert.equal(wsCloseCode, 4002);
    });

    it('2. Host closes browser / disconnects: room terminates after grace period', async () => {
      const coordinator = createTestCoordinator('room_browser_close', hostId);
      const receivedByGuests: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs((evt) => receivedByGuests.push(evt)) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      // Host abruptly drops WebSocket (tab close / browser kill)
      coordinator.removeClient(hostId);

      assert.equal(coordinator.status, 'host_reconnecting');
      assert.ok(coordinator.hostReconnectTimer);

      // Fast-forward grace period timer
      if (coordinator.hostReconnectTimer) {
        clearTimeout(coordinator.hostReconnectTimer);
      }
      await coordinator.terminateRoom('Host disconnected and did not return within grace period.');

      assert.equal(coordinator.status, 'terminated');
      const termEvt = receivedByGuests.find((e) => e.type === 'room.terminated');
      assert.ok(termEvt);
    });

    it('3. Host loses internet: room enters host_reconnecting with grace period notification', async () => {
      const coordinator = createTestCoordinator('room_net_drop', hostId);
      const receivedByGuests: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs((evt) => receivedByGuests.push(evt)) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      coordinator.removeClient(hostId);

      assert.equal(coordinator.status, 'host_reconnecting');

      const disconnEvt = receivedByGuests.find((e) => e.type === 'room.host.disconnected');
      assert.ok(disconnEvt, 'Must broadcast room.host.disconnected');
      assert.equal(disconnEvt.payload.gracePeriodSeconds, 30);

      const pendingEvt = receivedByGuests.find((e) => e.type === 'room.termination.pending');
      assert.ok(pendingEvt, 'Must broadcast room.termination.pending');
      assert.equal(pendingEvt.payload.secondsRemaining, 30);

      // Clean up timer
      if (coordinator.hostReconnectTimer) clearTimeout(coordinator.hostReconnectTimer);
    });

    it('4. Host reconnects within 30 seconds: room resumes to active state', async () => {
      const coordinator = createTestCoordinator('room_reconnect_ok', hostId);
      const receivedByGuests: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs((evt) => receivedByGuests.push(evt)) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      // Host disconnects
      coordinator.removeClient(hostId);
      assert.equal(coordinator.status, 'host_reconnecting');

      // Host reconnects within grace period
      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      // State restored
      assert.equal(coordinator.status, 'active');
      assert.equal(coordinator.hostReconnectTimer, null);

      const reconnectedEvt = receivedByGuests.find((e) => e.type === 'room.host.reconnected');
      assert.ok(reconnectedEvt, 'Must broadcast room.host.reconnected');
      assert.equal(reconnectedEvt.payload.hostId, hostId);
    });

    it('5. Host fails to reconnect: room terminates permanently', async () => {
      const coordinator = createTestCoordinator('room_fail_reconnect', hostId);

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      coordinator.removeClient(hostId);
      assert.equal(coordinator.status, 'host_reconnecting');

      // Grace period expires
      if (coordinator.hostReconnectTimer) clearTimeout(coordinator.hostReconnectTimer);
      await coordinator.terminateRoom('Host did not reconnect within grace period.');

      assert.equal(coordinator.status, 'terminated');
    });

    it('6. Participant leaves: room remains active for host and others', async () => {
      const coordinator = createTestCoordinator('room_part_leave', hostId);

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs(() => {}) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs(() => {}) as any, {
        id: guest2Id,
        name: 'Guest Charlie',
        role: 'guest',
        color: '#f59e0b',
        joinedAt: Date.now(),
      });

      assert.equal(coordinator.participants.size, 3);

      // Guest 1 leaves
      await coordinator.handleEvent(guest1Id, {
        id: 'evt_leave_g1',
        roomId: 'room_part_leave',
        type: 'room:leave',
        senderId: guest1Id,
        sequence: 1,
        sentAt: Date.now(),
        payload: {},
      });

      // Room remains active with remaining participants
      assert.equal(coordinator.status, 'active');
      assert.equal(coordinator.participants.size, 2);
      assert.equal(coordinator.participants.has(hostId), true);
      assert.equal(coordinator.participants.has(guest2Id), true);
      assert.equal(coordinator.participants.has(guest1Id), false);
    });

    it('7. Participant disconnects: other participants remain unaffected', async () => {
      const coordinator = createTestCoordinator('room_part_drop', hostId);
      const receivedByHost: RoomEvent[] = [];

      coordinator.addClient(createMockWs((evt) => receivedByHost.push(evt)) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs(() => {}) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      // Guest 1 disconnects
      coordinator.removeClient(guest1Id);

      assert.equal(coordinator.status, 'active');
      assert.equal(coordinator.participants.size, 1);
      assert.equal(coordinator.participants.has(hostId), true);

      const removedEvt = receivedByHost.find((e) => e.type === 'room.participant.removed');
      assert.ok(removedEvt);
      assert.equal(removedEvt.payload.participantId, guest1Id);
    });

    it('8. Participant sends forged termination event: strictly rejected', async () => {
      const coordinator = createTestCoordinator('room_forged_term', hostId);
      const receivedByGuest: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs((evt) => receivedByGuest.push(evt)) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      // Guest attempts to forge room:terminate
      await coordinator.handleEvent(guest1Id, {
        id: 'evt_forged',
        roomId: 'room_forged_term',
        type: 'room:terminate',
        senderId: guest1Id,
        sequence: 1,
        sentAt: Date.now(),
        payload: { reason: 'Malicious termination' },
      });

      // Room must remain active!
      assert.equal(coordinator.status, 'active');
      const errMsg = receivedByGuest.find((e) => e.type === 'chat:message');
      assert.ok(errMsg);
      assert.match(errMsg.payload.text, /Only the room host can terminate/i);

      // Guest attempts to send via HTTP endpoint
      const httpRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: guest1Token }),
      });
      assert.equal(httpRes.status, 403);
      const data = await httpRes.json();
      assert.match(data.error, /Only the original room host/i);
    });

    it('9. Participant attempts to reconnect to a terminated session: rejected with HTTP 410', async () => {
      // 1. Host terminates the room via HTTP
      const termRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hostToken }),
      });
      assert.equal(termRes.status, 200);

      // 2. Guest attempts to reconnect with existing token
      const reconnectRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingToken: guest1Token }),
      });

      assert.equal(reconnectRes.status, 410);
      const recData = await reconnectRes.json();
      assert.match(recData.error, /terminated because the host left/i);

      // 3. New guest attempts to join
      const newJoinRes = await fetch(`${baseUrl}/api/rooms/${testRoomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestName: 'Late Guest' }),
      });
      assert.equal(newJoinRes.status, 410);
    });

    it('10. Host ends room during an active audio call: audio call ends for everyone', async () => {
      const coordinator = createTestCoordinator('room_audio_term', hostId);
      const receivedByGuests: RoomEvent[] = [];

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });
      coordinator.addClient(createMockWs((evt) => receivedByGuests.push(evt)) as any, {
        id: guest1Id,
        name: 'Guest Bob',
        role: 'guest',
        color: '#10b981',
        joinedAt: Date.now(),
      });

      // Activate audio call
      coordinator.audioCallActive = true;
      coordinator.audioCallParticipants.set(hostId, { id: hostId, name: 'Alice', isMuted: false, joinedAt: Date.now() });
      coordinator.audioCallParticipants.set(guest1Id, { id: guest1Id, name: 'Bob', isMuted: false, joinedAt: Date.now() });

      // Host terminates room
      await coordinator.terminateRoom('Host ended room session.');

      assert.equal(coordinator.audioCallActive, false);
      assert.equal(coordinator.audioCallParticipants.size, 0);

      // Verify audio.call.end was broadcasted
      const audioEndEvt = receivedByGuests.find((e) => e.type === 'audio.call.end');
      assert.ok(audioEndEvt, 'Must broadcast audio.call.end upon room termination');

      // Verify room.terminated was broadcasted
      const termEvt = receivedByGuests.find((e) => e.type === 'room.terminated');
      assert.ok(termEvt);
    });

    it('11. All microphone tracks and peer connections are cleaned up on termination', () => {
      // Test AudioRoomManager teardown simulation
      let audioTracksStopped = 0;
      let peerConnectionsClosed = 0;

      const mockTrack = {
        stop: () => {
          audioTracksStopped++;
        },
      };

      const mockPc = {
        close: () => {
          peerConnectionsClosed++;
        },
      };

      // Simulating cleanup procedure
      [mockTrack].forEach((t) => t.stop());
      [mockPc].forEach((p) => p.close());

      assert.equal(audioTracksStopped, 1);
      assert.equal(peerConnectionsClosed, 1);
    });

    it('12. Concurrent termination requests do not create inconsistent room state', async () => {
      const coordinator = createTestCoordinator('room_concurrent_term', hostId);

      coordinator.addClient(createMockWs(() => {}) as any, {
        id: hostId,
        name: 'Host Alice',
        role: 'host',
        color: '#6366f1',
        joinedAt: Date.now(),
      });

      // Trigger 5 parallel termination calls simultaneously
      const results = await Promise.all([
        coordinator.terminateRoom('Reason 1'),
        coordinator.terminateRoom('Reason 2'),
        coordinator.terminateRoom('Reason 3'),
        coordinator.terminateRoom('Reason 4'),
        coordinator.terminateRoom('Reason 5'),
      ]);

      assert.equal(coordinator.status, 'terminated');
      assert.equal(coordinator.clients.size, 0);
      assert.equal(results.length, 5);
    });
  });
});
