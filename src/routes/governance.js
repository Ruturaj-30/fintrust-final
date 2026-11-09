// =====================================================================
//  Audit trail, security policy and bank information.
// =====================================================================
const express = require('express');
const store = require('../store');
const audit = require('../audit');
const { DEFAULTS, RULES, getPolicies, getOrganization } = require('../policies');
const mw = require('../middleware');

const router = express.Router();
const { wrap, HttpError, requirePermission: need } = mw;
const str = (v, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function filterAudit(q) {
  const text = str(q.q).toLowerCase();
  const from = q.from ? new Date(`${q.from}T00:00:00+05:30`) : null;
  const to = q.to ? new Date(`${q.to}T23:59:59.999+05:30`) : null;
  return store.find('audit_log', (e) => (!q.category || e.category === q.category)
    && (!q.outcome || e.outcome === q.outcome)
    && (!from || Number.isNaN(from.getTime()) || new Date(e.at) >= from)
    && (!to || Number.isNaN(to.getTime()) || new Date(e.at) <= to)
    && (!text || [e.action, e.actor_name, e.actor_role, e.target_label, e.ip].some((f) => String(f || '').toLowerCase().includes(text))))
    .sort((a, b) => b.id - a.id);
}

router.get('/audit', need('audit.view'), (req, res) => {
  const rows = filterAudit(req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 50;
  res.json({ total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / size)), entries: rows.slice((page - 1) * size, page * size) });
});

router.get('/audit/verify', need('audit.verify'), wrap(async (req, res) => {
  const result = audit.verifyChain();
  await audit.record(req, { action: 'Audit trail integrity checked', category: 'security', outcome: result.ok ? 'success' : 'failure', details: result });
  res.json(result);
}));

router.get('/audit/export', need('audit.view'), wrap(async (req, res) => {
  const rows = filterAudit(req.query);
  const cell = (v) => {
    let s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stops formulas running when opened in Excel
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['id', 'time_ist', 'actor', 'actor_role', 'action', 'category', 'outcome', 'target', 'details', 'ip', 'hash'];
  const lines = rows.map((e) => [e.id, new Date(e.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), e.actor_name, e.actor_role, e.action, e.category, e.outcome, e.target_label, e.details, e.ip, e.hash].map(cell).join(','));
  await audit.record(req, { action: 'Audit trail exported (CSV)', category: 'security', details: { rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fintrust-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${head.join(',')}\n${lines.join('\n')}\n`);
}));

// ---------------------------------------------------------------------
// Blockchain anchoring of the audit trail (optional, see src/blockchain.js)
// ---------------------------------------------------------------------
const chain = require('../blockchain');

router.get('/audit/blockchain', need('audit.view'), wrap(async (req, res) => {
  res.json({ ...(await chain.status()), anchors: chain.list() });
}));

router.post('/audit/blockchain/anchor', need('audit.verify'), wrap(async (req, res) => {
  const anchor = await chain.anchorNow(req.user);
  await audit.record(req, {
    action: 'Audit trail anchored on blockchain', category: 'security',
    details: { entry: anchor.entry_id, network: anchor.network, transaction: anchor.tx_hash },
  });
  res.status(201).json({ anchor });
}));

router.get('/audit/blockchain/verify', need('audit.verify'), wrap(async (req, res) => {
  const result = await chain.verifyAll();
  await audit.record(req, {
    action: 'Audit trail verified against blockchain', category: 'security', outcome: result.ok ? 'success' : 'failure',
    details: { anchors_checked: result.checked, problems: result.results.filter((r) => !r.ok).length },
  });
  res.json(result);
}));

// ---------------------------------------------------------------------
// Security policy
// ---------------------------------------------------------------------
router.get('/policies', need('policies.view'), (req, res) => {
  const row = store.get('settings', 'security_policy');
  const by = row && row.updated_by ? store.get('users', row.updated_by) : null;
  res.json({ values: getPolicies(), rules: RULES, defaults: DEFAULTS, updated_at: row ? row.updated_at : null, updated_by: by ? by.full_name : null });
});

router.put('/policies', need('policies.manage'), wrap(async (req, res) => {
  const current = getPolicies();
  const next = { ...current };
  const changes = {};
  for (const [key, rule] of Object.entries(RULES)) {
    if (req.body[key] === undefined) continue;
    const n = Number(req.body[key]);
    if (!Number.isInteger(n) || n < rule.min || n > rule.max) throw new HttpError(400, `${rule.label} must be a whole number from ${rule.min} to ${rule.max}.`);
    if (n !== current[key]) { changes[key] = { from: current[key], to: n }; next[key] = n; }
  }
  if (!Object.keys(changes).length) return res.json({ values: current, changed: 0 });
  const row = { value: next, updated_at: new Date().toISOString(), updated_by: req.user.id };
  if (store.get('settings', 'security_policy')) await store.update('settings', 'security_policy', row);
  else await store.insert('settings', { id: 'security_policy', ...row });
  await audit.record(req, { action: 'Security policy changed', category: 'policy', target: { type: 'policy', id: 'security_policy', label: 'Security policy' }, details: changes });
  res.json({ values: next, changed: Object.keys(changes).length });
}));

// ---------------------------------------------------------------------
// About the bank (everyone)
// ---------------------------------------------------------------------
router.get('/bank', (req, res) => {
  const users = store.all('users');
  const branches = store.all('branches').map((b) => ({ ...b, staff: users.filter((u) => u.branch_id === b.id && u.status !== 'disabled').length }));
  const departments = store.all('departments').map((d) => ({ ...d, staff: users.filter((u) => u.department === d.name && u.status !== 'disabled').length }));
  res.json({
    organization: getOrganization(),
    branches,
    departments,
    partner_banks: store.all('partner_banks'),
    applications: store.all('applications'),
  });
});

module.exports = router;
