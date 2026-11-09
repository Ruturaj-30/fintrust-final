// =====================================================================
//  Staff accounts: directory, invitations (joiners), role and detail
//  changes (movers), suspend / disable (leavers), unlock and resets.
// =====================================================================
const express = require('express');
const store = require('../store');
const { config } = require('../config');
const sec = require('../security');
const mailer = require('../mailer');
const audit = require('../audit');
const tokens = require('../tokens');
const { getPolicies } = require('../policies');
const rbac = require('../rbac');
const mw = require('../middleware');

const router = express.Router();
const { wrap, HttpError, requirePermission: need } = mw;

const STATUSES = ['invited', 'active', 'suspended', 'disabled'];
const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const label = (u) => ({ type: 'user', id: u.id, label: `${u.full_name} (${u.employee_id})` });

function decorate(u) {
  const branch = store.get('branches', u.branch_id);
  const manager = u.manager_id ? store.get('users', u.manager_id) : null;
  return {
    ...mw.publicUser(u),
    branch_name: branch ? `${branch.name}, ${branch.city}` : '',
    branch_city: branch ? branch.city : '',
    manager_name: manager ? manager.full_name : '',
    active_access: store.count('access_grants', (g) => g.user_id === u.id && g.status === 'active'),
    signed_in_now: mw.activeSessionsFor(u.id).length > 0,
  };
}

function loadUser(id) {
  const u = typeof id === 'string' ? store.get('users', id) : null;
  if (!u) throw new HttpError(404, 'Staff member not found.');
  return u;
}

function activeAdmins() {
  return store.count('users', (u) => u.role === rbac.ADMIN && u.status === 'active');
}

// Validates department / branch / manager values sent by the browser.
function cleanDetails(body, { partial } = {}) {
  const out = {};
  if (!partial || body.department !== undefined) {
    const d = str(body.department, 80);
    if (!store.findOne('departments', (x) => x.name === d)) throw new HttpError(400, 'Choose a valid department.');
    out.department = d;
  }
  if (!partial || body.branch_id !== undefined) {
    if (!store.get('branches', str(body.branch_id, 20))) throw new HttpError(400, 'Choose a valid branch.');
    out.branch_id = str(body.branch_id, 20);
  }
  if (!partial || body.designation !== undefined) {
    out.designation = str(body.designation, 80);
    if (!out.designation) throw new HttpError(400, 'Enter a designation (job title).');
  }
  if (!partial || body.manager_id !== undefined) {
    const m = str(body.manager_id, 60);
    if (m && !store.get('users', m)) throw new HttpError(400, 'Choose a valid reporting manager.');
    out.manager_id = m || null;
  }
  if (!partial || body.phone !== undefined) {
    const phone = str(body.phone, 20).replace(/[\s-]/g, '');
    if (phone && !/^(\+91)?[6-9]\d{9}$/.test(phone)) throw new HttpError(400, 'Enter a valid Indian mobile number, e.g. +91 98200 12345.');
    out.phone = phone ? `+91 ${phone.slice(-10, -5)} ${phone.slice(-5)}` : '';
  }
  return out;
}

function nextEmployeeId() {
  const nums = store.all('users').map((u) => Number(String(u.employee_id).replace(/\D/g, '')) || 0);
  return `FTB${String(Math.max(10000, ...nums) + 1)}`;
}

// ---------------------------------------------------------------------
// Lists used by forms (departments, branches, roles, applications)
// ---------------------------------------------------------------------
router.get('/meta', (req, res) => {
  res.json({
    roles: rbac.ROLES.map((r) => ({ name: r, description: rbac.ROLE_INFO[r] })),
    statuses: STATUSES,
    departments: store.all('departments').map((d) => d.name),
    branches: store.all('branches').map((b) => ({ id: b.id, name: b.name, city: b.city })),
    applications: store.all('applications').filter((a) => a.active !== false),
  });
});

