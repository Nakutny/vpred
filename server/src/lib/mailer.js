import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // Gmail App Password
  },
});

const FROM = `"vpred.org" <${process.env.MAIL_USER}>`;
const BASE_URL = process.env.FRONTEND_URL || 'https://vpred.org';

export async function sendVerificationEmail(to, token) {
  const url = `${BASE_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your vpred.org email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Welcome to vpred.org</h2>
        <p style="color:#555;margin-bottom:24px">Please verify your email address to activate your account.</p>
        <a href="${url}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
        <p style="color:#bbb;font-size:11px;margin-top:8px">
          If the button doesn't work, copy this URL: ${url}
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your vpred.org password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Password Reset</h2>
        <p style="color:#555;margin-bottom:24px">We received a request to reset your password. Click the button below to choose a new one.</p>
        <a href="${url}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          This link expires in 1 hour. If you didn't request a reset, ignore this email.
        </p>
        <p style="color:#bbb;font-size:11px;margin-top:8px">
          If the button doesn't work, copy this URL: ${url}
        </p>
      </div>
    `,
  });
}
