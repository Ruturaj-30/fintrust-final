// =====================================================================
//  Access requests and approvals.
//  Employee asks for access to a bank application -> Access Manager or
//  System Administrator approves or rejects -> access is granted and can
//  later be revoked. Every step goes into the audit trail.
//  Rules (segregation of duties):
//   - nobody can approve or reject their own request
//   - "Admin" level on a CRITICAL system needs a System Administrator
//   - nobody can revoke their own access
// =====================================================================
const express = require('express');
const store = require('../store');
const audit = require('../audit');
const rbac = require('../rbac');
const mw = require('../middleware');

const router = express.Router();
const { wrap, HttpError, requirePermission: need } = mw;

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const appsById = () => Object.fromEntries(store.all('applications').map((a) => [a.id, a]));
const usersById = () => Object.fromEntries(store.all('users').map((u) => [u.id, u]));

function needsAdminApproval(app, level) {
  return app && app.risk === 'critical' && level === 'Admin';
}

// Why this reviewer may NOT decide this request (or null if they may).
function reviewBlock(reviewer, request, app) {
  if (request.user_id === reviewer.id) return 'You cannot review your own request.';
  if (needsAdminApproval(app, request.access_level) && !rbac.can(reviewer.role, 'access.review_critical')) {
    return 'Admin access to a critical system must be approved by a System Administrator.';
  }
  return null;
}

function decorateRequest(r, apps, users, viewer) {
  const app = apps[r.application_id] || {};
  const user = users[r.user_id] || {};
  const reviewer = r.reviewer_id ? users[r.reviewer_id] : null;
  const out = {
    ...r,
    application_name: app.name || r.application_id,
    application_risk: app.risk || '',
    user_name: user.full_name || 'Unknown',
    user_employee_id: user.employee_id || '',
    user_role: user.role || '',
    user_department: user.department || '',
    reviewer_name: reviewer ? reviewer.full_name : '',
    needs_admin: needsAdminApproval(app, r.access_level),
  };
  if (viewer && r.status === 'pending') {
    const block = rbac.can(viewer.role, 'access.review') ? reviewBlock(viewer, r, app) : 'No permission to review.';
    out.can_review = !block;
    out.review_block = block || '';
  }
  return out;
}

function decorateGrant(g, apps, users) {
  const app = apps[g.application_id] || {};
  const user = users[g.user_id] || {};
  return {
    ...g,
    application_name: app.name || g.application_id,
    application_risk: app.risk || '',
    user_name: user.full_name || 'Unknown',
    user_employee_id: user.employee_id || '',
    user_department: user.department || '',
    user_status: user.status || '',
    granted_by_name: g.granted_by && users[g.granted_by] ? users[g.granted_by].full_name : 'System',
    revoked_by_name: g.revoked_by && users[g.revoked_by] ? users[g.revoked_by].full_name : '',
  };
}

// ---------------------------------------------------------------------
// Application catalogue (with my own status for each app)
// ---------------------------------------------------------------------
router.get('/applications', (req, res) => {
  const mine = store.find('access_grants', (g) => g.user_id === req.user.id && g.status === 'active');
  const pending = store.find('access_requests', (r) => r.user_id === req.user.id && r.status === 'pending');
  const apps = store.all('applications').filter((a) => a.active !== false).map((a) => {
    const grant = mine.find((g) => g.application_id === a.id);
    const req2 = pending.find((r) => r.application_id === a.id);
    return { ...a, my_level: grant ? grant.access_level : null, my_pending: req2 ? req2.access_level : null };
  });
  res.json({ applications: apps });
});

// ---------------------------------------------------------------------
// My requests and my access
// ---------------------------------------------------------------------
router.post('/access-requests', need('access.request'), wrap(async (req, res) => {
  const app = store.get('applications', str(req.body.application_id, 40));
  const level = str(req.body.access_level, 20);
  const justification = str(req.body.justification, 500);
  if (!app || app.active === false) throw new HttpError(400, 'Choose an application.');
  if (!app.levels.includes(level)) throw new HttpError(400, `Choose an access level: ${app.levels.join(', ')}.`);
  if (justification.length < 15) throw new HttpError(400, 'Explain why you need this access (at least 15 characters).');
  if (store.findOne('access_requests', (r) => r.user_id === req.user.id && r.application_id === app.id && r.status === 'pending')) {
    throw new HttpError(409, 'You already have a pending request for this application. Cancel it first if you need a different level.');
  }
  const current = store.findOne('access_grants', (g) => g.user_id === req.user.id && g.application_id === app.id && g.status === 'active');
  if (current && current.access_level === level) throw new HttpError(409, `You already have ${level} access to ${app.name}.`);
  const request = await store.insert('access_requests', {
    user_id: req.user.id,
    application_id: app.id,
    access_level: level,
    justification,
    status: 'pending',
    created_at: new Date().toISOString(),
    reviewer_id: null,
    reviewed_at: null,
    review_comment: null,
  });
  await audit.record(req, {
    action: 'Access requested', category: 'access',
    target: { type: 'request', id: request.id, label: `${app.name} (${level})` },
    details: { application: app.name, level, current_level: current ? current.access_level : 'none' },
  });
  res.status(201).json({ request: decorateRequest(request, appsById(), usersById()) });
}));

router.get('/access-requests/mine', (req, res) => {
  const apps = appsById();
  const users = usersById();
  const rows = store.find('access_requests', (r) => r.user_id === req.user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => decorateRequest(r, apps, users));
  res.json({ requests: rows });
});