// ---------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------
router.get('/users', need('users.view'), (req, res) => {
  const q = str(req.query.q, 60).toLowerCase();
  const { role, status, department, branch } = req.query;
  const rows = store.find('users', (u) => (!role || u.role === role)
    && (!status || (status === 'locked' ? u.locked_until && new Date(u.locked_until) > new Date() : u.status === status))
    && (!department || u.department === department)
    && (!branch || u.branch_id === branch)
    && (!q || [u.full_name, u.email, u.employee_id, u.designation].some((f) => String(f || '').toLowerCase().includes(q))))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map(decorate);
  res.json({ users: rows });
});

router.get('/users/:id', wrap(async (req, res) => {
  const self = req.params.id === req.user.id;
  if (!self && !rbac.can(req.user.role, 'users.view')) {
    await audit.record(req, { action: 'Permission denied', category: 'security', outcome: 'denied', details: { request: `GET /api/users/${str(req.params.id, 60)}`, needed: 'users.view' } });
    throw new HttpError(403, 'You can only view your own profile.');
  }
  const u = loadUser(req.params.id);
  const apps = Object.fromEntries(store.all('applications').map((a) => [a.id, a]));
  const grants = store.find('access_grants', (g) => g.user_id === u.id)
    .sort((a, b) => b.granted_at.localeCompare(a.granted_at))
    .map((g) => ({ ...g, application_name: apps[g.application_id] ? apps[g.application_id].name : g.application_id }));
  const history = rbac.can(req.user.role, 'audit.view')
    ? store.find('audit_log', (e) => e.target_id === u.id || e.actor_id === u.id).sort((a, b) => b.id - a.id).slice(0, 15)
    : [];
  const reports = store.find('users', (x) => x.manager_id === u.id).map((x) => ({ id: x.id, full_name: x.full_name, designation: x.designation }));
  res.json({ user: decorate(u), grants, history, reports, sessions: mw.activeSessionsFor(u.id).length });
}));

// ---------------------------------------------------------------------
// Joiner: invite a new staff member
// ---------------------------------------------------------------------
router.post('/users/invite', need('users.invite'), wrap(async (req, res) => {
  const fullName = str(req.body.full_name, 80).replace(/\s+/g, ' ');
  const email = sec.normalizeEmail(req.body.email);
  const role = str(req.body.role, 40);
  if (fullName.length < 3 || !/^[\p{L} .'-]+$/u.test(fullName)) throw new HttpError(400, 'Enter the full name (letters only).');
  if (!email) throw new HttpError(400, 'Enter a valid email address.');
  if (!rbac.ROLES.includes(role)) throw new HttpError(400, 'Choose a valid role.');
  if (store.findOne('users', (u) => u.email === email)) throw new HttpError(409, 'A staff account with this email already exists.');
  const details = cleanDetails(req.body);
  const now = new Date().toISOString();
  const user = await store.insert('users', {
    employee_id: nextEmployeeId(),
    full_name: fullName,
    email,
    role,
    status: 'invited',
    ...details,
    password_hash: null,
    failed_logins: 0,
    locked_until: null,
    last_login_at: null,
    password_changed_at: null,
    activated_at: null,
    invited_by: req.user.id,
    created_at: now,
    updated_at: now,
  });
  const link = await tokens.createLink(req, user, 'invite', req.user);
  let emailSent = true;
  try {
    await mailer.sendInvite(user, link, getPolicies().invite_expiry_hours, req.user.full_name);
  } catch (err) {
    emailSent = false;
    console.error(`[email] invitation to ${sec.maskEmail(email)} failed: ${err.message}`);
  }
  await audit.record(req, { action: 'Staff member invited', category: 'account', target: label(user), details: { role, department: user.department, branch: user.branch_id, email_sent: emailSent } });
  // The link is shown to the admin only if the email could not be sent, or in demo mode.
  res.status(201).json({ user: decorate(user), emailSent, link: !emailSent || config.demoMode || config.emailMode === 'console' ? link : undefined });
}));

router.post('/users/:id/resend-invite', need('users.resend_invite'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  if (u.status !== 'invited') throw new HttpError(400, 'This person has already activated the account.');
  const link = await tokens.createLink(req, u, 'invite', req.user);
  let emailSent = true;
  try { await mailer.sendInvite(u, link, getPolicies().invite_expiry_hours, req.user.full_name); } catch { emailSent = false; }
  await audit.record(req, { action: 'Invitation re-sent', category: 'account', target: label(u), details: { email_sent: emailSent } });
  res.json({ ok: true, emailSent, link: !emailSent || config.demoMode || config.emailMode === 'console' ? link : undefined });
}));

// ---------------------------------------------------------------------
// Mover: change role or details
// ---------------------------------------------------------------------
router.patch('/users/:id/role', need('users.change_role'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  const role = str(req.body.role, 40);
  const reason = str(req.body.reason, 200);
  if (u.id === req.user.id) throw new HttpError(400, 'You cannot change your own role. Another System Administrator must do it.');
  if (!rbac.ROLES.includes(role)) throw new HttpError(400, 'Choose a valid role.');
  if (reason.length < 5) throw new HttpError(400, 'Give a short reason for the change (it goes into the audit trail).');
  if (role === u.role) throw new HttpError(400, `${u.full_name} already has this role.`);
  if (u.role === rbac.ADMIN && u.status === 'active' && activeAdmins() <= 1) throw new HttpError(400, 'The bank must always have at least one active System Administrator.');
  const updated = await store.update('users', u.id, { role, updated_at: new Date().toISOString() });
  mw.revokeUserSessions(u.id); // new permissions apply from the next sign-in
  await audit.record(req, { action: 'Role changed', category: 'account', target: label(u), details: { from: u.role, to: role, reason } });
  res.json({ user: decorate(updated) });
}));

