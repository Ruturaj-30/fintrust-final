// =====================================================================
//  Email: sign-in codes, invitations and password reset links.
//  EMAIL_MODE=console -> printed in the terminal (default)
//  EMAIL_MODE=gmail   -> Gmail SMTP with an App Password (laptop only)
//  EMAIL_MODE=brevo   -> Brevo HTTPS API (works on Render free plan)
// =====================================================================
const { config } = require('./config');

class MailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MailError';
  }
}

let gmailTransport = null;
function gmail() {
  if (!gmailTransport) {
    const nodemailer = require('nodemailer');
    gmailTransport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.gmailUser, pass: config.gmailAppPassword },
    });
  }
  return gmailTransport;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1d2433">
  <div style="max-width:520px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e3e7ef">
    <div style="background:#0b2a5b;color:#fff;padding:16px 22px;font-weight:600;font-size:17px">FinTrust Bank Ltd. &middot; IAM</div>
    <div style="padding:22px">
      <h2 style="margin:0 0 12px;font-size:19px">${esc(title)}</h2>
      ${bodyHtml}
      <p style="color:#6b7385;font-size:12px;margin-top:24px">This is a college demonstration project. FinTrust Bank Ltd. is fictional.
      If you did not expect this email, you can ignore it.</p>
    </div>
  </div></body></html>`;
}

async function send({ to, subject, text, html }) {
  if (config.emailMode === 'console') {
    const line = '─'.repeat(62);
    console.log(`\n┌${line}\n│ ✉  EMAIL (console mode, not really sent)\n│ To:      ${to}\n│ Subject: ${subject}\n│\n${text.split('\n').map((l) => `│ ${l}`).join('\n')}\n└${line}\n`);
    return { delivered: 'console' };
  }
  if (config.emailMode === 'gmail') {
    try {
      await gmail().sendMail({ from: `"${config.mailFromName}" <${config.gmailUser}>`, to, subject, text, html });
      return { delivered: 'gmail' };
    } catch (err) {
      console.error(`[email] Gmail failed: ${err.code || ''} ${err.message}`);
      if (err.code === 'EAUTH') throw new MailError('Gmail rejected the login. Create a new App Password and put it in .env (no spaces).');
      throw new MailError('The email could not be sent through Gmail. See the server terminal for details.');
    }
  }
  if (config.emailMode === 'brevo') {
    let res;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.brevoApiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: config.mailFromName, email: config.mailFrom },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      console.error(`[email] Brevo unreachable: ${err.message}`);
      throw new MailError('The email service could not be reached. Please try again.');
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Brevo error ${res.status}: ${body.slice(0, 300)}`);
      throw new MailError(res.status === 401
        ? 'Brevo rejected the API key. Check BREVO_API_KEY.'
        : 'The email service refused the message. Check that MAIL_FROM is a verified sender in Brevo.');
    }
    return { delivered: 'brevo' };
  }
  throw new MailError('EMAIL_MODE is not set correctly.');
}

function sendCode(user, code, minutes) {
  return send({
    to: user.email,
    subject: `${code} is your FinTrust sign-in code`,
    text: `Hello ${user.full_name},\n\nYour FinTrust sign-in code is: ${code}\nIt expires in ${minutes} minutes and can be used once.\n\nNever share this code. Bank staff will never ask for it.`,
    html: layout('Your sign-in code', `<p>Hello ${esc(user.full_name)},</p>
      <p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:18px 0">${esc(code)}</p>
      <p>It expires in ${minutes} minutes and can be used once. Never share this code.</p>`),
  });
}

function sendInvite(user, link, hours, invitedBy) {
  return send({
    to: user.email,
    subject: 'You are invited to FinTrust Bank IAM',
    text: `Hello ${user.full_name},\n\n${invitedBy} has created your FinTrust Bank account (${user.role}).\nSet your password here (valid ${hours} hours, one use only):\n${link}`,
    html: layout('Welcome to FinTrust Bank', `<p>Hello ${esc(user.full_name)},</p>
      <p>${esc(invitedBy)} has created your account with the role <b>${esc(user.role)}</b>.</p>
      <p><a href="${esc(link)}" style="display:inline-block;background:#0b2a5b;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none">Set my password</a></p>
      <p style="font-size:13px;color:#555">The link is valid for ${hours} hours and works once.</p>`),
  });
}

function sendReset(user, link, minutes) {
  return send({
    to: user.email,
    subject: 'Reset your FinTrust password',
    text: `Hello ${user.full_name},\n\nA password reset was requested for your FinTrust account.\nChoose a new password here (valid ${minutes} minutes, one use only):\n${link}\n\nIf this wasn't you, ignore this email and tell IT Helpdesk.`,
    html: layout('Reset your password', `<p>Hello ${esc(user.full_name)},</p>
      <p>A password reset was requested for your account.</p>
      <p><a href="${esc(link)}" style="display:inline-block;background:#0b2a5b;color:#fff;padding:11px 18px;border-radius:6px;text-decoration:none">Choose a new password</a></p>
      <p style="font-size:13px;color:#555">Valid for ${minutes} minutes, one use only. If this wasn't you, ignore this email.</p>`),
  });
}

module.exports = { send, sendCode, sendInvite, sendReset, MailError };