router.post('/access-requests/:id/cancel', wrap(async (req, res) => {
  const r = store.get('access_requests', req.params.id);
  if (!r || r.user_id !== req.user.id) throw new HttpError(404, 'Request not found.');
  if (r.status !== 'pending') throw new HttpError(400, 'Only pending requests can be cancelled.');
  await store.update('access_requests', r.id, { status: 'cancelled', reviewed_at: new Date().toISOString() });
  const app = store.get('applications', r.application_id);
  await audit.record(req, { action: 'Access request cancelled', category: 'access', target: { type: 'request', id: r.id, label: `${app ? app.name : r.application_id} (${r.access_level})` } });
  res.json({ ok: true });
}));

router.get('/access-grants/mine', (req, res) => {
  const apps = appsById();
  const users = usersById();
  const rows = store.find('access_grants', (g) => g.user_id === req.user.id && g.status === 'active').map((g) => decorateGrant(g, apps, users));
  res.json({ grants: rows });
});

// ---------------------------------------------------------------------
// Reviewing requests (Access Manager, System Administrator)
// ---------------------------------------------------------------------
router.get('/access-requests', need(['access.review', 'access.view_all']), (req, res) => {
  const status = str(req.query.status, 20);
  const apps = appsById();
  const users = usersById();
  const rows = store.find('access_requests', (r) => !status || r.status === status)
    .sort((a, b) => (status === 'pending' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)))
    .slice(0, 300)
    .map((r) => decorateRequest(r, apps, users, req.user));
  res.json({ requests: rows });
});

router.post('/access-requests/:id/decision', need('access.review'), wrap(async (req, res) => {
  const r = store.get('access_requests', req.params.id);
  if (!r) throw new HttpError(404, 'Request not found.');
  const decision = str(req.body.decision, 10);
  const comment = str(req.body.comment, 300);
  if (!['approve', 'reject'].includes(decision)) throw new HttpError(400, 'Decision must be approve or reject.');
  if (r.status !== 'pending') throw new HttpError(409, `This request was already ${r.status}.`);
  const app = store.get('applications', r.application_id);
  const requester = store.get('users', r.user_id);
  const target = { type: 'request', id: r.id, label: `${app.name} (${r.access_level}) for ${requester.full_name}` };

  const block = reviewBlock(req.user, r, app);
  if (block) {
    await audit.record(req, { action: 'Review blocked (segregation of duties)', category: 'security', outcome: 'denied', target, details: { reason: block } });
    throw new HttpError(403, block);
  }
  if (decision === 'reject' && comment.length < 5) throw new HttpError(400, 'Give a reason for the rejection so the employee knows what to do.');
  if (decision === 'approve' && requester.status !== 'active') throw new HttpError(400, `Cannot approve: ${requester.full_name}'s account is ${requester.status}.`);

  const now = new Date().toISOString();
  await store.update('access_requests', r.id, {
    status: decision === 'approve' ? 'approved' : 'rejected', reviewer_id: req.user.id, reviewed_at: now, review_comment: comment || null,
  });
  if (decision === 'approve') {
    const old = store.findOne('access_grants', (g) => g.user_id === r.user_id && g.application_id === r.application_id && g.status === 'active');
    if (old) {
      await store.update('access_grants', old.id, { status: 'revoked', revoked_at: now, revoked_by: req.user.id, revoke_reason: `Replaced by ${r.access_level} access` });
    }
    await store.insert('access_grants', {
      user_id: r.user_id, application_id: r.application_id, access_level: r.access_level, status: 'active',
      request_id: r.id, granted_by: req.user.id, granted_at: now, revoked_at: null, revoked_by: null, revoke_reason: null,
    });
  }
  await audit.record(req, {
    action: decision === 'approve' ? 'Access approved and granted' : 'Access request rejected',
    category: 'access', target, details: { comment: comment || undefined },
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------
// Access register: who has access to what
// ---------------------------------------------------------------------
router.get('/access-grants', need('access.view_all'), (req, res) => {
  const { application, status, user } = req.query;
  const apps = appsById();
  const users = usersById();
  const rows = store.find('access_grants', (g) => (!application || g.application_id === application)
    && (!user || g.user_id === user)
    && (status === 'all' || g.status === (status || 'active')))
    .sort((a, b) => b.granted_at.localeCompare(a.granted_at))
    .map((g) => decorateGrant(g, apps, users));
  res.json({ grants: rows });
});

router.post('/access-grants/:id/revoke', need('access.revoke'), wrap(async (req, res) => {
  const g = store.get('access_grants', req.params.id);
  if (!g) throw new HttpError(404, 'Access record not found.');
  if (g.status !== 'active') throw new HttpError(400, 'This access is already revoked.');
  if (g.user_id === req.user.id) throw new HttpError(403, 'You cannot revoke your own access. Ask another reviewer.');
  const reason = str(req.body.reason, 200);
  if (reason.length < 5) throw new HttpError(400, 'Give a reason for revoking this access.');
  await store.update('access_grants', g.id, { status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: req.user.id, revoke_reason: reason });
  const app = store.get('applications', g.application_id);
  const user = store.get('users', g.user_id);
  await audit.record(req, {
    action: 'Access revoked', category: 'access',
    target: { type: 'grant', id: g.id, label: `${app.name} (${g.access_level}) for ${user.full_name}` }, details: { reason },
  });
  res.json({ ok: true });
}));

module.exports = router;