router.patch('/users/:id/details', need('users.edit_details'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  const changes = cleanDetails(req.body, { partial: true });
  if (changes.manager_id && changes.manager_id === u.id) throw new HttpError(400, 'A person cannot report to themselves.');
  const diff = {};
  Object.keys(changes).forEach((k) => { if ((u[k] || '') !== (changes[k] || '')) diff[k] = { from: u[k] || '', to: changes[k] || '' }; });
  if (!Object.keys(diff).length) return res.json({ user: decorate(u) });
  const updated = await store.update('users', u.id, { ...changes, updated_at: new Date().toISOString() });
  await audit.record(req, { action: 'Staff details updated', category: 'account', target: label(u), details: diff });
  res.json({ user: decorate(updated) });
}));

// ---------------------------------------------------------------------
// Leaver / security: suspend, re-activate, disable
// ---------------------------------------------------------------------
router.patch('/users/:id/status', need('users.change_status'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  const status = str(req.body.status, 20);
  const reason = str(req.body.reason, 200);
  if (u.id === req.user.id) throw new HttpError(400, 'You cannot change the status of your own account.');
  if (!['active', 'suspended', 'disabled'].includes(status)) throw new HttpError(400, 'Choose active, suspended or disabled.');
  if (reason.length < 5) throw new HttpError(400, 'Give a short reason (it goes into the audit trail).');
  if (status === u.status) throw new HttpError(400, `The account is already ${status}.`);
  if (status === 'active' && !u.password_hash) throw new HttpError(400, 'This person has not set a password yet. Re-send the invitation instead.');
  if (u.role === rbac.ADMIN && u.status === 'active' && status !== 'active' && activeAdmins() <= 1) {
    throw new HttpError(400, 'The bank must always have at least one active System Administrator.');
  }
  const now = new Date().toISOString();
  const updated = await store.update('users', u.id, { status, updated_at: now });
  const signedOut = status === 'active' ? 0 : mw.revokeUserSessions(u.id);

  // Leaver: disabling an account removes all of its application access.
  let revoked = 0;
  if (status === 'disabled') {
    for (const g of store.find('access_grants', (x) => x.user_id === u.id && x.status === 'active')) {
      await store.update('access_grants', g.id, { status: 'revoked', revoked_at: now, revoked_by: req.user.id, revoke_reason: 'Account disabled (leaver)' });
      revoked += 1;
    }
    for (const r of store.find('access_requests', (x) => x.user_id === u.id && x.status === 'pending')) {
      await store.update('access_requests', r.id, { status: 'cancelled', reviewed_at: now, review_comment: 'Account disabled' });
    }
  }
  await audit.record(req, {
    action: status === 'active' ? 'Account re-activated' : status === 'suspended' ? 'Account suspended' : 'Account disabled (leaver)',
    category: 'account', target: label(u), details: { from: u.status, to: status, reason, sessions_ended: signedOut, access_revoked: revoked },
  });
  res.json({ user: decorate(updated), revoked });
}));

