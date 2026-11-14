import { RoomMetadata } from '../types';

export interface CreateRoomResponse {
  success: boolean;
  roomId: string;
  hostId: string;
  token: string;
  metadata: RoomMetadata;
  videoInfo: {
    videoId: string;
    title: string;
    thumbnailUrl: string;
    authorName?: string;
  };
  shareUrl: string;
}

export interface JoinRoomResponse {
  success: boolean;
  token: string;
  userId: string;
  name: string;
  role: 'host' | 'guest';
  color: string;
  metadata: RoomMetadata;
}

export const api = {
  async validateUrl(url: string) {
    const res = await fetch('/api/rooms/validate-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to validate URL');
    return data;
  },

  async createRoom(params: {
    videoUrl: string;
    hostName: string;
    isPrivate?: boolean;
    passcode?: string;
    theme?: string;
  }): Promise<CreateRoomResponse> {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create room');
    return data;
  },

  async getRoom(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Room not found');
    return data;
  },

  async joinRoom(
    roomId: string,
    params: { guestName: string; passcode?: string; existingToken?: string }
  ): Promise<JoinRoomResponse> {
    const res = await fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to join room');
    return data;
  },

  async lockRoom(roomId: string, token: string, isLocked: boolean) {
    const res = await fetch(`/api/rooms/${roomId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, isLocked }),
    });
    return res.json();
  },

  async kickMember(roomId: string, memberId: string, token: string) {
    const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  async upgradeRoom(roomId: string, token: string) {
    const res = await fetch('/api/billing/upgrade-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upgrade room');
    return data;
  },

  async getSubscription(token: string) {
    const res = await fetch('/api/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  },

  async getCuratedDemos() {
    const res = await fetch('/api/rooms/curated/demos');
    return res.json();
  },
};
