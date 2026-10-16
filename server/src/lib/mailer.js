import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const FROM = `"vpred.org" <${process.env.MAIL_USER}>`;
const BASE_URL = process.env.FRONTEND_URL || 'https://vpred.org';

export async function sendVerificationEmail(to, token) {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Verify your vpred.org email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:1.4rem;margin-bottom:8px">Verify your email</h2>
        <p style="color:#666;margin-bottom:24px">Click the button below to activate your vpred.org account. The link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Verify email address</a>
        <p style="color:#999;font-size:12px;margin-top:24px">Or copy this link: ${link}</p>
      </div>`,
    text: `Verify your vpred.org account:\n${link}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(to, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reset your vpred.org password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:1.4rem;margin-bottom:8px">Reset your password</h2>
        <p style="color:#666;margin-bottom:24px">Click the button below to set a new password. The link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#4f8ef7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a>
        <p style="color:#999;font-size:12px;margin-top:24px">Or copy this link: ${link}</p>
        <p style="color:#999;font-size:12px">If you did not request this, you can ignore this email.</p>
      </div>`,
    text: `Reset your vpred.org password:\n${link}\n\nThis link expires in 1 hour.`,
  });
}