// ---------------------------------------------------------------------
// Helpdesk: unlock, password reset link, sign out everywhere
// ---------------------------------------------------------------------
function helpdeskGuard(req, u) {
  if (u.id === req.user.id) throw new HttpError(400, 'Use My Profile for your own account.');
  // Segregation of duties: helpdesk staff cannot take over an administrator account.
  if (u.role === rbac.ADMIN && req.user.role !== rbac.ADMIN) throw new HttpError(403, 'Only a System Administrator can do this for another System Administrator.');
}

router.post('/users/:id/unlock', need('users.unlock'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  helpdeskGuard(req, u);
  if (!u.locked_until || new Date(u.locked_until) <= new Date()) throw new HttpError(400, 'This account is not locked.');
  await store.update('users', u.id, { locked_until: null, failed_logins: 0, updated_at: new Date().toISOString() });
  await audit.record(req, { action: 'Account unlocked', category: 'security', target: label(u) });
  res.json({ ok: true });
}));

router.post('/users/:id/send-reset', need('users.send_reset'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  helpdeskGuard(req, u);
  if (u.status !== 'active') throw new HttpError(400, `The account is ${u.status}. Only active accounts can reset passwords.`);
  const link = await tokens.createLink(req, u, 'reset', req.user);
  let emailSent = true;
  try { await mailer.sendReset(u, link, getPolicies().reset_expiry_minutes); } catch { emailSent = false; }
  await audit.record(req, { action: 'Password reset link sent', category: 'security', target: label(u), details: { email_sent: emailSent } });
  res.json({ ok: true, emailSent, link: !emailSent || config.demoMode || config.emailMode === 'console' ? link : undefined });
}));

router.post('/users/:id/revoke-sessions', need('sessions.revoke'), wrap(async (req, res) => {
  const u = loadUser(req.params.id);
  if (u.id === req.user.id) throw new HttpError(400, 'Use Sign out for your own session.');
  const n = mw.revokeUserSessions(u.id);
  await audit.record(req, { action: 'Signed out from all devices', category: 'security', target: label(u), details: { sessions_ended: n } });
  res.json({ ok: true, ended: n });
}));

// ---------------------------------------------------------------------
// My profile: staff may change ONLY their phone number. Anything else
// sent by the browser (role, status, department...) is ignored.
// ---------------------------------------------------------------------
router.patch('/profile', wrap(async (req, res) => {
  const ignored = Object.keys(req.body || {}).filter((k) => k !== 'phone');
  if (ignored.length) {
    await audit.record(req, { action: 'Tried to change protected profile fields', category: 'security', outcome: 'denied', details: { fields: ignored.slice(0, 10) } });
  }
  if (req.body.phone === undefined) throw new HttpError(400, 'Only your mobile number can be changed here. Ask the System Administrator for other changes.');
  const { phone } = cleanDetails({ phone: req.body.phone }, { partial: true });
  const u = store.get('users', req.user.id);
  if (phone !== u.phone) {
    await store.update('users', u.id, { phone, updated_at: new Date().toISOString() });
    await audit.record(req, { action: 'Updated own mobile number', category: 'account', target: label(u) });
  }
  res.json({ user: decorate(store.get('users', u.id)), ignored });
}));

module.exports = router;
