import nodemailer from 'nodemailer';

// ─── Transport ────────────────────────────────────────────────────────────────
// Checks env vars at startup so Railway logs show immediately if something is missing.
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://vpred.org').replace(/\/$/, '');

if (!MAIL_USER || !MAIL_PASS) {
  console.warn('[mailer] WARNING: MAIL_USER or MAIL_PASS env var is not set. Emails will not be sent.');
}

function createTransport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,           // SSL, not STARTTLS
    auth: { user: MAIL_USER, pass: MAIL_PASS },
    connectionTimeout: 10000,   // 10s connect timeout
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function sendMail(to, subject, html) {
  if (!MAIL_USER || !MAIL_PASS) {
    console.error('[mailer] Cannot send email – MAIL_USER/MAIL_PASS not configured.');
    throw new Error('Email service is not configured on the server.');
  }
  const transport = createTransport();
  try {
    const info = await transport.sendMail({
      from: `"vpred.org" <${MAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[mailer] Email sent to', to, '| messageId:', info.messageId);
    return info;
  } catch (err) {
    console.error('[mailer] Failed to send email to', to, '| Error:', err.message);
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function sendVerificationEmail(to, token) {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  await sendMail(
    to,
    'Verify your vpred.org account',
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a2e">
      <h2 style="font-size:1.4rem;margin-bottom:8px">Verify your email address</h2>
      <p style="color:#666;margin-bottom:24px">Click the button below to activate your vpred.org account. This link expires in <strong>24 hours</strong>.</p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#863bff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Verify my account</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Or copy this URL into your browser:<br>${link}</p>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="font-size:11px;color:#bbb">vpred.org — Open Research Collective. If you did not register, you can safely ignore this email.</p>
    </body></html>`
  );
}

export async function sendPasswordResetEmail(to, token) {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail(
    to,
    'Reset your vpred.org password',
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#1a1a2e">
      <h2 style="font-size:1.4rem;margin-bottom:8px">Reset your password</h2>
      <p style="color:#666;margin-bottom:24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#863bff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
      <p style="margin-top:24px;font-size:12px;color:#999">Or copy this URL into your browser:<br>${link}</p>
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
      <p style="font-size:11px;color:#bbb">vpred.org — Open Research Collective. If you did not request this, you can safely ignore this email.</p>
    </body></html>`
  );
}
