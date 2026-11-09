// =====================================================================
//  Sign-in (password + 6-digit email code), sign-out, password reset,
//  invitation acceptance and password change.
// =====================================================================
const crypto = require('crypto');
const express = require('express');
const store = require('../store');
const { config } = require('../config');
const sec = require('../security');
const mailer = require('../mailer');
const audit = require('../audit');
const tokens = require('../tokens');
const { getPolicies, getOrganization } = require('../policies');
const { permissionsFor, navFor } = require('../rbac');
const mw = require('../middleware');

const router = express.Router();
const { wrap, HttpError } = mw;

// Sign-in codes live only in memory. If the server restarts, just sign in again.
const challenges = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of challenges) if (c.expiresAt < now - 600000) challenges.delete(id);
}, 60000).unref();

const loginLimit = mw.rateLimit({ name: 'login', windowMs: 15 * 60000, max: 10, keyFn: (r) => String(r.body && r.body.email).toLowerCase() });
const ipLimit = mw.rateLimit({ name: 'auth-ip', windowMs: 15 * 60000, max: 200 });
const codeLimit = mw.rateLimit({ name: 'code', windowMs: 15 * 60000, max: 30 });
const forgotLimit = mw.rateLimit({ name: 'forgot', windowMs: 60 * 60000, max: 5 });

const minutesLeft = (iso) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));

async function issueCode(user, challenge) {
  const p = getPolicies();
  const code = sec.generateCode();
  challenge.codeHash = sec.hashCode(challenge.id, code);
  challenge.expiresAt = Date.now() + p.otp_expiry_minutes * 60000;
  challenge.lastSentAt = Date.now();
  challenge.sends += 1;
  await mailer.sendCode(user, code, p.otp_expiry_minutes);
  return code;
}

// ---------------------------------------------------------------------
// Step 1: email + password
// ---------------------------------------------------------------------
router.post('/login', ipLimit, loginLimit, wrap(async (req, res) => {
  const email = sec.normalizeEmail(req.body.email);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Enter your email and password.');

  const p = getPolicies();
  let user = store.findOne('users', (u) => u.email === email);

  if (user && user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    await sec.checkPassword(password, null); // same timing as a normal attempt
    await audit.record(req, { action: 'Sign-in blocked (account locked)', category: 'security', outcome: 'denied', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });
    throw new HttpError(423, `This account is locked after too many wrong passwords. Try again in ${minutesLeft(user.locked_until)} minutes, or ask IT Helpdesk to unlock it.`);
  }

  const ok = await sec.checkPassword(password, user && user.password_hash);
  if (!ok) {
    if (user) {
      const failed = (user.failed_logins || 0) + 1;
      const lock = failed >= p.max_failed_logins;
      user = await store.update('users', user.id, {
        failed_logins: lock ? 0 : failed,
        locked_until: lock ? new Date(Date.now() + p.lockout_minutes * 60000).toISOString() : user.locked_until,
      });
      await audit.record(req, {
        action: lock ? 'Account locked (too many wrong passwords)' : 'Sign-in failed (wrong password)',
        category: 'security', outcome: 'failure', actor: user,
        target: { type: 'user', id: user.id, label: user.full_name },
        details: { attempt: lock ? p.max_failed_logins : failed, limit: p.max_failed_logins },
      });
      if (lock) throw new HttpError(423, `Too many wrong passwords. This account is locked for ${p.lockout_minutes} minutes.`);
    } else {
      await audit.record(req, { action: 'Sign-in failed (unknown email)', category: 'security', outcome: 'failure', details: { email: sec.maskEmail(email) } });
    }
    throw new HttpError(401, 'Email or password is incorrect.');
  }

  // Correct password. Now check the account status.
  if (user.status === 'invited') throw new HttpError(403, 'Please finish setting up your account using the invitation link in your email.');
  if (user.status !== 'active') {
    await audit.record(req, { action: `Sign-in refused (account ${user.status})`, category: 'security', outcome: 'denied', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });
    throw new HttpError(403, `This account is ${user.status}. Contact the System Administrator.`);
  }
  if (user.failed_logins) await store.update('users', user.id, { failed_logins: 0 });

  const challenge = { id: crypto.randomUUID(), userId: user.id, attempts: 0, sends: 0, used: false, ip: req.ip };
  const code = await issueCode(user, challenge);
  challenges.set(challenge.id, challenge);
  await audit.record(req, { action: 'Password accepted, sign-in code sent', category: 'auth', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });

  res.json({
    challengeId: challenge.id,
    sentTo: sec.maskEmail(user.email),
    expiresInMinutes: p.otp_expiry_minutes,
    emailMode: config.emailMode,
    demoCode: config.demoMode ? code : undefined,
  });
}));

