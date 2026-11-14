import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';
import { server } from '../src/index';
import { pool } from '../src/db';
import { roomManager } from '../src/room/manager';
import { signSessionToken } from '../src/utils/auth';

const TEST_PORT = 4124;
let wsBaseUrl: string;

describe('Together Watch Party - Group Video Call Permissions & Signaling', () => {
  let roomId = '';
  let hostId = '';
  let hostToken = '';
  let guestId = 'usr_guest_test';
  let guestToken = '';

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, () => {
        wsBaseUrl = `ws://localhost:${TEST_PORT}`;
        resolve();
      });
    });

    const created = await roomManager.createRoom({
      videoUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      hostName: 'AliceCreator',
    });

    roomId = created.roomId;
    hostId = created.hostId;

    hostToken = signSessionToken({
      roomId,
      userId: hostId,
      name: 'AliceCreator',
      role: 'host',
      color: '#6366f1',
    });

    guestToken = signSessionToken({
      roomId,
      userId: guestId,
      name: 'BobViewer',
      role: 'guest',
      color: '#10b981',
    });
  });

  after(async () => {
    try {
      await pool.end();
    } catch (e) {}
    setTimeout(() => process.exit(0), 100);
  });

  it('Verifies Video Call: Creator-only start/end, viewer join, and WebRTC signal relay', async () => {
    const hostWs = new WebSocket(`${wsBaseUrl}/api/rooms/${roomId}/connect?token=${encodeURIComponent(hostToken)}`);
    const guestWs = new WebSocket(`${wsBaseUrl}/api/rooms/${roomId}/connect?token=${encodeURIComponent(guestToken)}`);

    // 1. Wait for room:state handshake on both sockets
    const hostReady = new Promise<void>((resolve) => {
      hostWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'room:state') resolve();
      });
    });

    const guestReady = new Promise<void>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'room:state') resolve();
      });
    });

    await Promise.all([hostReady, guestReady]);

    // 2. Viewer attempts to start group call -> must be ignored by server
    let viewerCallTriggered = false;
    const guestMsgListener = (msg: any) => {
      const ev = JSON.parse(msg.toString());
      if (ev.type === 'call:started') viewerCallTriggered = true;
    };
    guestWs.on('message', guestMsgListener);

    guestWs.send(
      JSON.stringify({
        type: 'call:start',
        roomId,
        sentAt: Date.now(),
        payload: {},
      })
    );

    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(viewerCallTriggered, false, 'Viewer cannot start a group call');
    guestWs.off('message', guestMsgListener);

    // 3. Creator starts group video call -> guest receives call:started
    const guestReceivedCallPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'call:started') resolve(ev);
      });
    });

    hostWs.send(
      JSON.stringify({
        type: 'call:start',
        roomId,
        sentAt: Date.now(),
        payload: {},
      })
    );

    const callEvent = await guestReceivedCallPromise;
    assert.strictEqual(callEvent.type, 'call:started');
    assert.strictEqual(callEvent.payload.hostId, hostId);
    assert.strictEqual(callEvent.payload.hostName, 'AliceCreator');

    // 4. Viewer joins active call -> host receives call:participant_joined
    const hostSawGuestJoinPromise = new Promise<any>((resolve) => {
      hostWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'call:participant_joined') resolve(ev);
      });
    });

    guestWs.send(
      JSON.stringify({
        type: 'call:join',
        roomId,
        sentAt: Date.now(),
        payload: {},
      })
    );

    const joinEvent = await hostSawGuestJoinPromise;
    assert.strictEqual(joinEvent.payload.participantId, guestId);

    // 5. Test WebRTC signal relay between Host and Guest
    const signalPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'call:signal') resolve(ev);
      });
    });

    hostWs.send(
      JSON.stringify({
        type: 'call:signal',
        roomId,
        sentAt: Date.now(),
        payload: {
          targetParticipantId: guestId,
          signalType: 'offer',
          sdp: { type: 'offer', sdp: 'fake_test_sdp' },
        },
      })
    );

    const signalEvent = await signalPromise;
    assert.strictEqual(signalEvent.payload.signalType, 'offer');
    assert.strictEqual(signalEvent.payload.sdp.sdp, 'fake_test_sdp');

    // 6. Creator ends the call for everyone -> guest receives call:ended
    const guestCallEndedPromise = new Promise<any>((resolve) => {
      guestWs.on('message', (msg) => {
        const ev = JSON.parse(msg.toString());
        if (ev.type === 'call:ended') resolve(ev);
      });
    });

    hostWs.send(
      JSON.stringify({
        type: 'call:end',
        roomId,
        sentAt: Date.now(),
        payload: {},
      })
    );

    const endedEvent = await guestCallEndedPromise;
    assert.strictEqual(endedEvent.type, 'call:ended');

    hostWs.close();
    guestWs.close();
  });
});
