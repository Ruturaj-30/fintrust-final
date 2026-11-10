// =====================================================================
//  Demo data for ONE organisation: FinTrust Bank Ltd. (fictional)
//  Runs automatically the first time the app starts with an empty store.
//  All people, numbers and codes are invented. Real Indian bank names
//  appear only as partner / settlement banks.
// =====================================================================
const crypto = require('crypto');
const store = require('./store');
const { config } = require('./config');
const { hashPassword, stableStringify, sha256 } = require('./security');
const { DEFAULTS } = require('./policies');
const { GENESIS } = require('./audit');
 
const ORGANIZATION = {
  name: 'FinTrust Bank Ltd.',
  short_name: 'FinTrust Bank',
  tagline: 'Secure access for every employee, every branch.',
  headquarters: 'FinTrust House, Nariman Point, Mumbai, Maharashtra 400021',
  established: 1998,
  type: 'Private sector scheduled commercial bank (fictional)',
  ifsc_prefix: 'FTBL',
  swift: 'FTBLINBB (fictional)',
  cin: 'U65190MH1998PLC000000 (fictional)',
  regulator: 'Reserve Bank of India (simulated for this project)',
  payment_systems: ['NEFT', 'RTGS', 'IMPS', 'UPI', 'CTS cheque clearing'],
  note: 'FinTrust Bank Ltd. is a fictional bank created for a college project. No real customer data is used.',
};
 