// ---------------------------------------------------------------------
// Step 2: the 6-digit code
// ---------------------------------------------------------------------
router.post('/verify', ipLimit, codeLimit, wrap(async (req, res) => {
  const { challengeId } = req.body;
  const code = String(req.body.code || '').replace(/\s+/g, '');
  const c = typeof challengeId === 'string' ? challenges.get(challengeId) : null;
  if (!c || c.used) throw new HttpError(400, 'This sign-in attempt is no longer valid. Please sign in again.');
  const user = store.get('users', c.userId);
  if (!user || user.status !== 'active') throw new HttpError(400, 'Please sign in again.');
  const p = getPolicies();
  if (Date.now() > c.expiresAt) throw new HttpError(400, 'The code has expired. Press "Send a new code".');
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.');

  if (!sec.safeEqual(sec.hashCode(c.id, code), c.codeHash)) {
    c.attempts += 1;
    const left = p.otp_max_attempts - c.attempts;
    await audit.record(req, { action: 'Wrong sign-in code', category: 'security', outcome: 'failure', actor: user, target: { type: 'user', id: user.id, label: user.full_name }, details: { attempt: c.attempts } });
    if (left <= 0) {
      c.used = true;
      throw new HttpError(400, 'Too many wrong codes. Please sign in again.');
    }
    throw new HttpError(400, `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }

  c.used = true; // a code works only once
  challenges.delete(c.id);
  const now = new Date().toISOString();
  await store.update('users', user.id, { last_login_at: now, failed_logins: 0 });
  mw.createSession(req, res, user);
  await audit.record(req, { action: 'Signed in (password + email code)', category: 'auth', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });
  res.json({ ok: true });
}));

router.post('/resend', ipLimit, codeLimit, wrap(async (req, res) => {
  const c = typeof req.body.challengeId === 'string' ? challenges.get(req.body.challengeId) : null;
  if (!c || c.used) throw new HttpError(400, 'Please sign in again.');
  const wait = 30 - Math.floor((Date.now() - c.lastSentAt) / 1000);
  if (wait > 0) throw new HttpError(429, `Please wait ${wait} seconds before asking for a new code.`);
  if (c.sends >= 3) throw new HttpError(429, 'Too many codes requested. Please sign in again.');
  const user = store.get('users', c.userId);
  if (!user || user.status !== 'active') throw new HttpError(400, 'Please sign in again.');
  const code = await issueCode(user, c);
  await audit.record(req, { action: 'New sign-in code sent', category: 'auth', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });
  res.json({ ok: true, demoCode: config.demoMode ? code : undefined });
}));

// ---------------------------------------------------------------------
// Demo accounts list for the sign-in page (only on your laptop, or in demo mode)
// ---------------------------------------------------------------------
router.get('/demo-accounts', (req, res) => {
  if (config.isProduction && !config.demoMode) return res.json({ accounts: [] });
  const order = ['System Administrator', 'Access Manager', 'IT Helpdesk', 'Auditor', 'Employee'];
  const accounts = order.map((role) => store.find('users', (u) => u.role === role && u.status === 'active' && u.password_hash)
    .sort((a, b) => a.employee_id.localeCompare(b.employee_id))[0])
    .filter(Boolean)
    .map((u) => ({ role: u.role, name: u.full_name, email: u.email }));
  res.json({ accounts, passwordHint: config.isProduction ? null : config.demoPassword });
});

// ---------------------------------------------------------------------
// Session info and sign-out
// ---------------------------------------------------------------------
// Used by the sign-in page: answers 200 either way, so the browser console stays clean.
router.get('/session', (req, res) => res.json({ signedIn: Boolean(req.user) }));

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: req.sessionExpired ? 'Your session expired. Please sign in again.' : 'Please sign in.' });
  const branch = store.get('branches', req.user.branch_id);
  const manager = req.user.manager_id ? store.get('users', req.user.manager_id) : null;
  res.json({
    user: { ...req.user, branch_name: branch ? `${branch.name}, ${branch.city}` : '', manager_name: manager ? manager.full_name : '' },
    permissions: permissionsFor(req.user.role),
    nav: navFor(req.user.role),
    organization: getOrganization().name || 'FinTrust Bank Ltd.',
    idleMinutes: getPolicies().session_idle_minutes,
    demoMode: config.demoMode,
    photoRequired: !require('./photos').hasPhoto(req.user.id),
    pendingApprovals: permissionsFor(req.user.role).includes('access.review')
      ? store.count('access_requests', (r) => r.status === 'pending' && r.user_id !== req.user.id) : 0,
  });
});

router.post('/logout', wrap(async (req, res) => {
  if (req.user) await audit.record(req, { action: 'Signed out', category: 'auth', target: { type: 'user', id: req.user.id, label: req.user.full_name } });
  mw.destroySession(req, res);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------
// Forgot password -> reset link (same answer whether or not the email exists)
// ---------------------------------------------------------------------
router.post('/forgot', ipLimit, forgotLimit, wrap(async (req, res) => {
  const email = sec.normalizeEmail(req.body.email);
  if (!email) throw new HttpError(400, 'Enter a valid email address.');
  const user = store.findOne('users', (u) => u.email === email);
  let demoLink;
  if (user && user.status === 'active') {
    const link = await tokens.createLink(req, user, 'reset', null);
    const p = getPolicies();
    try {
      await mailer.sendReset(user, link, p.reset_expiry_minutes);
    } catch (err) {
      console.error(`[email] reset email failed: ${err.message}`);
    }
    if (config.demoMode) demoLink = link;
    await audit.record(req, { action: 'Password reset requested', category: 'security', actor: user, target: { type: 'user', id: user.id, label: user.full_name } });
  }
  res.json({ ok: true, message: 'If that email belongs to an active account, a reset link has been sent.', demoLink });
}));

// ---------------------------------------------------------------------
// Invitation / reset link pages
// ---------------------------------------------------------------------
router.post('/link-info', ipLimit, (req, res) => {
  const found = tokens.findValid(req.body.token);
  if (found.error) return res.status(400).json({ error: found.error });
  const { user, token } = found;
  res.json({
    type: token.type,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    minLength: getPolicies().password_min_length,
  });
});

router.post('/set-password', ipLimit, wrap(async (req, res) => {
  const found = tokens.findValid(req.body.token);
  if (found.error) throw new HttpError(400, found.error);
  const { user, token } = found;
  const p = getPolicies();
  const problem = sec.passwordProblem(req.body.password, p.password_min_length, user);
  if (problem) throw new HttpError(400, problem);
  const now = new Date().toISOString();
  await store.update('user_tokens', token.id, { used_at: now });
  await store.update('users', user.id, {
    password_hash: await sec.hashPassword(req.body.password),
    password_changed_at: now,
    status: user.status === 'invited' ? 'active' : user.status,
    activated_at: user.status === 'invited' ? now : user.activated_at || null,
    failed_logins: 0,
    locked_until: null,
    updated_at: now,
  });
  mw.revokeUserSessions(user.id);
  await audit.record(req, {
    action: token.type === 'invite' ? 'Invitation accepted, account activated' : 'Password reset completed',
    category: token.type === 'invite' ? 'account' : 'security',
    actor: user,
    target: { type: 'user', id: user.id, label: user.full_name },
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------
// Change own password (signed in)
// ---------------------------------------------------------------------
router.post('/change-password', mw.requireAuth, ipLimit, wrap(async (req, res) => {
  const user = store.get('users', req.user.id);
  const ok = await sec.checkPassword(req.body.currentPassword, user.password_hash);
  if (!ok) {
    await audit.record(req, { action: 'Password change failed (wrong current password)', category: 'security', outcome: 'failure', target: { type: 'user', id: user.id, label: user.full_name } });
    throw new HttpError(400, 'Your current password is not correct.');
  }
  if (req.body.currentPassword === req.body.newPassword) throw new HttpError(400, 'The new password must be different.');
  const problem = sec.passwordProblem(req.body.newPassword, getPolicies().password_min_length, user);
  if (problem) throw new HttpError(400, problem);
  const now = new Date().toISOString();
  await store.update('users', user.id, { password_hash: await sec.hashPassword(req.body.newPassword), password_changed_at: now, updated_at: now });
  // Sign out every session (other devices too), then give this browser a fresh one.
  mw.revokeUserSessions(user.id);
  mw.createSession(req, res, user);
  await audit.record(req, { action: 'Password changed', category: 'security', target: { type: 'user', id: user.id, label: user.full_name } });
  res.json({ ok: true });
}));

module.exports = { router, challenges };
