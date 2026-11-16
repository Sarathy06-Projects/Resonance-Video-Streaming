import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import {
  PlaybackState,
  PlaybackStatus,
  Participant,
  ChatMessage,
  Reaction,
  QueueItem,
  RoomEvent,
  RoomMetadata,
} from '../types';
import { query } from '../db';

interface ConnectedClient {
  ws: WebSocket;
  participant: Participant;
  lastMessageTime: number;
  messageCount: number;
}

export class RoomCoordinator {
  public roomId: string;
  public metadata: RoomMetadata;
  public ownerUserId: string; // Section 15: Immutable original room host
  public status: 'active' | 'host_reconnecting' | 'terminating' | 'terminated' = 'active';
  public hostReconnectTimer: NodeJS.Timeout | null = null;
  public hostReconnectDeadline: number | null = null;
  public static readonly HOST_RECONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds

  public playbackState: PlaybackState;
  public participants: Map<string, Participant> = new Map();
  public clients: Map<string, ConnectedClient> = new Map();
  public chatHistory: ChatMessage[] = [];
  public queue: QueueItem[] = [];
  public isCallActive: boolean = false;
  public callParticipants: Set<string> = new Set();
  public audioCallActive: boolean = false;
  public audioCallParticipants: Map<string, { id: string; name: string; isMuted: boolean; joinedAt: number }> = new Map();
  private sequence: number = 0;
  public lastActiveAt: number = Date.now();
  private closeTimer: NodeJS.Timeout | null = null;

  constructor(metadata: RoomMetadata) {
    this.roomId = metadata.id;
    this.metadata = metadata;
    this.ownerUserId = metadata.hostId;
    this.status = (metadata.status as any) || 'active';
    this.playbackState = {
      videoId: metadata.videoId,
      status: 'paused',
      position: 0,
      updatedAt: Date.now(),
      playbackRate: 1.0,
      sequence: 0,
      hostId: metadata.hostId,
    };
  }

  public getNextSequence(): number {
    return ++this.sequence;
  }

  public getExpectedPosition(): number {
    const now = Date.now();
    if (this.playbackState.status !== 'playing') {
      return this.playbackState.position;
    }
    const elapsed = (now - this.playbackState.updatedAt) / 1000;
    return this.playbackState.position + elapsed * (this.playbackState.playbackRate || 1.0);
  }

  public addClient(ws: WebSocket, participant: Participant) {
    if (this.status === 'terminated' || this.status === 'terminating') {
      try {
        ws.close(4002, 'Room terminated');
      } catch {}
      return;
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    const isOriginalHost = participant.id === this.ownerUserId || participant.userId === this.ownerUserId;

    // Section 15: If original host reconnects within the 30s grace period, restore active state
    if (isOriginalHost) {
      participant.role = 'host';
      this.playbackState.hostId = participant.id;

      if (this.hostReconnectTimer) {
        clearTimeout(this.hostReconnectTimer);
        this.hostReconnectTimer = null;
        this.hostReconnectDeadline = null;
      }

      if (this.status === 'host_reconnecting') {
        this.status = 'active';
        this.metadata.status = 'active';
        query('UPDATE rooms SET status = $1 WHERE id = $2', ['active', this.roomId]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'room.host.reconnected',
          senderId: 'server',
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            hostId: participant.id,
            hostName: participant.name,
          },
        });
      }
    } else {
      participant.role = 'guest';
    }

    this.lastActiveAt = Date.now();
    this.participants.set(participant.id, participant);
    this.clients.set(participant.id, {
      ws,
      participant,
      lastMessageTime: Date.now(),
      messageCount: 0,
    });

    // Persist/update member in Neon DB asynchronously
    query(
      `INSERT INTO room_members (id, room_id, user_id, guest_name, role, joined_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), role = $5`,
      [participant.id, this.roomId, participant.userId || null, participant.name, participant.role]
    ).catch((err) => console.error('[RoomCoordinator] Error persisting member:', err));

