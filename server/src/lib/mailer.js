import nodemailer from 'nodemailer';

const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://vpred.org').replace(/\/$/, '');

if (!MAIL_USER || !MAIL_PASS) {
  console.warn('[mailer] WARNING: MAIL_USER or MAIL_PASS env var is not set. Emails will not be sent.');
} else {
  console.log('[mailer] Configured for:', MAIL_USER, '| Frontend:', FRONTEND_URL);
}

// Railway blocks port 465 (SSL) on some plans — use port 587 (STARTTLS) instead
function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,        // STARTTLS (not SSL) — more reliable on Railway
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

async function sendMail(to, subject, html) {
  if (!MAIL_USER || !MAIL_PASS) {
    const msg = 'Email service not configured (MAIL_USER/MAIL_PASS missing).';
    console.error('[mailer]', msg);
    throw new Error(msg);
  }

  const transport = createTransport();
  console.log('[mailer] Sending to:', to, '| Subject:', subject);

  try {
    const info = await transport.sendMail({
      from: `"vpred.org" <${MAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[mailer] ✓ Sent! messageId:', info.messageId);
    return info;
  } catch (err) {
    console.error('[mailer] ✗ SMTP error:', err.code, err.message);
    throw err;
  }
}

export async function sendVerificationEmail(to, token) {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  return sendMail(
    to,
    'Verify your vpred.org account',
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a2e">
      <h2 style="font-size:1.4rem;margin-bottom:8px">Verify your email address</h2>
      <p style="color:#666;margin-bottom:24px">Click the button below to activate your vpred.org account. This link expires in <strong>24 hours</strong>.</p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify my account</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Or copy this URL:<br><a href="${link}" style="color:#4f8ef7">${link}</a></p>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="font-size:11px;color:#bbb">vpred.org — Open Research Collective. If you did not register, ignore this email.</p>
    </body></html>`
  );
}

export async function sendPasswordResetEmail(to, token) {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  return sendMail(
    to,
    'Reset your vpred.org password',
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a2e">
      <h2 style="font-size:1.4rem;margin-bottom:8px">Reset your password</h2>
      <p style="color:#666;margin-bottom:24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Or copy this URL:<br><a href="${link}" style="color:#4f8ef7">${link}</a></p>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="font-size:11px;color:#bbb">vpred.org — Open Research Collective. If you did not request this, ignore this email.</p>
    </body></html>`
  );
}

// Exported for the debug endpoint
export async function testMailConnection(to) {
  return sendMail(to, 'vpred.org SMTP test', '<p>If you receive this, SMTP is working correctly.</p>');
}