const BRANCHES = [
  { id: 'FTBL0000001', name: 'Head Office, Nariman Point', city: 'Mumbai', state: 'Maharashtra', type: 'Head Office', pincode: '400021' },
  { id: 'FTBL0000101', name: 'Shivajinagar', city: 'Pune', state: 'Maharashtra', type: 'Branch', pincode: '411005' },
  { id: 'FTBL0000201', name: 'MG Road', city: 'Bengaluru', state: 'Karnataka', type: 'Branch', pincode: '560001' },
  { id: 'FTBL0000301', name: 'T. Nagar', city: 'Chennai', state: 'Tamil Nadu', type: 'Branch', pincode: '600017' },
  { id: 'FTBL0000401', name: 'Connaught Place', city: 'New Delhi', state: 'Delhi', type: 'Regional Office', pincode: '110001' },
  { id: 'FTBL0000501', name: 'Park Street', city: 'Kolkata', state: 'West Bengal', type: 'Branch', pincode: '700016' },
  { id: 'FTBL0000601', name: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', type: 'Branch', pincode: '500034' },
  { id: 'FTBL0000701', name: 'CG Road', city: 'Ahmedabad', state: 'Gujarat', type: 'Branch', pincode: '380009' },
  { id: 'FTBL0000801', name: 'MI Road', city: 'Jaipur', state: 'Rajasthan', type: 'Branch', pincode: '302001' },
];
 
const DEPARTMENTS = [
  'Information Technology', 'Information Security', 'Retail Banking', 'Loans & Advances', 'Treasury',
  'Branch Operations', 'Compliance & Risk', 'Human Resources', 'Internal Audit',
].map((name, i) => ({ id: `D${String(i + 1).padStart(2, '0')}`, name }));
 
// Real Indian banks, used ONLY as settlement / correspondent partners.
// IFSC prefixes are the banks' public codes.
const PARTNER_BANKS = [
  { id: 'SBIN', name: 'State Bank of India', ifsc_prefix: 'SBIN', sector: 'Public sector', headquarters: 'Mumbai', relationship: 'RTGS / NEFT settlement partner' },
  { id: 'HDFC', name: 'HDFC Bank', ifsc_prefix: 'HDFC', sector: 'Private sector', headquarters: 'Mumbai', relationship: 'Correspondent bank for card settlements' },
  { id: 'ICIC', name: 'ICICI Bank', ifsc_prefix: 'ICIC', sector: 'Private sector', headquarters: 'Mumbai', relationship: 'Treasury counterparty (money market)' },
  { id: 'UTIB', name: 'Axis Bank', ifsc_prefix: 'UTIB', sector: 'Private sector', headquarters: 'Mumbai', relationship: 'Cash management partner' },
  { id: 'KKBK', name: 'Kotak Mahindra Bank', ifsc_prefix: 'KKBK', sector: 'Private sector', headquarters: 'Mumbai', relationship: 'Treasury counterparty (forex)' },
  { id: 'PUNB', name: 'Punjab National Bank', ifsc_prefix: 'PUNB', sector: 'Public sector', headquarters: 'New Delhi', relationship: 'Consortium lending partner' },
  { id: 'BARB', name: 'Bank of Baroda', ifsc_prefix: 'BARB', sector: 'Public sector', headquarters: 'Vadodara', relationship: 'Consortium lending partner' },
  { id: 'CNRB', name: 'Canara Bank', ifsc_prefix: 'CNRB', sector: 'Public sector', headquarters: 'Bengaluru', relationship: 'Cheque clearing (CTS) partner' },
  { id: 'UBIN', name: 'Union Bank of India', ifsc_prefix: 'UBIN', sector: 'Public sector', headquarters: 'Mumbai', relationship: 'Government business partner' },
  { id: 'INDB', name: 'IndusInd Bank', ifsc_prefix: 'INDB', sector: 'Private sector', headquarters: 'Pune', relationship: 'ATM network sharing partner' },
];
 
const APPLICATIONS = [
  { id: 'CBS', name: 'Core Banking System', description: 'Customer accounts, savings and current accounts, fixed deposits, branch transactions.', owner_department: 'Branch Operations', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'PAY', name: 'NEFT / RTGS Payment Gateway', description: 'Sends and receives inter-bank payments through RBI payment systems.', owner_department: 'Branch Operations', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'UPI', name: 'UPI & IMPS Switch Console', description: 'Monitors UPI and IMPS transactions routed through NPCI.', owner_department: 'Information Technology', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'TRS', name: 'Treasury Dealing Platform', description: 'Forex and government securities dealing, money market.', owner_department: 'Treasury', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'LOS', name: 'Loan Origination System', description: 'Home, personal, vehicle and MSME loan applications and sanctions.', owner_department: 'Loans & Advances', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'KYC', name: 'KYC & CKYC Verification Portal', description: 'Customer KYC checks: PAN validation, masked Aadhaar e-KYC, CKYC records.', owner_department: 'Compliance & Risk', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'AML', name: 'AML Transaction Monitoring', description: 'Flags suspicious transactions and prepares reports for FIU-IND.', owner_department: 'Compliance & Risk', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'NBK', name: 'Internet Banking Admin Console', description: 'Manages customer internet banking registrations and limits.', owner_department: 'Retail Banking', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'HRM', name: 'HRMS (Payroll & Leave)', description: 'Payslips, leave, attendance and employee records.', owner_department: 'Human Resources', risk: 'medium', levels: ['Read', 'Write', 'Admin'] },
  { id: 'GRC', name: 'Risk & Compliance Register', description: 'RBI circular tracking, risk register and policy exceptions.', owner_department: 'Compliance & Risk', risk: 'medium', levels: ['Read', 'Write', 'Admin'] },
  // Payment systems (added Nov 2026). Read = enquiry and reports, Write = maker
  // (enter or initiate), Admin = configuration, limits and user setup.
  { id: 'CMS', name: 'Debit Card Management (RuPay)', description: 'Issue, block and hotlist RuPay debit cards, regenerate PINs and set ATM / POS / e-commerce limits.', owner_department: 'Retail Banking', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'SWF', name: 'SWIFT & Foreign Remittance', description: 'Outward and inward cross-border remittances (SWIFT MT103), LRS payments and FEMA reporting.', owner_department: 'Treasury', risk: 'critical', levels: ['Read', 'Write', 'Admin'] },
  { id: 'CTS', name: 'Cheque Truncation & Clearing (CTS)', description: 'Inward and outward cheque clearing on the NPCI CTS grid, Positive Pay checks and cheque returns.', owner_department: 'Branch Operations', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'NACH', name: 'NACH & e-Mandate Hub', description: 'NPCI NACH debits and credits: EMI auto-debits, salary credits and customer e-mandates.', owner_department: 'Branch Operations', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'AEPS', name: 'AePS & Business Correspondent Portal', description: 'Aadhaar-enabled cash withdrawals and deposits through village Business Correspondent agents and micro-ATMs.', owner_department: 'Retail Banking', risk: 'high', levels: ['Read', 'Write', 'Admin'] },
  { id: 'BBPS', name: 'Bharat BillPay (BBPS) Operations', description: 'Electricity, mobile, FASTag and other bill payments through Bharat BillPay, with customer complaints.', owner_department: 'Retail Banking', risk: 'medium', levels: ['Read', 'Write', 'Admin'] },
  { id: 'MAIL', name: 'Email & Collaboration', description: 'Bank email, calendar and document sharing.', owner_department: 'Information Technology', risk: 'low', levels: ['Read', 'Write', 'Admin'] },
];
 
// key, name, role, department, branch, designation, manager key, status, phone
const PEOPLE = [
  ['admin', 'Rohan Deshmukh', 'System Administrator', 'Information Technology', 'FTBL0000001', 'Head – IT Infrastructure', null, 'active', '9820012345'],
  ['ciso', 'Vikram Malhotra', 'System Administrator', 'Information Security', 'FTBL0000401', 'Chief Information Security Officer', null, 'active', '9811023456'],
  ['access', 'Priya Nair', 'Access Manager', 'Information Security', 'FTBL0000001', 'Manager – Identity & Access', 'ciso', 'active', '9833034567'],
  ['helpdesk', 'Arjun Reddy', 'IT Helpdesk', 'Information Technology', 'FTBL0000601', 'IT Support Executive', 'admin', 'active', '9849045678'],
  ['auditor', 'Kavita Menon', 'Auditor', 'Internal Audit', 'FTBL0000301', 'Senior Internal Auditor', null, 'active', '9840056789'],
  ['employee', 'Sneha Kulkarni', 'Employee', 'Retail Banking', 'FTBL0000101', 'Relationship Manager', 'pooja_mgr', 'active', '9822067890'],
  ['pooja_mgr', 'Aditya Joshi', 'Employee', 'Retail Banking', 'FTBL0000101', 'Branch Manager', null, 'active', '9822178901'],
  ['rahul', 'Rahul Sharma', 'Employee', 'Treasury', 'FTBL0000001', 'Dealer – Forex', 'venkat', 'active', '9819089012'],
  ['venkat', 'Venkatesh Rao', 'Employee', 'Treasury', 'FTBL0000001', 'Head – Treasury', null, 'active', '9820190123'],
  ['aisha', 'Aisha Khan', 'Employee', 'Loans & Advances', 'FTBL0000201', 'Credit Officer', 'divya', 'active', '9845001234'],
  ['divya', 'Divya Hegde', 'Employee', 'Loans & Advances', 'FTBL0000201', 'Credit Manager', null, 'active', '9845112345'],
  ['suresh', 'Suresh Patel', 'Employee', 'Branch Operations', 'FTBL0000701', 'Branch Manager', null, 'active', '9825023456'],
  ['meera', 'Meera Joshi', 'Employee', 'Compliance & Risk', 'FTBL0000001', 'Compliance Officer', null, 'active', '9833134567'],
  ['deepak', 'Deepak Chauhan', 'Employee', 'Branch Operations', 'FTBL0000801', 'Cashier', 'suresh', 'active', '9829045678'],
  ['lakshmi', 'Lakshmi Subramanian', 'Employee', 'Retail Banking', 'FTBL0000301', 'Branch Manager', null, 'active', '9840156789'],
  ['sourav', 'Sourav Banerjee', 'Employee', 'Branch Operations', 'FTBL0000501', 'Operations Head – East', null, 'active', '9830067890'],
  ['harpreet', 'Harpreet Kaur', 'Employee', 'Retail Banking', 'FTBL0000401', 'Relationship Manager', null, 'active', '9811178901'],
  ['nikhil', 'Nikhil Gupta', 'Employee', 'Information Technology', 'FTBL0000201', 'Application Developer', 'admin', 'active', '9845289012'],
  ['fatima', 'Fatima Sheikh', 'Employee', 'Human Resources', 'FTBL0000001', 'HR Business Partner', null, 'active', '9820290123'],
  ['ritu', 'Ritu Agarwal', 'Employee', 'Compliance & Risk', 'FTBL0000501', 'AML Analyst', 'meera', 'active', '9830101234'],
  ['manoj', 'Manoj Pillai', 'Employee', 'Information Technology', 'FTBL0000601', 'Network Engineer', 'admin', 'active', '9849112345'],
  ['pooja', 'Pooja Patil', 'Employee', 'Loans & Advances', 'FTBL0000101', 'Loan Officer', 'pooja_mgr', 'active', '9822323456'],
  ['amit', 'Amit Verma', 'Employee', 'Retail Banking', 'FTBL0000401', 'Teller', 'harpreet', 'suspended', '9811334567'],
  ['sanjay', 'Sanjay Mishra', 'Employee', 'Branch Operations', 'FTBL0000401', 'Clearing Officer', null, 'disabled', '9811445678'],
  ['neha', 'Neha Bhatt', 'Employee', 'Retail Banking', 'FTBL0000701', 'Relationship Manager', 'suresh', 'invited', '9825156789'],
  ['karan', 'Karan Singh Rathore', 'Employee', 'Branch Operations', 'FTBL0000801', 'Assistant Manager', 'suresh', 'invited', '9829267890'],
];
 
// Demo sign-in accounts: one per role.
const DEMO_KEYS = { admin: 'admin', access: 'access', helpdesk: 'helpdesk', auditor: 'auditor', employee: 'employee' };
 
function emailFor(key, name) {
  const admin = config.adminEmail;
  if (admin && DEMO_KEYS[key]) {
    const [local, domain] = admin.split('@');
    // Gmail delivers name+anything@gmail.com to name@gmail.com, so every
    // demo account's code arrives in YOUR inbox.
    return key === 'admin' ? admin : `${local}+${key}@${domain}`;
  }
  return `${name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).join('.')}@fintrustbank.example`;
}
 
async function seed() {
  const now = Date.now();
  const DAY = 86400000;
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
 
  console.log('  Creating the FinTrust Bank demo organisation (first start only)...');
  const hash = await hashPassword(config.demoPassword || crypto.randomBytes(18).toString('base64url'));
 
  // ---- people
  const ids = {};
  PEOPLE.forEach(([key]) => { ids[key] = crypto.randomUUID(); });
  const users = PEOPLE.map(([key, name, role, department, branch, designation, mgr, status, phone], i) => {
    const created = iso((90 - i) * DAY);
    return {
      id: ids[key],
      employee_id: `FTB${10001 + i}`,
      full_name: name,
      email: emailFor(key, name),
      role,
      status,
      department,
      branch_id: branch,
      designation,
      manager_id: mgr ? ids[mgr] : null,
      phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
      password_hash: status === 'invited' ? null : hash,
      failed_logins: 0,
      locked_until: key === 'pooja' ? new Date(now + 12 * 3600000).toISOString() : null,
      last_login_at: status === 'invited' ? null : iso(['sanjay', 'manoj'].includes(key) ? rnd(40, 60) * DAY : rnd(1, 72) * 3600000),
      password_changed_at: status === 'invited' ? null : created,
      activated_at: status === 'invited' ? null : created,
      invited_by: key === 'admin' ? null : ids.admin,
      created_at: created,
      updated_at: created,
    };
  });
 
  // ---- access grants
  const grants = [];
  const grant = (key, app, level, daysAgo, by = 'access', status = 'active') => grants.push({
    id: crypto.randomUUID(), user_id: ids[key], application_id: app, access_level: level, status,
    request_id: null, granted_by: ids[by], granted_at: iso(daysAgo * DAY),
    revoked_at: status === 'revoked' ? iso(5 * DAY) : null,
    revoked_by: status === 'revoked' ? ids.admin : null,
    revoke_reason: status === 'revoked' ? 'Account disabled (leaver)' : null,
  });
  PEOPLE.forEach(([key, , , dept, , , , status]) => {
    if (status === 'invited') return;
    const st = status === 'disabled' ? 'revoked' : 'active';
    if (key !== 'admin') grant(key, 'MAIL', 'Write', 85, 'admin', st);
    grant(key, 'HRM', 'Read', 85, 'admin', st);
    if (dept === 'Branch Operations') grant(key, 'CBS', 'Write', rnd(20, 70), 'access', st);
    if (dept === 'Retail Banking') { grant(key, 'CBS', 'Read', rnd(20, 70), 'access', st); grant(key, 'NBK', 'Read', rnd(10, 60), 'access', st); }
    if (dept === 'Loans & Advances') { grant(key, 'LOS', 'Write', rnd(20, 70), 'access', st); grant(key, 'KYC', 'Read', rnd(10, 60), 'access', st); }
    if (dept === 'Treasury') grant(key, 'TRS', key === 'venkat' ? 'Admin' : 'Write', rnd(20, 70), key === 'venkat' ? 'ciso' : 'access', st);
    if (dept === 'Compliance & Risk') { grant(key, 'AML', 'Write', rnd(20, 70), 'access', st); grant(key, 'GRC', 'Write', rnd(10, 60), 'access', st); }
    if (dept === 'Human Resources') grant(key, 'HRM', 'Admin', 60, 'admin', st);
  });
  grant('admin', 'CBS', 'Admin', 80, 'ciso');
  grant('admin', 'MAIL', 'Admin', 80, 'ciso');
  grant('nikhil', 'NBK', 'Write', 30);
  grant('manoj', 'UPI', 'Read', 25);
  grant('sourav', 'PAY', 'Write', 40);
  grant('suresh', 'PAY', 'Read', 35);
  grant('auditor', 'GRC', 'Read', 50, 'admin');
  // HR "Admin" replaces the basic HR "Read" for Fatima
  const dup = grants.find((g) => g.user_id === ids.fatima && g.application_id === 'HRM' && g.access_level === 'Read');
  Object.assign(dup, { status: 'revoked', revoked_at: iso(60 * DAY), revoked_by: ids.access, revoke_reason: 'Replaced by Admin access' });
 
  // ---- access requests (some decided, some waiting)
  const requests = [];
  const request = (key, app, level, why, daysAgo, status = 'pending', reviewer = null, comment = null) => {
    const r = {
      id: crypto.randomUUID(), user_id: ids[key], application_id: app, access_level: level, justification: why,
      status, created_at: iso(daysAgo * DAY), reviewer_id: reviewer ? ids[reviewer] : null,
      reviewed_at: status === 'pending' ? null : iso((daysAgo - 1) * DAY), review_comment: comment,
    };
    requests.push(r);
    return r;
  };
  request('employee', 'LOS', 'Read', 'Need to track home loan applications of my branch customers in Pune.', 2);
  request('rahul', 'PAY', 'Write', 'Treasury needs to initiate RTGS settlements for money market deals.', 3);
  request('aisha', 'KYC', 'Write', 'Credit team must update CKYC records during MSME loan processing.', 1);
  request('nikhil', 'CBS', 'Admin', 'Deploying the new fixed deposit interest module this weekend.', 1);
  request('access', 'AML', 'Read', 'Reviewing who can see AML alerts as part of the quarterly access review.', 1);
  request('lakshmi', 'UPI', 'Read', 'Customers at T. Nagar branch report failed UPI payments; need to check status.', 4);
  const r1 = request('nikhil', 'NBK', 'Write', 'Support the internet banking limit change project.', 31, 'approved', 'access', 'Approved for the project.');
  const r2 = request('sourav', 'PAY', 'Write', 'Operations Head East needs to release NEFT batches.', 41, 'approved', 'access', null);
  request('deepak', 'TRS', 'Read', 'Want to learn how forex rates are set.', 20, 'rejected', 'access', 'Not needed for the cashier role. Ask Treasury for the daily rate sheet.');
  request('harpreet', 'LOS', 'Write', 'Help a customer with a personal loan.', 12, 'rejected', 'access', 'Relationship Managers get Read only. Loan officers process applications.');
  request('meera', 'GRC', 'Admin', 'Manage the RBI circular tracker.', 9, 'cancelled', null, null);
  request('ritu', 'KYC', 'Read', 'Cross-check KYC documents for flagged AML alerts.', 11, 'approved', 'access', 'Needed for AML investigations.');
  request('fatima', 'GRC', 'Read', 'Track HR policy exceptions raised in audits.', 8, 'approved', 'access', null);
  request('manoj', 'PAY', 'Write', 'Restart stuck NEFT batches during outages.', 7, 'rejected', 'access', 'Network team gets Read only. Operations releases batches.');
  request('divya', 'KYC', 'Write', 'Update CKYC records after MSME loan sanction.', 6, 'approved', 'access', 'Approved for credit managers.');
  request('harpreet', 'NBK', 'Write', 'Reset internet banking limits for walk-in customers.', 5, 'rejected', 'access', 'Limit changes need branch manager approval.');
  grant('ritu', 'KYC', 'Read', 10);
  grant('fatima', 'GRC', 'Read', 7);
  grant('divya', 'KYC', 'Write', 5);
  Object.assign(grants.find((g) => g.user_id === ids.divya && g.application_id === 'KYC' && g.access_level === 'Read'),
    { status: 'revoked', revoked_at: iso(5 * DAY), revoked_by: ids.access, revoke_reason: 'Replaced by Write access' });
  grants.find((g) => g.user_id === ids.nikhil && g.application_id === 'NBK').request_id = r1.id;
  grants.find((g) => g.user_id === ids.sourav && g.application_id === 'PAY').request_id = r2.id;
 
  // ---- audit history (with the hash chain)
  const byKey = Object.fromEntries(PEOPLE.map(([key], i) => [key, users[i]]));
  const events = [];
  const ev = (msAgo, actorKey, action, category, outcome, targetKey, details = {}, ip = '10.20.1.15') => {
    const actor = actorKey ? byKey[actorKey] : null;
    const target = targetKey ? byKey[targetKey] : null;
    events.push({
      at: iso(msAgo), actor_id: actor ? actor.id : null, actor_name: actor ? actor.full_name : 'System', actor_role: actor ? actor.role : 'System',
      action, category, outcome, target_type: target ? 'user' : null, target_id: target ? target.id : null,
      target_label: target ? `${target.full_name} (${target.employee_id})` : (details.label || null), details: details.label ? {} : details, ip,
    });
  };
  ev(90 * DAY, null, 'FinTrust Bank IAM initialised', 'policy', 'success', null, { label: 'FinTrust Bank Ltd.' }, 'system');
  PEOPLE.forEach(([key, , role], i) => { if (key !== 'admin') ev((90 - i) * DAY - 3600000, 'admin', 'Staff member invited', 'account', 'success', key, { role }); });
  ev(30 * DAY, 'access', 'Access approved and granted', 'access', 'success', null, { label: 'Internet Banking Admin Console (Write) for Nikhil Gupta' });
  ev(20 * DAY, 'access', 'Access request rejected', 'access', 'success', null, { label: 'Treasury Dealing Platform (Read) for Deepak Chauhan' });
  ev(12 * DAY, 'access', 'Access request rejected', 'access', 'success', null, { label: 'Loan Origination System (Write) for Harpreet Kaur' });
  ev(8 * DAY, 'admin', 'Account suspended', 'account', 'success', 'amit', { from: 'active', to: 'suspended', reason: 'Cash shortage under investigation at CP branch' });
  ev(5 * DAY, 'admin', 'Account disabled (leaver)', 'account', 'success', 'sanjay', { from: 'active', to: 'disabled', reason: 'Resigned, last working day', access_revoked: 3 });
  ev(3 * DAY, 'employee', 'Permission denied', 'security', 'denied', null, { request: 'GET /api/users', needed: 'users.view' }, '10.20.4.31');
  ev(2 * DAY, null, 'Sign-in failed (unknown email)', 'security', 'failure', null, { email: 'ad***@fintrustbank.example' }, '103.21.58.4');
  for (let k = 1; k <= 4; k += 1) ev(3600000 * 3 - k * 60000, 'pooja', 'Sign-in failed (wrong password)', 'security', 'failure', 'pooja', { attempt: k, limit: 5 }, '10.20.2.44');
  ev(3600000 * 3 - 5 * 60000, 'pooja', 'Account locked (too many wrong passwords)', 'security', 'failure', 'pooja', { attempt: 5, limit: 5 }, '10.20.2.44');
  ['admin', 'access', 'auditor', 'rahul', 'aisha', 'lakshmi'].forEach((k, i) => ev((i + 1) * 5400000, k, 'Signed in (password + email code)', 'auth', 'success', k, {}, `10.20.${i + 1}.${20 + i}`));
  // Two weeks of everyday activity, so the dashboard charts have a realistic history.
  const regulars = PEOPLE.filter(([k, , , , , , , st]) => st === 'active' && k !== 'pooja').map(([k]) => k);
  for (let day = 13; day >= 1; day -= 1) {
    const weekend = [0, 6].includes(new Date(now - day * DAY).getDay());
    const signIns = weekend ? rnd(1, 3) : rnd(6, 12);
    for (let n = 0; n < signIns; n += 1) {
      const k = regulars[rnd(0, regulars.length - 1)];
      ev(day * DAY - rnd(1, 9) * 3600000, k, 'Signed in (password + email code)', 'auth', 'success', k, {}, `10.20.${rnd(1, 9)}.${rnd(10, 250)}`);
    }
    const fails = weekend ? rnd(0, 1) : rnd(0, 3);
    for (let n = 0; n < fails; n += 1) {
      const k = regulars[rnd(0, regulars.length - 1)];
      ev(day * DAY - rnd(1, 9) * 3600000, k, 'Sign-in failed (wrong password)', 'security', 'failure', k, { attempt: 1, limit: 5 }, `10.20.${rnd(1, 9)}.${rnd(10, 250)}`);
    }
    if (!weekend && rnd(0, 2) === 0) ev(day * DAY - rnd(1, 9) * 3600000, 'helpdesk', 'Password reset link sent', 'security', 'success', regulars[rnd(0, regulars.length - 1)], { email_sent: true });
  }
  requests.filter((r) => r.status === 'pending').forEach((r) => {
    const who = users.find((u) => u.id === r.user_id);
    const app = APPLICATIONS.find((a) => a.id === r.application_id);
    events.push({
      at: r.created_at, actor_id: who.id, actor_name: who.full_name, actor_role: who.role, action: 'Access requested', category: 'access', outcome: 'success',
      target_type: 'request', target_id: r.id, target_label: `${app.name} (${r.access_level})`, details: { application: app.name, level: r.access_level }, ip: '10.20.3.12',
    });
  });
  events.sort((a, b) => a.at.localeCompare(b.at));
  let prev = GENESIS;
  const auditRows = events.map((e, i) => {
    const row = { id: i + 1, ...e, prev_hash: prev };
    row.hash = sha256(stableStringify(row));
    prev = row.hash;
    return row;
  });
 
  // ---- save, parents first
  await store.bulkInsert('settings', [
    { id: 'organization', value: ORGANIZATION, updated_at: iso(90 * DAY), updated_by: null },
    { id: 'security_policy', value: DEFAULTS, updated_at: iso(90 * DAY), updated_by: null },
  ]);
  await store.bulkInsert('partner_banks', PARTNER_BANKS);
  await store.bulkInsert('branches', BRANCHES);
  await store.bulkInsert('departments', DEPARTMENTS);
  await store.bulkInsert('applications', APPLICATIONS.map((a) => ({ ...a, active: true })));
  // managers must exist before the people who report to them
  const ordered = [...users.filter((u) => !u.manager_id), ...users.filter((u) => u.manager_id)];
  await store.bulkInsert('users', ordered);
  await store.bulkInsert('access_requests', requests);
  await store.bulkInsert('access_grants', grants);
  // Neutral placeholder photos for everyone who has already joined, so the
  // demo works straight away. Invited people must add their own photo.
  const placeholders = require('./seed-photos.json');
  await store.bulkInsert('user_photos', users.filter((u) => u.status !== 'invited').map((u, i) => ({
    id: u.id, mime: 'image/png', data: placeholders[i % placeholders.length], updated_at: u.created_at, updated_by: null,
  })));
  await store.bulkInsert('audit_log', auditRows);
 
  return users.filter((u) => Object.keys(DEMO_KEYS).some((k) => ids[k] === u.id));
}
 
// Adds any application from the list above that the database does not have yet.
// Runs at every start, so new applications also reach an existing (already
// seeded) Supabase database or data file. Existing applications are untouched.
async function syncApplications() {
  const missing = APPLICATIONS.filter((a) => !store.get('applications', a.id));
  for (const app of missing) {
    await store.insert('applications', { ...app, active: true });
    await require('./audit').record(null, {
      action: 'Application added to catalogue', category: 'access',
      target: { type: 'application', id: app.id, label: app.name }, details: { risk: app.risk, owner: app.owner_department },
    });
  }
  if (missing.length) console.log(`  Added ${missing.length} new application(s): ${missing.map((a) => a.id).join(', ')}`);
}
 
module.exports = { seed, syncApplications, ORGANIZATION };
 