    // Send authoritative initial state to newly joined client
    const currentPosition = this.getExpectedPosition();
    this.sendEventTo(participant.id, {
      id: nanoid(),
      roomId: this.roomId,
      type: 'room:state',
      senderId: 'server',
      sequence: this.getNextSequence(),
      sentAt: Date.now(),
      payload: {
        roomId: this.roomId,
        metadata: {
          ...this.metadata,
          status: this.status,
        },
        status: this.status,
        hostId: this.ownerUserId,
        isHostReconnecting: this.status === 'host_reconnecting',
        hostReconnectDeadline: this.hostReconnectDeadline,
        playback: {
          ...this.playbackState,
          position: currentPosition,
          updatedAt: Date.now(),
        },
        participants: Array.from(this.participants.values()),
        recentChat: this.chatHistory.slice(-50),
        queue: this.queue,
        isCallActive: this.isCallActive,
        callParticipants: Array.from(this.callParticipants),
        audioCallActive: this.audioCallActive,
        audioCallParticipants: Array.from(this.audioCallParticipants.values()),
      },
    });

    // Broadcast member:join to all other participants
    this.broadcast({
      id: nanoid(),
      roomId: this.roomId,
      type: 'member:join',
      senderId: 'server',
      sequence: this.getNextSequence(),
      sentAt: Date.now(),
      payload: {
        participant,
      },
    }, participant.id);
  }

  public removeClient(participantId: string) {
    if (this.status === 'terminating' || this.status === 'terminated') {
      return;
    }

    const client = this.clients.get(participantId);
    if (!client) return;

    this.clients.delete(participantId);
    this.participants.delete(participantId);
    this.lastActiveAt = Date.now();

    // Remove from active 5-person audio mesh call if joined
    if (this.audioCallParticipants.has(participantId)) {
      this.audioCallParticipants.delete(participantId);
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'audio.participant.left',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          participantId,
          callParticipants: Array.from(this.audioCallParticipants.values()),
        },
      });

      if (this.audioCallActive && this.audioCallParticipants.size === 0) {
        this.audioCallActive = false;
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'audio.call.end',
          senderId: 'server',
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { reason: 'All participants left the audio call' },
        });
      }
    }

    // Remove from active video call if joined
    if (this.callParticipants.has(participantId)) {
      this.callParticipants.delete(participantId);
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'call:participant_left',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          participantId,
          callParticipants: Array.from(this.callParticipants),
        },
      });

      if (this.isCallActive && this.callParticipants.size === 0) {
        this.isCallActive = false;
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:ended',
          senderId: 'server',
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { reason: 'All participants left the call' },
        });
      }
    }

    const isOriginalHost = participantId === this.ownerUserId || this.playbackState.hostId === participantId;

    if (isOriginalHost) {
      // SECTION 15: HOST DEPARTURE — AUTOMATIC ROOM TERMINATION
      // Never transfer host or promote participants!
      this.status = 'host_reconnecting';
      this.metadata.status = 'host_reconnecting';
      this.hostReconnectDeadline = Date.now() + RoomCoordinator.HOST_RECONNECT_GRACE_PERIOD_MS;

      // Broadcast room.host.disconnected & room.termination.pending
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'room.host.disconnected',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          hostId: participantId,
          gracePeriodSeconds: 30,
          reconnectDeadline: this.hostReconnectDeadline,
        },
      });

      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'room.termination.pending',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          deadline: this.hostReconnectDeadline,
          secondsRemaining: 30,
        },
      });

      // Persist host_reconnecting status in Neon DB
      query('UPDATE rooms SET status = $1 WHERE id = $2', ['host_reconnecting', this.roomId]).catch(console.error);

      // Schedule 30-second server-side grace period timer
      if (this.hostReconnectTimer) {
        clearTimeout(this.hostReconnectTimer);
      }
      this.hostReconnectTimer = setTimeout(() => {
        if (this.status === 'host_reconnecting') {
          this.terminateRoom('The host has disconnected and did not return within the 30-second grace period. This session has been ended.');
        }
      }, RoomCoordinator.HOST_RECONNECT_GRACE_PERIOD_MS);
    } else {
      // Non-host (guest) departure: Room remains active!
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'room.participant.removed',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          participantId,
          name: client.participant.name,
          reason: 'Participant left the room',
        },
      });

      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'member:leave',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: Date.now(),
        payload: {
          participantId,
          name: client.participant.name,
        },
      });

      // If room is completely empty (no clients), schedule idle close
      if (this.clients.size === 0) {
        this.closeTimer = setTimeout(() => {
          this.terminateRoom('Room expired after idle period.');
        }, 30 * 60 * 1000);
      }
    }
  }

  public async handleEvent(senderId: string, event: RoomEvent): Promise<void> {
    const client = this.clients.get(senderId);
    if (!client) return;

    // Rate limiting check: max 10 messages/events per 3 seconds per client
    const now = Date.now();
    if (now - client.lastMessageTime < 3000) {
      client.messageCount++;
      if (client.messageCount > 15) {
        // Rate limited
        return;
      }
    } else {
      client.lastMessageTime = now;
      client.messageCount = 1;
    }

    const isHost = this.playbackState.hostId === senderId || client?.participant?.role === 'host' || this.ownerUserId === senderId;

    // Section 15: During host reconnection grace period, suspend host-authority actions
    if (this.status === 'host_reconnecting') {
      if (
        event.type.startsWith('playback:') ||
        event.type.startsWith('video:') ||
        event.type.startsWith('queue:') ||
        event.type === 'room:lock' ||
        event.type.startsWith('audio.call.start')
      ) {
        return;
      }
    }

    switch (event.type) {
      case 'room:terminate': {
        if (!isHost) {
          this.sendEventTo(senderId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'chat:message',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: {
              id: nanoid(),
              roomId: this.roomId,
              senderId: 'server',
              senderName: 'System',
              senderRole: 'host',
              senderColor: '#ef4444',
              text: 'Only the room host can terminate the room session.',
              timestamp: Date.now(),
            },
          });
          return;
        }
        await this.terminateRoom(event.payload?.reason || 'The host has ended the room session.');
        break;
      }

      case 'room:leave': {
        if (isHost) {
          // SECTION 15: If the host leaves voluntarily, the entire room session must be terminated for everyone
          await this.terminateRoom('The host has left the room. This session has been ended.');
        } else {
          this.removeClient(senderId);
        }
        break;
      }

      case 'room.host.disconnected':
      case 'room.host.reconnected':
      case 'room.termination.pending':
      case 'room.terminated':
      case 'room.participant.removed': {
        // Drop client attempts to forge system lifecycle events
        return;
      }
      case 'ping':
        this.sendEventTo(senderId, {
          id: nanoid(),
          roomId: this.roomId,
          type: 'pong',
          senderId: 'server',
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { clientSentAt: event.sentAt },
        });
        break;

      case 'playback:play': {
        if (!isHost) return; // Only host has authority in V1
        const position = typeof event.payload.position === 'number' ? event.payload.position : this.getExpectedPosition();
        this.playbackState.status = 'playing';
        this.playbackState.position = Math.max(0, position);
        this.playbackState.updatedAt = Date.now();
        this.playbackState.sequence = this.getNextSequence();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'playback:play',
          senderId,
          sequence: this.playbackState.sequence,
          sentAt: Date.now(),
          payload: {
            position: this.playbackState.position,
            updatedAt: this.playbackState.updatedAt,
            playbackRate: this.playbackState.playbackRate,
          },
        });
        break;
      }

      case 'playback:pause': {
        if (!isHost) return;
        const position = typeof event.payload.position === 'number' ? event.payload.position : this.getExpectedPosition();
        this.playbackState.status = 'paused';
        this.playbackState.position = Math.max(0, position);
        this.playbackState.updatedAt = Date.now();
        this.playbackState.sequence = this.getNextSequence();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'playback:pause',
          senderId,
          sequence: this.playbackState.sequence,
          sentAt: Date.now(),
          payload: {
            position: this.playbackState.position,
            updatedAt: this.playbackState.updatedAt,
          },
        });
        break;
      }

      case 'playback:seek': {
        if (!isHost) return;
        const targetPosition = Math.max(0, Number(event.payload.position) || 0);
        this.playbackState.position = targetPosition;
        this.playbackState.updatedAt = Date.now();
        this.playbackState.sequence = this.getNextSequence();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'playback:seek',
          senderId,
          sequence: this.playbackState.sequence,
          sentAt: Date.now(),
          payload: {
            position: targetPosition,
            status: this.playbackState.status,
            updatedAt: this.playbackState.updatedAt,
          },
        });
        break;
      }

      case 'playback:rate': {
        if (!isHost) return;
        const rate = Number(event.payload.playbackRate) || 1.0;
        this.playbackState.position = this.getExpectedPosition();
        this.playbackState.playbackRate = rate;
        this.playbackState.updatedAt = Date.now();
        this.playbackState.sequence = this.getNextSequence();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'playback:rate',
          senderId,
          sequence: this.playbackState.sequence,
          sentAt: Date.now(),
          payload: {
            position: this.playbackState.position,
            playbackRate: rate,
            updatedAt: this.playbackState.updatedAt,
          },
        });
        break;
      }

      case 'video:change': {
        if (!isHost) return;
        const videoId = String(event.payload.videoId);
        if (!videoId) return;

        this.playbackState.videoId = videoId;
        this.playbackState.position = 0;
        this.playbackState.status = 'playing';
        this.playbackState.updatedAt = Date.now();
        this.playbackState.sequence = this.getNextSequence();
        this.metadata.videoId = videoId;

        // Persist video update in Neon DB
        query('UPDATE rooms SET video_id = $1 WHERE id = $2', [videoId, this.roomId]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'video:change',
          senderId,
          sequence: this.playbackState.sequence,
          sentAt: Date.now(),
          payload: {
            videoId,
            title: event.payload.title || '',
            position: 0,
            status: 'playing',
            updatedAt: this.playbackState.updatedAt,
          },
        });
        break;
      }

      case 'chat:message': {
        const text = String(event.payload.text || '').trim();
        if (!text || text.length > 500) return; // PRD practical message length limit

        const chatMessage: ChatMessage = {
          id: nanoid(),
          roomId: this.roomId,
          senderId,
          senderName: client.participant.name,
          senderRole: client.participant.role,
          senderColor: client.participant.color,
          text,
          timestamp: Date.now(),
        };

        this.chatHistory.push(chatMessage);
        if (this.chatHistory.length > 100) {
          this.chatHistory.shift();
        }

        // Persist to Neon DB
        query(
          `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_role, message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [chatMessage.id, this.roomId, senderId, chatMessage.senderName, chatMessage.senderRole, text]
        ).catch((err) => console.error('[RoomCoordinator] Error saving chat message:', err));

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'chat:message',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { message: chatMessage },
        });
        break;
      }

      case 'reaction:send': {
        const emoji = String(event.payload.emoji || '❤️');
        const reactionType = String(event.payload.type || 'heart');

        const reaction: Reaction = {
          id: nanoid(),
          type: reactionType,
          emoji,
          senderId,
          senderName: client.participant.name,
          sentAt: Date.now(),
        };

        // Broadcast reaction to connected participants (ephemeral, not persisted)
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'reaction:send',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { reaction },
        });
        break;
      }

      case 'host:transfer': {
        // Section 15: No host transfer or participant promotion
        return;
      }

      case 'member:kick': {
        if (!isHost) return;
        const targetMemberId = String(event.payload.targetMemberId);
        const targetClient = this.clients.get(targetMemberId);
        if (targetClient) {
          this.sendEventTo(targetMemberId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'member:kick',
            senderId,
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { message: 'You have been removed from this room by the host' },
          });
          targetClient.ws.close(4001, 'Kicked by host');
          this.removeClient(targetMemberId);
        }
        break;
      }

      case 'room:lock': {
        if (!isHost) return;
        const isLocked = Boolean(event.payload.isLocked);
        const passcode = isLocked && typeof event.payload.passcode === 'string' ? event.payload.passcode.trim() : null;
        this.metadata.isLocked = isLocked;
        this.metadata.isPrivate = isLocked;
        this.metadata.passcode = passcode || undefined;
        query('UPDATE rooms SET is_locked = $1, is_private = $2, passcode = $3 WHERE id = $4', [
          isLocked,
          isLocked,
          passcode,
          this.roomId,
        ]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'room:lock',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { isLocked, hasPasscode: Boolean(passcode) },
        });
        break;
      }

      case 'queue:add': {
        if (!isHost) return; // Only host/creator can add to queue or change video
        const item: QueueItem = {
          id: nanoid(),
          roomId: this.roomId,
          videoId: String(event.payload.videoId),
          title: String(event.payload.title || 'Queued Video'),
          thumbnailUrl: String(event.payload.thumbnailUrl || `https://img.youtube.com/vi/${event.payload.videoId}/hqdefault.jpg`),
          addedBy: client.participant.name,
          addedAt: Date.now(),
          position: this.queue.length + 1,
        };

        this.queue.push(item);

        // Persist to Neon DB
        query(
          `INSERT INTO video_queue (id, room_id, video_id, title, thumbnail_url, added_by, position, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [item.id, this.roomId, item.videoId, item.title, item.thumbnailUrl, item.addedBy, item.position]
        ).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'queue:sync',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { queue: this.queue },
        });
        break;
      }

      case 'queue:remove': {
        if (!isHost) return;
        const itemId = String(event.payload.itemId);
        this.queue = this.queue.filter((q) => q.id !== itemId);

        query('DELETE FROM video_queue WHERE id = $1', [itemId]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'queue:sync',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { queue: this.queue },
        });
        break;
      }

      case 'queue:next': {
        if (!isHost) return;
        if (this.queue.length > 0) {
          const nextItem = this.queue.shift()!;
          query('DELETE FROM video_queue WHERE id = $1', [nextItem.id]).catch(console.error);

          this.playbackState.videoId = nextItem.videoId;
          this.playbackState.position = 0;
          this.playbackState.status = 'playing';
          this.playbackState.updatedAt = Date.now();
          this.playbackState.sequence = this.getNextSequence();
          this.metadata.videoId = nextItem.videoId;

          query('UPDATE rooms SET video_id = $1 WHERE id = $2', [nextItem.videoId, this.roomId]).catch(console.error);

          this.broadcast({
            id: nanoid(),
            roomId: this.roomId,
            type: 'video:change',
            senderId,
            sequence: this.playbackState.sequence,
            sentAt: Date.now(),
            payload: {
              videoId: nextItem.videoId,
              title: nextItem.title,
              position: 0,
              status: 'playing',
              updatedAt: this.playbackState.updatedAt,
            },
          });

          this.broadcast({
            id: nanoid(),
            roomId: this.roomId,
            type: 'queue:sync',
            senderId,
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { queue: this.queue },
          });
        }
        break;
      }

      case 'call:start': {
        // ONLY room creator / host can initiate a group video call!
        if (!isHost) return;
        this.isCallActive = true;
        this.callParticipants.add(senderId);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:started',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            hostId: senderId,
            hostName: client.participant.name,
            callParticipants: Array.from(this.callParticipants),
          },
        });
        break;
      }

      case 'call:end': {
        // ONLY room creator / host can end group video call for everyone!
        if (!isHost) return;
        this.isCallActive = false;
        this.callParticipants.clear();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:ended',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            hostId: senderId,
          },
        });
        break;
      }

      case 'call:join': {
        // Participant can join if call is active
        if (!this.isCallActive) return;
        this.callParticipants.add(senderId);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:participant_joined',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            participant: client.participant,
            callParticipants: Array.from(this.callParticipants),
          },
        });
        break;
      }

      case 'call:leave': {
        this.callParticipants.delete(senderId);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:participant_left',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            callParticipants: Array.from(this.callParticipants),
          },
        });

        // If creator left and no one is in call, end call
        if (isHost && this.callParticipants.size === 0) {
          this.isCallActive = false;
          this.broadcast({
            id: nanoid(),
            roomId: this.roomId,
            type: 'call:ended',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { reason: 'Creator ended the call' },
          });
        }
        break;
      }

      case 'call:signal': {
        // Relay WebRTC signaling (offer, answer, candidate) directly to targeted peer
        const targetId = String(event.payload.targetParticipantId);
        if (targetId) {
          this.sendEventTo(targetId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'call:signal',
            senderId,
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: {
              ...event.payload,
              senderId,
              senderName: client.participant.name,
            },
          });
        }
        break;
      }

      case 'audio.call.start': {
        // ONLY room creator / host can start group audio call
        if (!isHost) {
          this.sendEventTo(senderId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'audio.call.state',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { error: 'Only the room creator can start an audio call' },
          });
          return;
        }

        this.audioCallActive = true;
        this.audioCallParticipants.set(senderId, {
          id: senderId,
          name: client.participant.name,
          isMuted: false,
          joinedAt: Date.now(),
        });

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'audio.call.state',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            isActive: true,
            audioCallActive: true,
            hostId: senderId,
            hostName: client.participant.name,
            callParticipants: Array.from(this.audioCallParticipants.values()),
            participants: Array.from(this.audioCallParticipants.values()),
          },
        });
        break;
      }

      case 'audio.call.join': {
        if (!this.audioCallActive) {
          this.sendEventTo(senderId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'audio.call.state',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { error: 'No active audio call to join' },
          });
          return;
        }

        // STRICT 5-PERSON CAP ENFORCEMENT SERVER-SIDE
        if (this.audioCallParticipants.size >= 5 && !this.audioCallParticipants.has(senderId)) {
          this.sendEventTo(senderId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'audio.call.state',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { error: 'Call is full (maximum 5 participants)' },
          });
          return;
        }

        this.audioCallParticipants.set(senderId, {
          id: senderId,
          name: client.participant.name,
          isMuted: false,
          joinedAt: Date.now(),
        });

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'audio.participant.joined',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            participant: client.participant,
            callParticipants: Array.from(this.audioCallParticipants.values()),
          },
        });
        break;
      }

      case 'audio.call.leave': {
        this.audioCallParticipants.delete(senderId);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'audio.participant.left',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            callParticipants: Array.from(this.audioCallParticipants.values()),
          },
        });

        if (this.audioCallParticipants.size === 0) {
          this.audioCallActive = false;
          this.broadcast({
            id: nanoid(),
            roomId: this.roomId,
            type: 'audio.call.end',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { reason: 'All participants left the audio call' },
          });
        }
        break;
      }

      case 'audio.call.end': {
        // ONLY room host can end audio call for everyone
        if (!isHost) {
          this.sendEventTo(senderId, {
            id: nanoid(),
            roomId: this.roomId,
            type: 'audio.call.state',
            senderId: 'server',
            sequence: this.getNextSequence(),
            sentAt: Date.now(),
            payload: { error: 'Only the host can end the audio call for everyone' },
          });
          return;
        }

        this.audioCallActive = false;
        this.audioCallParticipants.clear();

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'audio.call.end',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            hostId: senderId,
          },
        });
        break;
      }

      case 'audio.offer':
      case 'audio.answer':
      case 'audio.ice_candidate': {
        // Targeted WebRTC signaling between mesh peers
        const targetId = String(event.payload?.targetParticipantId || '');
        if (!targetId || targetId === senderId) return;

        // Size check: reject payloads > 64KB
        const serialized = JSON.stringify(event.payload);
        if (serialized.length > 65536) return;

        // Verify sender and target are both in active audio call
        if (!this.audioCallParticipants.has(senderId) || !this.audioCallParticipants.has(targetId)) {
          return;
        }

        // STUN Only: Reject any relay candidate
        if (event.type === 'audio.ice_candidate') {
          const cand = event.payload?.candidate;
          if (cand && (cand.type === 'relay' || String(cand.candidate || '').includes('typ relay'))) {
            return;
          }
        }

        this.sendEventTo(targetId, {
          id: nanoid(),
          roomId: this.roomId,
          type: event.type,
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            ...event.payload,
            senderId,
            senderName: client.participant.name,
          },
        });
        break;
      }

      case 'audio.participant.muted':
      case 'audio.participant.unmuted': {
        const participant = this.audioCallParticipants.get(senderId);
        if (participant) {
          participant.isMuted = event.type === 'audio.participant.muted';
        }
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: event.type,
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            isMuted: event.type === 'audio.participant.muted',
          },
        });
        break;
      }

      case 'p2p_stream:signal': {
        // Relay direct P2P local video streaming signaling (SDP offer, answer, ICE candidate)
        const targetId = String(event.payload?.targetParticipantId || '');
        if (!targetId || targetId === senderId) return;

        // Security: Validate payload size
        const serialized = JSON.stringify(event.payload);
        if (serialized.length > 65536) return;

        // Security: Only room host can initiate P2P stream offer
        if (event.payload?.type === 'offer' && !isHost) {
          return;
        }

        // 2-person limit: Only host and the first joined viewer are paired in P2P stream
        const viewerParticipants = Array.from(this.participants.values()).filter(
          (p) => p.id !== this.metadata.hostId
        );
        if (viewerParticipants.length > 1) {
          viewerParticipants.sort((a, b) => a.joinedAt - b.joinedAt);
          const allowedViewer = viewerParticipants[0];
          if (senderId !== this.metadata.hostId && senderId !== allowedViewer.id) {
            return;
          }
          if (isHost && targetId !== allowedViewer.id) {
            return;
          }
        }

        this.sendEventTo(targetId, {
          id: nanoid(),
          roomId: this.roomId,
          type: 'p2p_stream:signal',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            ...event.payload,
            senderId,
            senderName: client.participant.name,
          },
        });
        break;
      }

      case 'p2p_stream:state': {
        // Broadcast host authoritative playback state for P2P video stream
        if (!isHost) return;
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'p2p_stream:state',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            ...event.payload,
            senderId,
          },
        });
        break;
      }

      case 'call:media-state': {
        // Broadcast mic mute or camera disabled state
        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'call:media-state',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            participantId: senderId,
            isMuted: Boolean(event.payload.isMuted),
            isCameraOff: Boolean(event.payload.isCameraOff),
          },
        }, senderId);
        break;
      }
    }
  }

  public sendEventTo(participantId: string, event: RoomEvent) {
    const client = this.clients.get(participantId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(event));
      } catch (err) {
        console.error('[RoomCoordinator] Error sending to client:', err);
      }
    }
  }

  public broadcast(event: RoomEvent, exceptParticipantId?: string) {
    const payloadStr = JSON.stringify(event);
    for (const [id, client] of this.clients.entries()) {
      if (exceptParticipantId && id === exceptParticipantId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payloadStr);
        } catch (err) {
          console.error(`[RoomCoordinator] Error broadcasting to ${id}:`, err);
        }
      }
    }
  }

  /**
   * Section 15: Authoritative Automatic Room Termination
   * Idempotently terminates the room session, ends audio/video calls, broadcasts room.terminated,
   * updates Neon PostgreSQL, disconnects all participant WebSockets, and cleans up memory.
   */
  public async terminateRoom(reason: string = 'The host has left the room. This session has been ended.'): Promise<void> {
    if (this.status === 'terminating' || this.status === 'terminated') {
      return; // Idempotent guard: concurrent termination calls do nothing
    }

    this.status = 'terminating';
    this.metadata.status = 'terminating';

    // Cancel any pending grace period or close timers
    if (this.hostReconnectTimer) {
      clearTimeout(this.hostReconnectTimer);
      this.hostReconnectTimer = null;
      this.hostReconnectDeadline = null;
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    const endedAt = Date.now();

    // 1. Mark active 5-person mesh audio call as ended
    if (this.audioCallActive || this.audioCallParticipants.size > 0) {
      this.audioCallActive = false;
      this.audioCallParticipants.clear();
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'audio.call.end',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: endedAt,
        payload: { reason: 'Room session terminated' },
      });
    }

    // 2. Mark legacy video call as ended if active
    if (this.isCallActive || this.callParticipants.size > 0) {
      this.isCallActive = false;
      this.callParticipants.clear();
      this.broadcast({
        id: nanoid(),
        roomId: this.roomId,
        type: 'call:ended',
        senderId: 'server',
        sequence: this.getNextSequence(),
        sentAt: endedAt,
        payload: { reason: 'Room session terminated' },
      });
    }

    // 3. Broadcast room.terminated to every connected participant
    this.broadcast({
      id: nanoid(),
      roomId: this.roomId,
      type: 'room.terminated',
      senderId: 'server',
      sequence: this.getNextSequence(),
      sentAt: endedAt,
      payload: {
        reason,
        endedAt,
      },
    });

    // Also broadcast room:closed for backward compatibility
    this.broadcast({
      id: nanoid(),
      roomId: this.roomId,
      type: 'room:closed',
      senderId: 'server',
      sequence: this.getNextSequence(),
      sentAt: endedAt,
      payload: { reason },
    });

    // 4. Authoritatively persist termination in Neon PostgreSQL
    try {
      await query(
        `UPDATE rooms 
         SET status = 'terminated', 
             is_call_active = false, 
             call_participants = '[]'::jsonb,
             terminated_at = NOW(),
             termination_reason = $1,
             expires_at = NOW() 
         WHERE id = $2`,
        [reason, this.roomId]
      );
      await query('DELETE FROM room_signals WHERE room_id = $1', [this.roomId]).catch(() => {});
    } catch (dbErr) {
      console.error('[RoomCoordinator] Error persisting room termination in Neon:', dbErr);
    }

    // 5. Disconnect all participant WebSocket sessions with close code 4002
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.ws && client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(4002, 'Room terminated');
        }
      } catch (wsErr) {
        // ignore close error
      }
    }

    // 6. Complete teardown of in-memory maps
    this.clients.clear();
    this.participants.clear();
    this.status = 'terminated';
    this.metadata.status = 'terminated';

    // 7. Remove coordinator from RoomManager
    try {
      const { roomManager } = require('./manager');
      roomManager.removeCoordinator(this.roomId);
    } catch {}
  }

  public closeRoom(reason: string) {
    this.terminateRoom(reason);
  }
}
