// =====================================================================
//  Dashboard: ONE endpoint, different content for each role.
//  The server decides what each role sees; the browser only draws it.
//  Response shape:
//    { greeting, stats: [{label, value, tone, link}], panels: [{title, columns, rows, link, empty}] }
// =====================================================================
const express = require('express');
const store = require('../store');
const audit = require('../audit');
const rbac = require('../rbac');
const mw = require('../middleware');

const router = express.Router();

const DAY = 86400000;
const ago = (ms) => new Date(Date.now() - ms);
const isLocked = (u) => u.locked_until && new Date(u.locked_until) > new Date();

function stat(label, value, tone = 'neutral', link = '') { return { label, value, tone, link }; }

function panel(title, columns, rows, { link = '', empty = 'Nothing to show.' } = {}) {
  return { title, columns, rows, link, empty };
}

function recentAudit(filter, n = 8) {
  return store.find('audit_log', filter).sort((a, b) => b.id - a.id).slice(0, n)
    .map((e) => ({ When: { time: e.at }, Who: e.actor_name, Action: e.action, Target: e.target_label || '', Result: { badge: e.outcome } }));
}

function mySection(user, apps) {
  const grants = store.find('access_grants', (g) => g.user_id === user.id && g.status === 'active');
  const requests = store.find('access_requests', (r) => r.user_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    stats: [
      stat('My applications', grants.length, 'blue', 'my-access'),
      stat('My pending requests', requests.filter((r) => r.status === 'pending').length, 'amber', 'my-access'),
    ],
    accessPanel: panel('My access', ['Application', 'Level', 'Since'], grants.map((g) => ({
      Application: apps[g.application_id] ? apps[g.application_id].name : g.application_id,
      Level: { badge: g.access_level },
      Since: { date: g.granted_at },
    })), { link: 'my-access', empty: 'You have no application access yet. Use My Access to request some.' }),
    requestPanel: panel('My recent requests', ['Application', 'Level', 'Status', 'Requested'], requests.slice(0, 5).map((r) => ({
      Application: apps[r.application_id] ? apps[r.application_id].name : r.application_id,
      Level: r.access_level,
      Status: { badge: r.status },
      Requested: { date: r.created_at },
    })), { link: 'my-access', empty: 'No requests yet.' }),
  };
}

// ---- chart helpers -------------------------------------------------
// Last N days as IST calendar dates, e.g. "07 Nov".
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * DAY);
    out.push({
      key: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      label: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' }),
    });
  }
  return out;
}
const istDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Daily counts for several series: series = [{ key, label, color, rows, dateField }]
function trend(title, series, days = 14) {
  const ds = lastDays(days);
  const data = ds.map((d) => {
    const row = { label: d.label };
    series.forEach((s) => { row[s.key] = s.rows.filter((r) => r[s.dateField] && istDay(r[s.dateField]) === d.key).length; });
    return row;
  });
  return { type: 'area', title, data, series: series.map(({ key, label, color }) => ({ key, label, color })) };
}

function breakdown(type, title, pairs, color) {
  return { type, title, data: pairs.map(([label, value, c]) => ({ label, value, color: c || color })), series: [{ key: 'value', label: 'Count', color }] };
}

const C = { navy: '#1d4ed8', green: '#059669', amber: '#d97706', red: '#dc2626', slate: '#64748b', violet: '#7c3aed', teal: '#0d9488' };

