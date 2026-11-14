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
  public playbackState: PlaybackState;
  public participants: Map<string, Participant> = new Map();
  public clients: Map<string, ConnectedClient> = new Map();
  public chatHistory: ChatMessage[] = [];
  public queue: QueueItem[] = [];
  public isCallActive: boolean = false;
  public callParticipants: Set<string> = new Set();
  private sequence: number = 0;
  public lastActiveAt: number = Date.now();
  private closeTimer: NodeJS.Timeout | null = null;

  constructor(metadata: RoomMetadata) {
    this.roomId = metadata.id;
    this.metadata = metadata;
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
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    this.lastActiveAt = Date.now();
    this.participants.set(participant.id, participant);
    this.clients.set(participant.id, {
      ws,
      participant,
      lastMessageTime: Date.now(),
      messageCount: 0,
    });

    // Verify role matches authoritative host
    if (participant.id === this.playbackState.hostId) {
      participant.role = 'host';
    } else if (participant.role !== 'host') {
      participant.role = 'guest';
    }

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
        metadata: this.metadata,
        hostId: this.playbackState.hostId,
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
    const client = this.clients.get(participantId);
    if (!client) return;

    this.clients.delete(participantId);
    this.participants.delete(participantId);
    this.lastActiveAt = Date.now();

    // Broadcast member:leave
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

    // Host departure handling (Section 6.5 & 14.1)
    if (this.playbackState.hostId === participantId) {
      const remaining = Array.from(this.participants.values());
      if (remaining.length > 0) {
        // Transfer host to the next senior participant
        const newHost = remaining[0];
        newHost.role = 'host';
        this.playbackState.hostId = newHost.id;

        // Persist new host role in DB
        query(`UPDATE room_members SET role = 'host' WHERE id = $1`, [newHost.id]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'host:transfer',
          senderId: 'server',
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            newHostId: newHost.id,
            newHostName: newHost.name,
            reason: 'Previous host disconnected',
          },
        });
      }
    }

    // If room is empty, start grace period
    if (this.clients.size === 0) {
      this.closeTimer = setTimeout(() => {
        this.closeRoom('Room expired after idle grace period');
      }, 30 * 60 * 1000); // 30 mins grace period as per PRD Section 14.1
    }
  }

  public handleEvent(senderId: string, event: RoomEvent) {
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

    const isHost = this.playbackState.hostId === senderId || client?.participant?.role === 'host';

    switch (event.type) {
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
        if (!isHost) return;
        const targetParticipantId = String(event.payload.targetParticipantId);
        const target = this.participants.get(targetParticipantId);
        if (!target) return;

        // Downgrade old host
        const oldHost = this.participants.get(senderId);
        if (oldHost) oldHost.role = 'guest';

        // Upgrade new host
        target.role = 'host';
        this.playbackState.hostId = target.id;

        // Update DB
        query(`UPDATE room_members SET role = 'guest' WHERE id = $1`, [senderId]).catch(console.error);
        query(`UPDATE room_members SET role = 'host' WHERE id = $1`, [target.id]).catch(console.error);
        query(`UPDATE rooms SET host_id = $1 WHERE id = $2`, [target.id, this.roomId]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'host:transfer',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: {
            newHostId: target.id,
            newHostName: target.name,
            reason: 'Host transferred control',
          },
        });
        break;
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
        this.metadata.isLocked = isLocked;
        query('UPDATE rooms SET is_locked = $1 WHERE id = $2', [isLocked, this.roomId]).catch(console.error);

        this.broadcast({
          id: nanoid(),
          roomId: this.roomId,
          type: 'room:lock',
          senderId,
          sequence: this.getNextSequence(),
          sentAt: Date.now(),
          payload: { isLocked },
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

  public closeRoom(reason: string) {
    this.metadata.status = 'ended';
    query(`UPDATE rooms SET status = 'ended', ended_at = NOW() WHERE id = $1`, [this.roomId]).catch(console.error);

    this.broadcast({
      id: nanoid(),
      roomId: this.roomId,
      type: 'room:closed',
      senderId: 'server',
      sequence: this.getNextSequence(),
      sentAt: Date.now(),
      payload: { reason },
    });

    for (const client of this.clients.values()) {
      try {
        client.ws.close(1000, reason);
      } catch (e) {}
    }
    this.clients.clear();
    this.participants.clear();
  }
}
