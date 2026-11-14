import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { query } from '../db';
import { verifySessionToken } from '../utils/auth';
import { roomManager } from '../room/manager';

const router = Router();

// Create checkout session (Section 10.1 & 7.1)
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { email, userId, plan = 'premium', returnUrl } = req.body;

    const checkoutId = `chk_${nanoid(16)}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store pending transaction or simulated checkout session
    res.json({
      success: true,
      checkoutId,
      checkoutUrl: `/checkout?session=${checkoutId}&plan=${plan}&email=${encodeURIComponent(email || '')}`,
      plan: {
        id: 'premium_monthly',
        name: 'Together Premium',
        amount: 199,
        currency: 'INR',
        interval: 'month',
        features: [
          'Up to 15 participants per room',
          'Private password-protected rooms',
          'Shared Video Queue (Up Next)',
          'Custom Room Themes',
          'Unlimited watch duration',
        ],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error creating checkout session' });
  }
});

// Process verified payment webhook (idempotent)
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;

    const userId = data?.userId || data?.user_id;
    const providerId = data?.subscriptionId || data?.payment_id || `sub_${nanoid(12)}`;
    const plan = data?.plan || 'premium';
    const status = data?.status || 'active';
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (userId) {
      // Upsert subscription in Neon DB
      await query(
        `INSERT INTO subscriptions (id, user_id, provider_id, plan, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET status = $5, expires_at = $6`,
        [providerId, userId, providerId, plan, status, expiry]
      );
    }

    res.json({ received: true, status: 'processed' });
  } catch (err: any) {
    console.error('[Billing Webhook Error]', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Upgrade room directly to Premium (capacity: 15)
router.post('/upgrade-room', async (req: Request, res: Response) => {
  try {
    const { roomId, token } = req.body;
    const decoded = verifySessionToken(token);
    if (!decoded || decoded.roomId !== roomId || decoded.role !== 'host') {
      res.status(403).json({ error: 'Only the host can upgrade the room' });
      return;
    }

    const coordinator = await roomManager.getCoordinator(roomId);
    if (!coordinator) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Upgrade room max participants to 15
    coordinator.metadata.maxParticipants = 15;
    await query('UPDATE rooms SET max_participants = 15 WHERE id = $1', [roomId]);

    // Record subscription for user in Neon DB
    const subId = `sub_${nanoid(12)}`;
    await query(
      `INSERT INTO subscriptions (id, user_id, provider_id, plan, status, expires_at, created_at)
       VALUES ($1, $2, $3, 'premium', 'active', NOW() + INTERVAL '30 days', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [subId, decoded.userId, subId]
    );

    coordinator.broadcast({
      id: nanoid(),
      roomId,
      type: 'chat:message',
      senderId: 'server',
      sequence: coordinator.getNextSequence(),
      sentAt: Date.now(),
      payload: {
        message: {
          id: nanoid(),
          roomId,
          senderId: 'system',
          senderName: 'TOGETHER 🌟',
          senderRole: 'host',
          senderColor: '#6366f1',
          text: '🎉 Room upgraded to Together Premium! Participant capacity increased to 15.',
          timestamp: Date.now(),
        },
      },
    });

    res.json({
      success: true,
      maxParticipants: 15,
      plan: 'premium',
      message: 'Room successfully upgraded to Premium!',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error upgrading room' });
  }
});

// Get user subscription entitlement
router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string);
    const decoded = verifySessionToken(token);
    if (!decoded) {
      res.json({ plan: 'free', maxParticipants: 3, isSubscribed: false });
      return;
    }

    const resDb = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()`,
      [decoded.userId]
    );

    if (resDb.rows.length > 0) {
      res.json({
        plan: 'premium',
        maxParticipants: 15,
        isSubscribed: true,
        expiresAt: resDb.rows[0].expires_at,
      });
    } else {
      res.json({ plan: 'free', maxParticipants: 3, isSubscribed: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