router.get('/dashboard', (req, res) => {
  const me = req.user;
  const users = store.all('users');
  const apps = Object.fromEntries(store.all('applications').map((a) => [a.id, a]));
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const pending = store.find('access_requests', (r) => r.status === 'pending');
  const mine = mySection(me, apps);
  const stats = [];
  const panels = [];
  const charts = [];
  const auditRows = store.all('audit_log');

  if (me.role === rbac.ADMIN) {
    const alerts = store.count('audit_log', (e) => e.outcome !== 'success' && new Date(e.at) > ago(DAY));
    stats.push(
      stat('Staff accounts', users.length, 'blue', 'users'),
      stat('Active', users.filter((u) => u.status === 'active').length, 'green', 'users?status=active'),
      stat('Invited (not yet active)', users.filter((u) => u.status === 'invited').length, 'amber', 'users?status=invited'),
      stat('Locked', users.filter(isLocked).length, users.some(isLocked) ? 'red' : 'neutral', 'users?status=locked'),
      stat('Pending approvals', pending.length, pending.length ? 'amber' : 'neutral', 'approvals'),
      stat('Security alerts (24 h)', alerts, alerts ? 'red' : 'green', 'audit?outcome=failure'),
      stat('Signed in now', mw.activeSessionCount(), 'neutral'),
    );
    const roleCounts = rbac.ROLES.map((r) => ({ Role: r, Active: users.filter((u) => u.role === r && u.status === 'active').length, Total: users.filter((u) => u.role === r).length }));
    panels.push(panel('Staff by role', ['Role', 'Active', 'Total'], roleCounts, { link: 'users' }));
    charts.push(trend('Sign-in activity (last 14 days)', [
      { key: 'ok', label: 'Successful sign-ins', color: C.navy, rows: auditRows.filter((e) => e.action.startsWith('Signed in')), dateField: 'at' },
      { key: 'bad', label: 'Failed / blocked', color: C.red, rows: auditRows.filter((e) => e.category === 'security' && e.outcome !== 'success'), dateField: 'at' },
    ]));
    charts.push(breakdown('donut', 'Accounts by status', [
      ['Active', users.filter((u) => u.status === 'active' && !isLocked(u)).length, C.green],
      ['Locked', users.filter(isLocked).length, C.red],
      ['Invited', users.filter((u) => u.status === 'invited').length, C.amber],
      ['Suspended', users.filter((u) => u.status === 'suspended').length, C.violet],
      ['Disabled', users.filter((u) => u.status === 'disabled').length, C.slate],
    ]));
    const branches = store.all('branches');
    charts.push(breakdown('bar', 'Staff by branch', branches.map((b) => [b.city, users.filter((u) => u.branch_id === b.id && u.status !== 'disabled').length]), C.navy));
    panels.push(panel('Recent security alerts', ['When', 'Who', 'Action', 'Target', 'Result'], recentAudit((e) => e.outcome !== 'success', 6), { link: 'audit?outcome=failure', empty: 'No failed or blocked actions. 👍' }));
    panels.push(panel('Latest activity', ['When', 'Who', 'Action', 'Target', 'Result'], recentAudit(() => true, 6), { link: 'audit' }));
  }

  if (me.role === rbac.ACCESS_MANAGER) {
    const decided = store.find('access_requests', (r) => ['approved', 'rejected'].includes(r.status) && r.reviewed_at && new Date(r.reviewed_at) > ago(30 * DAY));
    const avgHours = decided.length ? Math.round(decided.reduce((s, r) => s + (new Date(r.reviewed_at) - new Date(r.created_at)), 0) / decided.length / 3600000) : 0;
    const oldest = pending.length ? Math.floor((Date.now() - Math.min(...pending.map((r) => new Date(r.created_at).getTime()))) / DAY) : 0;
    stats.push(
      stat('Waiting for review', pending.length, pending.length ? 'amber' : 'green', 'approvals'),
      stat('Oldest waiting (days)', oldest, oldest > 3 ? 'red' : 'neutral', 'approvals'),
      stat('Approved (30 days)', decided.filter((r) => r.status === 'approved').length, 'green'),
      stat('Rejected (30 days)', decided.filter((r) => r.status === 'rejected').length, 'neutral'),
      stat('Average decision time', `${avgHours} h`, 'blue'),
    );
    const allReq = store.all('access_requests');
    charts.push(trend('Access requests (last 14 days)', [
      { key: 'new', label: 'Raised', color: C.navy, rows: allReq, dateField: 'created_at' },
      { key: 'approved', label: 'Approved', color: C.green, rows: allReq.filter((r) => r.status === 'approved'), dateField: 'reviewed_at' },
      { key: 'rejected', label: 'Rejected', color: C.red, rows: allReq.filter((r) => r.status === 'rejected'), dateField: 'reviewed_at' },
    ]));
    const riskOf = (r) => (apps[r.application_id] || {}).risk;
    charts.push(breakdown('donut', 'Waiting requests by risk', [
      ['Critical', pending.filter((r) => riskOf(r) === 'critical').length, C.red],
      ['High', pending.filter((r) => riskOf(r) === 'high').length, C.amber],
      ['Medium', pending.filter((r) => riskOf(r) === 'medium').length, C.navy],
      ['Low', pending.filter((r) => riskOf(r) === 'low').length, C.slate],
    ]));
    panels.push(panel('Approval queue (oldest first)', ['Employee', 'Application', 'Level', 'Waiting', 'Note'], pending
      .sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 8).map((r) => ({
        Employee: byId[r.user_id] ? byId[r.user_id].full_name : '',
        Application: apps[r.application_id] ? apps[r.application_id].name : '',
        Level: { badge: r.access_level },
        Waiting: { since: r.created_at },
        Note: r.user_id === me.id ? 'Your own request' : (apps[r.application_id] && apps[r.application_id].risk === 'critical' && r.access_level === 'Admin' ? 'Needs System Admin' : ''),
      })), { link: 'approvals', empty: 'The queue is empty. 🎉' }));
    const popular = Object.values(store.find('access_grants', (g) => g.status === 'active').reduce((acc, g) => {
      acc[g.application_id] = acc[g.application_id] || { Application: apps[g.application_id] ? apps[g.application_id].name : g.application_id, Risk: { badge: apps[g.application_id] ? apps[g.application_id].risk : '' }, Users: 0 };
      acc[g.application_id].Users += 1;
      return acc;
    }, {})).sort((a, b) => b.Users - a.Users).slice(0, 6);
    panels.push(panel('Applications with most users', ['Application', 'Risk', 'Users'], popular, { link: 'access' }));
  }

  if (me.role === rbac.HELPDESK) {
    const locked = users.filter(isLocked);
    const invited = users.filter((u) => u.status === 'invited');
    const failed = store.count('audit_log', (e) => e.category === 'security' && e.outcome === 'failure' && new Date(e.at) > ago(DAY));
    stats.push(
      stat('Locked accounts', locked.length, locked.length ? 'red' : 'green', 'users?status=locked'),
      stat('Waiting to activate', invited.length, invited.length ? 'amber' : 'neutral', 'users?status=invited'),
      stat('Failed sign-ins (24 h)', failed, failed ? 'amber' : 'green', 'audit'),
      stat('Active staff', users.filter((u) => u.status === 'active').length, 'blue', 'users'),
    );
    charts.push(trend('Sign-in problems (last 14 days)', [
      { key: 'wrong', label: 'Wrong password / code', color: C.amber, rows: auditRows.filter((e) => /^(Sign-in failed|Wrong sign-in code)/.test(e.action)), dateField: 'at' },
      { key: 'locked', label: 'Accounts locked', color: C.red, rows: auditRows.filter((e) => e.action.startsWith('Account locked')), dateField: 'at' },
      { key: 'resets', label: 'Resets & unlocks', color: C.green, rows: auditRows.filter((e) => /^(Account unlocked|Password reset)/.test(e.action)), dateField: 'at' },
    ]));
    charts.push(breakdown('donut', 'Accounts by status', [
      ['Active', users.filter((u) => u.status === 'active' && !isLocked(u)).length, C.green],
      ['Locked', locked.length, C.red],
      ['Waiting to activate', invited.length, C.amber],
      ['Suspended / disabled', users.filter((u) => ['suspended', 'disabled'].includes(u.status)).length, C.slate],
    ]));
    panels.push(panel('Locked accounts', ['Name', 'Employee ID', 'Branch', 'Unlocks'], locked.map((u) => ({
      Name: { user: u.id, text: u.full_name }, 'Employee ID': u.employee_id,
      Branch: store.get('branches', u.branch_id) ? store.get('branches', u.branch_id).city : '', Unlocks: { time: u.locked_until },
    })), { link: 'users?status=locked', empty: 'No locked accounts.' }));
    panels.push(panel('Invitations not yet accepted', ['Name', 'Role', 'Department', 'Invited'], invited.map((u) => ({
      Name: { user: u.id, text: u.full_name }, Role: u.role, Department: u.department, Invited: { date: u.created_at },
    })), { link: 'users?status=invited', empty: 'Everyone has activated their account.' }));
  }

  if (me.role === rbac.AUDITOR) {
    const chain = audit.verifyChain();
    const denied7 = store.count('audit_log', (e) => e.outcome === 'denied' && new Date(e.at) > ago(7 * DAY));
    const privileged = store.find('access_grants', (g) => g.status === 'active' && g.access_level === 'Admin');
    const dormant = users.filter((u) => u.status === 'active' && (!u.last_login_at || new Date(u.last_login_at) < ago(30 * DAY)));
    const leaverAccess = store.find('access_grants', (g) => g.status === 'active' && byId[g.user_id] && byId[g.user_id].status === 'disabled');
    stats.push(
      stat('Audit entries', store.count('audit_log'), 'blue', 'audit'),
      stat('Audit chain', chain.ok ? 'Intact' : 'BROKEN', chain.ok ? 'green' : 'red', 'audit'),
      stat('Blocked actions (7 days)', denied7, denied7 ? 'amber' : 'green', 'audit?outcome=denied'),
      stat('Admin-level access', privileged.length, 'amber', 'access'),
      stat('Dormant accounts (30 days)', dormant.length, dormant.length ? 'amber' : 'green', 'users?status=active'),
      stat('Leavers still with access', leaverAccess.length, leaverAccess.length ? 'red' : 'green', 'access'),
    );
    charts.push(trend('Audit events (last 14 days)', [
      { key: 'ok', label: 'Successful', color: C.navy, rows: auditRows.filter((e) => e.outcome === 'success'), dateField: 'at' },
      { key: 'failed', label: 'Failed', color: C.amber, rows: auditRows.filter((e) => e.outcome === 'failure'), dateField: 'at' },
      { key: 'denied', label: 'Denied', color: C.red, rows: auditRows.filter((e) => e.outcome === 'denied'), dateField: 'at' },
    ]));
    const cats = ['auth', 'account', 'access', 'security', 'policy'];
    const catColor = [C.navy, C.teal, C.green, C.red, C.violet];
    charts.push(breakdown('donut', 'Events by category', cats.map((c, i) => [c[0].toUpperCase() + c.slice(1), auditRows.filter((e) => e.category === c).length, catColor[i]])));
    panels.push(panel('Privileged (Admin-level) access', ['Employee', 'Application', 'Risk', 'Granted by', 'Since'], privileged.map((g) => ({
      Employee: byId[g.user_id] ? byId[g.user_id].full_name : '', Application: apps[g.application_id] ? apps[g.application_id].name : '',
      Risk: { badge: apps[g.application_id] ? apps[g.application_id].risk : '' }, 'Granted by': byId[g.granted_by] ? byId[g.granted_by].full_name : 'System', Since: { date: g.granted_at },
    })), { link: 'access' }));
    panels.push(panel('Blocked and failed actions', ['When', 'Who', 'Action', 'Target', 'Result'], recentAudit((e) => e.outcome !== 'success', 8), { link: 'audit?outcome=denied', empty: 'None recorded.' }));
  }

  if (me.role === rbac.EMPLOYEE) {
    const myGrants = store.find('access_grants', (g) => g.user_id === me.id && g.status === 'active');
    const lvl = (l) => myGrants.filter((g) => g.access_level === l).length;
    charts.push(breakdown('donut', 'My access by level', [['Read', lvl('Read'), C.slate], ['Write', lvl('Write'), C.navy], ['Admin', lvl('Admin'), C.violet]]));
    const myReq = store.find('access_requests', (r) => r.user_id === me.id);
    charts.push(breakdown('bar', 'My requests by status', ['pending', 'approved', 'rejected', 'cancelled'].map((st, i) => [st[0].toUpperCase() + st.slice(1), myReq.filter((r) => r.status === st).length, [C.amber, C.green, C.red, C.slate][i]]), C.navy));
  }

  // Employees see their own access; other roles have it under My Access.
  if (me.role === rbac.EMPLOYEE) {
    stats.push(...mine.stats);
    panels.push(mine.accessPanel, mine.requestPanel);
  }

  res.json({ role: me.role, roleInfo: rbac.ROLE_INFO[me.role], stats, charts, panels });
});

module.exports = router;
