import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid, customAlphabet } from 'nanoid';

// Enforce strong secret; generate a secure random 256-bit key if unset
const JWT_SECRET: string = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security Error] JWT_SECRET environment variable must be set in production with at least 16 characters.');
  }
  // Generate cryptographically secure ephemeral secret for non-production environments
  return crypto.randomBytes(32).toString('hex');
})();

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
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch (err) {
    return null;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison of equal length to protect against length timing analysis
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
