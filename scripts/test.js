// =====================================================================
//  Automated security tests:  npm test
//  Starts a separate copy of the server with throw-away demo data and
//  checks sign-in, permissions for every role, approvals and the audit.
//  Your own data in the data folder is NOT touched.
// =====================================================================
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 5099;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = 'Mumbai@2026';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fintrust-test-'));
let passed = 0;
let failed = 0;

function check(name, ok, extra = '') {
  if (ok) { passed += 1; console.log(`  ✔ ${name}`); } else { failed += 1; console.log(`  ✖ ${name} ${extra}`); }
}

class Client {
  constructor() { this.cookie = ''; }
  async call(method, url, body, headers = {}) {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  get(u) { return this.call('GET', u); }
  post(u, b = {}) { return this.call('POST', u, b); }
  patch(u, b = {}) { return this.call('PATCH', u, b); }
  put(u, b = {}) { return this.call('PUT', u, b); }
}

async function signIn(email, password = PASSWORD) {
  const c = new Client();
  const r1 = await c.post('/api/auth/login', { email, password });
  if (r1.status !== 200) return { c, r1 };
  const r2 = await c.post('/api/auth/verify', { challengeId: r1.data.challengeId, code: r1.data.demoCode });
  return { c, r1, r2 };
}

async function main() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, STORAGE: 'file', EMAIL_MODE: 'console', DEMO_MODE: 'true', NODE_ENV: 'development', SUPABASE_URL: '', DEMO_PASSWORD: PASSWORD, ADMIN_EMAIL: '', ANCHOR_PRIVATE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  try {
    const anon = new Client();
    console.log('\nBasics');
    check('health is ok', (await anon.get('/api/health')).status === 200);
    check('API needs sign-in', (await anon.get('/api/users')).status === 401);
    check('cross-site request blocked', (await anon.call('POST', '/api/auth/login', { email: 'a@b.co', password: 'x' }, { Origin: 'https://evil.example' })).status === 403);

    const demo = (await anon.get('/api/auth/demo-accounts')).data.accounts;
    const email = Object.fromEntries(demo.map((a) => [a.role, a.email]));
    check('5 demo accounts', demo.length === 5);

    console.log('\nSign-in');
    check('wrong password rejected', (await anon.post('/api/auth/login', { email: email.Employee, password: 'Wrong@12345' })).status === 401);
    const t = await anon.post('/api/auth/login', { email: email.Employee, password: PASSWORD });
    check('password ok -> code step', t.status === 200 && /^\d{6}$/.test(t.data.demoCode));
    const wrong = String((Number(t.data.demoCode) + 1) % 1000000).padStart(6, '0');
    check('wrong code rejected', (await anon.post('/api/auth/verify', { challengeId: t.data.challengeId, code: wrong })).status === 400);
    check('correct code accepted', (await anon.post('/api/auth/verify', { challengeId: t.data.challengeId, code: t.data.demoCode })).status === 200);
    check('code cannot be reused', (await new Client().post('/api/auth/verify', { challengeId: t.data.challengeId, code: t.data.demoCode })).status === 400);
    check('session works', (await anon.get('/api/auth/me')).data.user.role === 'Employee');
    await anon.post('/api/auth/logout');
    check('signed out', (await anon.get('/api/auth/me')).status === 401);

    const S = {};
    for (const role of ['System Administrator', 'Access Manager', 'IT Helpdesk', 'Auditor', 'Employee']) {
      const s = await signIn(email[role]);
      S[role] = s.c;
      check(`${role} signs in`, s.r2 && s.r2.status === 200);
    }
    const admin = S['System Administrator'];
    const am = S['Access Manager'];
    const hd = S['IT Helpdesk'];
    const au = S.Auditor;
    const emp = S.Employee;

    console.log('\nPermissions (RBAC)');
    const expect = {
      '/api/users': { 'System Administrator': 200, 'Access Manager': 200, 'IT Helpdesk': 200, Auditor: 200, Employee: 403 },
      '/api/audit': { 'System Administrator': 200, 'Access Manager': 403, 'IT Helpdesk': 403, Auditor: 200, Employee: 403 },
      '/api/access-grants': { 'System Administrator': 200, 'Access Manager': 200, 'IT Helpdesk': 403, Auditor: 200, Employee: 403 },
      '/api/policies': { 'System Administrator': 200, 'Access Manager': 403, 'IT Helpdesk': 403, Auditor: 200, Employee: 403 },
    };
    for (const [url, roles] of Object.entries(expect)) {
      for (const [role, code] of Object.entries(roles)) {
        const r = await S[role].get(url);
        check(`${role.padEnd(20)} GET ${url} -> ${code}`, r.status === code, `(got ${r.status})`);
      }
    }
    const meEmp = (await emp.get('/api/auth/me')).data.user;
    const users = (await admin.get('/api/users')).data.users;
    const other = users.find((u) => u.id !== meEmp.id && u.role === 'Employee' && u.status === 'active');
    check('employee cannot open another profile', (await emp.get(`/api/users/${other.id}`)).status === 403);
    check('employee can open own profile', (await emp.get(`/api/users/${meEmp.id}`)).status === 200);
    const pr = await emp.patch('/api/profile', { phone: '9876543210', role: 'System Administrator', status: 'active' });
    check('employee cannot change own role via profile', pr.status === 200 && pr.data.user.role === 'Employee' && pr.data.ignored.includes('role'));
    check('employee cannot change roles', (await emp.patch(`/api/users/${meEmp.id}/role`, { role: 'System Administrator', reason: 'hacking' })).status === 403);
    check('helpdesk cannot change roles', (await hd.patch(`/api/users/${other.id}/role`, { role: 'Auditor', reason: 'testing' })).status === 403);
    check('auditor cannot change policy', (await au.put('/api/policies', { lockout_minutes: 20 })).status === 403);
    check('access manager cannot invite', (await am.post('/api/users/invite', {})).status === 403);
    const meAdmin = (await admin.get('/api/auth/me')).data.user;
    check('admin cannot change own role', (await admin.patch(`/api/users/${meAdmin.id}/role`, { role: 'Employee', reason: 'testing self' })).status === 400);
    const otherAdmin = users.find((u) => u.role === 'System Administrator' && u.id !== meAdmin.id);
    check('helpdesk cannot reset an admin', (await hd.post(`/api/users/${otherAdmin.id}/send-reset`)).status === 403);

    console.log('\nAccess requests & approvals');
    const req1 = await emp.post('/api/access-requests', { application_id: 'AML', access_level: 'Read', justification: 'Need to view AML alerts for my customers.' });
    check('employee requests access', req1.status === 201);
    check('duplicate pending request blocked', (await emp.post('/api/access-requests', { application_id: 'AML', access_level: 'Write', justification: 'Need to view AML alerts for my customers.' })).status === 409);
    check('employee cannot approve', (await emp.post(`/api/access-requests/${req1.data.request.id}/decision`, { decision: 'approve' })).status === 403);
    const queue = (await am.get('/api/access-requests?status=pending')).data.requests;
    const own = queue.find((r) => r.user_id === (users.find((u) => u.email === email['Access Manager']) || {}).id);
    check('access manager sees own request as not reviewable', own && own.can_review === false);
    check('access manager cannot approve own request', (await am.post(`/api/access-requests/${own.id}/decision`, { decision: 'approve' })).status === 403);
    const crit = queue.find((r) => r.needs_admin);
    check('critical Admin request needs System Admin', crit && (await am.post(`/api/access-requests/${crit.id}/decision`, { decision: 'approve' })).status === 403);
    check('System Admin approves critical request', (await admin.post(`/api/access-requests/${crit.id}/decision`, { decision: 'approve' })).status === 200);
    check('reject needs a reason', (await am.post(`/api/access-requests/${req1.data.request.id}/decision`, { decision: 'reject' })).status === 400);
    check('access manager approves', (await am.post(`/api/access-requests/${req1.data.request.id}/decision`, { decision: 'approve', comment: 'ok' })).status === 200);
    check('cannot decide twice', (await am.post(`/api/access-requests/${req1.data.request.id}/decision`, { decision: 'reject', comment: 'changed mind' })).status === 409);
    const mine = (await emp.get('/api/access-grants/mine')).data.grants;
    const amlGrant = mine.find((g) => g.application_id === 'AML');
    check('access was granted', Boolean(amlGrant));
    check('auditor cannot revoke', (await au.post(`/api/access-grants/${amlGrant.id}/revoke`, { reason: 'testing' })).status === 403);
    check('access manager revokes', (await am.post(`/api/access-grants/${amlGrant.id}/revoke`, { reason: 'Project ended' })).status === 200);

    console.log('\nAccount lifecycle');
    const inv = await admin.post('/api/users/invite', { full_name: 'Ananya Iyer', email: 'ananya.iyer@example.com', role: 'Employee', department: 'Retail Banking', branch_id: 'FTBL0000301', designation: 'Relationship Manager', phone: '9840012345' });
    check('admin invites staff', inv.status === 201 && inv.data.link);
    check('duplicate email blocked', (await admin.post('/api/users/invite', { full_name: 'Ananya Iyer', email: 'ananya.iyer@example.com', role: 'Employee', department: 'Retail Banking', branch_id: 'FTBL0000301', designation: 'RM' })).status === 409);
    const token = inv.data.link.split('#token=')[1];
    check('invited user cannot sign in yet', (await new Client().post('/api/auth/login', { email: 'ananya.iyer@example.com', password: 'Chennai#2026' })).status === 401);
    check('weak password refused', (await anon.post('/api/auth/set-password', { token, password: 'password' })).status === 400);
    check('invite accepted', (await anon.post('/api/auth/set-password', { token, password: 'Chennai#2026' })).status === 200);
    check('invite link works only once', (await anon.post('/api/auth/set-password', { token, password: 'Chennai#2027' })).status === 400);
    const ananya = await signIn('ananya.iyer@example.com', 'Chennai#2026');
    check('new staff member signs in', ananya.r2 && ananya.r2.status === 200);

    console.log('\nProfile photos (required)');
    const ac = ananya.c;
    check('new staff member must add a photo', (await ac.get('/api/auth/me')).data.photoRequired === true);
    const blocked = await ac.get('/api/access-requests/mine');
    check('app is blocked until a photo is added', blocked.status === 403 && blocked.data.code === 'PHOTO_REQUIRED');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>').toString('base64');
    check('SVG photo refused (could carry scripts)', (await ac.put('/api/profile/photo', { image: svg })).status === 400);
    check('GIF photo refused', (await ac.put('/api/profile/photo', { image: Buffer.from('GIF89a\x01\x00\x01\x00').toString('base64') })).status === 400);
    check('non-image text refused', (await ac.put('/api/profile/photo', { image: 'not base64 !!' })).status === 400);
    const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(310 * 1024, 1)]).toString('base64');
    check('photo over 300 KB refused', (await ac.put('/api/profile/photo', { image: huge })).status === 413);
    const png = require('../src/seed-photos.json')[0];
    check('valid PNG photo accepted', (await ac.put('/api/profile/photo', { image: png })).status === 200);
    check('app opens once the photo is added', (await ac.get('/api/auth/me')).data.photoRequired === false && (await ac.get('/api/access-requests/mine')).status === 200);
    const ownPhoto = await emp.get(`/api/users/${meEmp.id}/photo`);
    check('own photo served as image with nosniff + sandbox', ownPhoto.status === 200 && ownPhoto.headers.get('content-type') === 'image/png' && ownPhoto.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(ownPhoto.headers.get('content-security-policy')));
    check("employee cannot view another person's photo", (await emp.get(`/api/users/${inv.data.user.id}/photo`)).status === 403);
    check('staff directory roles can view photos', (await hd.get(`/api/users/${inv.data.user.id}/photo`)).status === 200);
    check('employee photo list shows only themself', Object.keys((await emp.get('/api/photos')).data.photos).join() === meEmp.id);
    const hdDel = await hd.call('DELETE', `/api/users/${inv.data.user.id}/photo`, {}); check('helpdesk cannot remove photos', hdDel.status === 403);
    check('admin removes an unsuitable photo', (await admin.call('DELETE', `/api/users/${inv.data.user.id}/photo`, {})).status === 200);
    check('after removal a new photo is required again', (await ac.get('/api/access-requests/mine')).data.code === 'PHOTO_REQUIRED');
    await ac.put('/api/profile/photo', { image: png });
    const aid = inv.data.user.id;
    check('suspend needs reason', (await admin.patch(`/api/users/${aid}/status`, { status: 'suspended' })).status === 400);
    check('admin suspends', (await admin.patch(`/api/users/${aid}/status`, { status: 'suspended', reason: 'Investigation' })).status === 200);
    check('suspended user is signed out', (await ananya.c.get('/api/auth/me')).status === 401);
    check('suspended user cannot sign in', (await new Client().post('/api/auth/login', { email: 'ananya.iyer@example.com', password: 'Chennai#2026' })).status === 403);
    check('admin disables (leaver)', (await admin.patch(`/api/users/${aid}/status`, { status: 'disabled', reason: 'Resigned' })).status === 200);

    console.log('\nLockout & helpdesk');
    const victim = users.find((u) => u.full_name === 'Rahul Sharma');
    let last;
    for (let i = 0; i < 5; i += 1) last = await new Client().post('/api/auth/login', { email: victim.email, password: 'Wrong@99999' });
    check('5 wrong passwords lock the account', last.status === 423);
    check('locked even with right password', (await new Client().post('/api/auth/login', { email: victim.email, password: PASSWORD })).status === 423);
    check('employee cannot unlock', (await emp.post(`/api/users/${victim.id}/unlock`)).status === 403);
    check('helpdesk unlocks', (await hd.post(`/api/users/${victim.id}/unlock`)).status === 200);
    check('can sign in after unlock', (await new Client().post('/api/auth/login', { email: victim.email, password: PASSWORD })).status === 200);
    const rs = await hd.post(`/api/users/${victim.id}/send-reset`);
    check('helpdesk sends reset link', rs.status === 200 && rs.data.link);
    const rtoken = rs.data.link.split('#token=')[1];
    check('reset link sets new password', (await anon.post('/api/auth/set-password', { token: rtoken, password: 'Forex#Desk2026' })).status === 200);
    check('old password stops working', (await new Client().post('/api/auth/login', { email: victim.email, password: PASSWORD })).status === 401);

    console.log('\nBlockchain anchoring (switched off by default)');
    const bc = await au.get('/api/audit/blockchain');
    check('app runs normally with anchoring off', bc.status === 200 && bc.data.enabled === false);
    check('anchor refused while off', (await admin.post('/api/audit/blockchain/anchor', {})).status === 503);
    check('employee cannot open blockchain panel', (await emp.get('/api/audit/blockchain')).status === 403);
    check('helpdesk cannot anchor', (await hd.post('/api/audit/blockchain/anchor', {})).status === 403);

    console.log('\nAudit trail');
    const v = await au.get('/api/audit/verify');
    check('audit chain intact', v.data.ok === true, JSON.stringify(v.data));
    const denied = await au.get('/api/audit?outcome=denied');
    check('denied attempts were logged', denied.data.total > 3);
    const csv = await au.get('/api/audit/export');
    check('CSV export works', csv.status === 200 && String(csv.data).includes('time_ist'));

    // Tamper with the saved file, restart is not needed: verify reads memory,
    // so we check the tamper-detection logic directly.
    const auditLib = require('../src/audit');
    const rows = JSON.parse(fs.readFileSync(path.join(dataDir, 'fintrust-data.json'), 'utf8')).audit_log;
    rows[3].action = 'Something else';
    check('tampering is detected', auditLib.entryHash(rows[3]) !== rows[3].hash);
  } catch (err) {
    failed += 1;
    console.error('Test crashed:', err);
    console.error(log.slice(-2000));
  } finally {
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main();
