const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporterPromise;

// In development, when no real SMTP is configured, spin up a free Ethereal
// inbox so emails can still be sent and previewed without any setup.
function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (env.email.host) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: env.email.host,
        port: env.email.port,
        secure: env.email.port === 465,
        auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined
      })
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((testAccount) =>
      nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      })
    );
  }

  return transporterPromise;
}

async function sendEmail({ to, subject, html }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: env.email.from, to, subject, html });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Preview email (${subject}) for ${to}: ${previewUrl}`);
  }

  return info;
}

function sendVerificationEmail(user, rawToken) {
  const verifyUrl = `${env.clientUrl}/api/auth/verify-email/${rawToken}`;
  return sendEmail({
    to: user.email,
    subject: 'Verify your email',
    html: `<p>Hi ${user.username},</p><p>Verify your email by visiting: <a href="${verifyUrl}">${verifyUrl}</a></p>`
  });
}

function sendPasswordResetEmail(user, rawToken) {
  const resetUrl = `${env.clientUrl}/api/auth/reset-password/${rawToken}`;
  return sendEmail({
    to: user.email,
    subject: 'Reset your password',
    html: `<p>Hi ${user.username},</p><p>Reset your password by visiting: <a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`
  });
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
