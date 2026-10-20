import express from 'express';
import crypto from 'crypto';
import { query as pool } from '../db/client.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;
const NOWPAYMENTS_API = 'https://api.nowpayments.io/v1';

const MIN_EUR = 5.0;

// ─── GET /api/donate/currencies ──────────────────────────────────────────────
router.get('/currencies', async (req, res) => {
  try {
    const r = await fetch(`${NOWPAYMENTS_API}/currencies`, {
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY },
    });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch currencies' });
  }
});

// ─── POST /api/donate/create-payment ─────────────────────────────────────────
router.post('/create-payment', optionalAuth, async (req, res) => {
  try {
    const { amount_eur, pay_currency } = req.body;
    const userId = req.user?.id || null;

    // Validate amount
    const eur = parseFloat(amount_eur);
    if (isNaN(eur) || eur < MIN_EUR) {
      return res.status(400).json({ error: `Minimum donation is €${MIN_EUR}` });
    }

    // Validate currency
    if (!pay_currency || typeof pay_currency !== 'string') {
      return res.status(400).json({ error: 'Currency is required' });
    }

    // Create payment at NowPayments
    const orderDesc = userId ? `Vpred donation by user ${userId}` : 'Vpred anonymous donation';
    const ipnCallbackUrl = `${process.env.BACKEND_URL || 'https://vpred-oxfv.onrender.com'}/api/donate/webhook`;

    const npRes = await fetch(`${NOWPAYMENTS_API}/payment`, {
      method: 'POST',
      headers: {
        'x-api-key': NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: eur,
        price_currency: 'eur',
        pay_currency: pay_currency.toLowerCase(),
        order_description: orderDesc,
        ipn_callback_url: ipnCallbackUrl,
      }),
    });

    const npData = await npRes.json();

    if (!npRes.ok || !npData.payment_id) {
      console.error('NowPayments error:', npData);
      return res.status(502).json({ error: npData.message || 'Payment creation failed' });
    }

    // Store in donations table
    await pool(
      `INSERT INTO donations (user_id, payment_id, payment_status, pay_currency, price_amount, price_currency, order_description)
       VALUES ($1, $2, $3, $4, $5, 'EUR', $6)`,
      [userId, npData.payment_id, npData.payment_status, pay_currency, eur, orderDesc]
    );

    res.json({
      payment_id: npData.payment_id,
      payment_status: npData.payment_status,
      pay_address: npData.pay_address,
      pay_amount: npData.pay_amount,
      pay_currency: npData.pay_currency,
      invoice_url: npData.invoice_url || null,
    });
  } catch (err) {
    console.error('create-payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/donate/status/:paymentId ───────────────────────────────────────
router.get('/status/:paymentId', optionalAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const { rows } = await pool(
      'SELECT * FROM donations WHERE payment_id = $1',
      [paymentId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const donation = rows[0];

    // Also fetch live status from NowPayments
    const npRes = await fetch(`${NOWPAYMENTS_API}/payment/${paymentId}`, {
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY },
    });
    const npData = await npRes.json();

    res.json({
      payment_id: paymentId,
      status: npData.payment_status || donation.payment_status,
      pay_currency: donation.pay_currency,
      price_amount: donation.price_amount,
      created_at: donation.created_at,
    });
  } catch (err) {
    console.error('status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/donate/webhook (IPN) ──────────────────────────────────────────
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const sig = req.headers['x-nowpayments-sig'];
    if (!sig) {
      console.warn('IPN: missing signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const body = req.body;
    const sortedBody = JSON.stringify(sortObject(body));
    const hmac = crypto
      .createHmac('sha512', NOWPAYMENTS_IPN_SECRET)
      .update(sortedBody)
      .digest('hex');

    if (hmac !== sig) {
      console.warn('IPN: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { payment_id, payment_status, pay_amount, actually_paid } = body;

    if (!payment_id) {
      return res.status(400).json({ error: 'Missing payment_id' });
    }

    const { rows } = await pool(
      `UPDATE donations
       SET payment_status = $1,
           pay_amount = $2,
           actually_paid = $3,
           ipn_received_at = NOW(),
           updated_at = NOW()
       WHERE payment_id = $4
       RETURNING *`,
      [payment_status, pay_amount, actually_paid || 0, payment_id]
    );

    if (!rows.length) {
      console.warn('IPN: unknown payment_id', payment_id);
      return res.status(404).json({ error: 'Payment not found' });
    }

    const donation = rows[0];

    // If finished/confirmed AND user is known → grant donator badge
    if (['finished', 'confirmed'].includes(payment_status) && donation.user_id) {
      await pool(
        `UPDATE users
         SET is_donator = TRUE,
             donated_at = NOW()
         WHERE id = $1`,
        [donation.user_id]
      );
      console.log(`IPN: Donator badge granted to user ${donation.user_id}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/donate/set-color ───────────────────────────────────────────────
// Allows donators to set any hex color for their username
router.post('/set-color', requireAuth, async (req, res) => {
  try {
    const { color } = req.body;

    // Accept any valid 6-digit hex color
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color. Must be a valid hex color like #7B2FBE' });
    }

    // Only donators can change color
    const { rows } = await pool('SELECT is_donator FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_donator) {
      return res.status(403).json({ error: 'You are not a donator' });
    }

    await pool(
      'UPDATE users SET donator_color = $1 WHERE id = $2',
      [color, req.user.id]
    );

    res.json({ ok: true, donator_color: color });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: sort object keys recursively (for IPN sig verification)
function sortObject(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = sortObject(obj[key]);
    return acc;
  }, {});
}

export default router;
