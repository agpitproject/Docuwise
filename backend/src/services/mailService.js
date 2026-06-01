const nodemailer = require('nodemailer');

let cachedTransporter = null;

function envValue(name) {
  return String(process.env[name] || '').trim();
}

function isMailConfigured() {
  return Boolean(
    envValue('SMTP_HOST') &&
    envValue('SMTP_PORT') &&
    envValue('SMTP_USER') &&
    envValue('SMTP_PASS')
  );
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: envValue('SMTP_HOST'),
    port: Number(envValue('SMTP_PORT')),
    secure: envValue('SMTP_SECURE').toLowerCase() === 'true',
    auth: {
      user: envValue('SMTP_USER'),
      pass: envValue('SMTP_PASS'),
    },
  });

  return cachedTransporter;
}

async function sendCollaboratorInvite({ collaborator, document, inviter }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`Email invite skipped for ${collaborator.email}: SMTP is not configured.`);
    return { skipped: true, reason: 'SMTP is not configured' };
  }

  const appUrl = (envValue('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
  const inviteUrl = `${appUrl}/dashboard?document=${document._id}`;
  const inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email || 'A DocuWise user';
  const from = envValue('MAIL_FROM') || envValue('SMTP_USER');

  const info = await transporter.sendMail({
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

  return {
    sent: true,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
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
