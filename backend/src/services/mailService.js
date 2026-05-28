const nodemailer = require('nodemailer');

let cachedTransporter = null;

function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

async function sendCollaboratorInvite({ collaborator, document, inviter }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`Email invite skipped for ${collaborator.email}: SMTP is not configured.`);
    return { skipped: true };
  }

  const appUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const inviteUrl = `${appUrl}/dashboard?document=${document._id}`;
  const inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email || 'A DocuWise user';
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: collaborator.email,
    subject: `${inviterName} invited you to collaborate on ${document.originalName}`,
    text: [
      `Hi ${collaborator.name},`,
      '',
      `${inviterName} invited you to collaborate on "${document.originalName}" as ${collaborator.role}.`,
      `Open DocuWise: ${inviteUrl}`,
      '',
      'If you do not have an account yet, sign up using this email address to access the document.',
    ].join('\n'),
    html: `
      <p>Hi ${escapeHtml(collaborator.name)},</p>
      <p>${escapeHtml(inviterName)} invited you to collaborate on <strong>${escapeHtml(document.originalName)}</strong> as <strong>${escapeHtml(collaborator.role)}</strong>.</p>
      <p><a href="${inviteUrl}">Open DocuWise</a></p>
      <p>If you do not have an account yet, sign up using this email address to access the document.</p>
    `,
  });

  return { sent: true };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  isMailConfigured,
  sendCollaboratorInvite,
};
