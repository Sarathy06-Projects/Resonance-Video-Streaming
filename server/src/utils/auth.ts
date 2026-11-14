import jwt from 'jsonwebtoken';
import { nanoid, customAlphabet } from 'nanoid';

const JWT_SECRET = process.env.JWT_SECRET || 'together_secret_watch_party_key_2026';

// High-entropy, clean, user-friendly room codes: e.g. "a8k92x"
const generateRoomAlphabet = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 6);

export function generateRoomId(): string {
  return generateRoomAlphabet();
}

export function generateUserId(): string {
  return `usr_${nanoid(10)}`;
}

export const AVATAR_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export function getRandomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export interface SessionPayload {
  roomId: string;
  userId: string;
  name: string;
  role: 'host' | 'guest';
  color: string;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch (err) {
    return null;
  }
}
