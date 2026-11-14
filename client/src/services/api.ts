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
    provider?: string;
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

async function handleResponse<T = any>(res: Response, defaultErrMsg: string): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Service endpoint or resource not found (404)');
      }
      if (res.status === 504 || res.status === 502) {
        throw new Error('Server temporarily unavailable or timed out. Please retry.');
      }
      throw new Error(`${defaultErrMsg} (HTTP ${res.status})`);
    }
    throw new Error('Unexpected response format from server');
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || defaultErrMsg);
  }
  return data;
}

export const api = {
  async validateUrl(url: string) {
    const res = await fetch('/api/rooms/validate-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return handleResponse(res, 'Failed to validate video URL');
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
    return handleResponse<CreateRoomResponse>(res, 'Failed to create watch room');
  },

  async getRoom(roomId: string) {
    const res = await fetch(`/api/rooms/${roomId}`);
    return handleResponse(res, 'Room not found or expired');
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
    return handleResponse<JoinRoomResponse>(res, 'Failed to join room');
  },

  async lockRoom(roomId: string, token: string, isLocked: boolean) {
    const res = await fetch(`/api/rooms/${roomId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, isLocked }),
    });
    return handleResponse(res, 'Failed to toggle room lock');
  },

  async kickMember(roomId: string, memberId: string, token: string) {
    const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res, 'Failed to remove member');
  },

  async upgradeRoom(roomId: string, token: string) {
    const res = await fetch('/api/billing/upgrade-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, token }),
    });
    return handleResponse(res, 'Failed to upgrade room');
  },

  async getSubscription(token: string) {
    const res = await fetch('/api/billing/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return handleResponse(res, 'Failed to fetch subscription');
  },

  async getCuratedDemos() {
    const res = await fetch('/api/rooms/curated/demos');
    return handleResponse(res, 'Failed to load curated video demos');
  },
};
