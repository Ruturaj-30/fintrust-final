// =====================================================================
//  Role-Based Access Control (RBAC)
//  This is the ONE place where "who may do what" is decided.
//  Every protected API route calls requirePermission('...'), which looks
//  the user's role up here. The browser only uses this list to decide
//  which menu items to show; the SERVER always checks again.
// =====================================================================

const ADMIN = 'System Administrator';
const ACCESS_MANAGER = 'Access Manager';
const HELPDESK = 'IT Helpdesk';
const AUDITOR = 'Auditor';
const EMPLOYEE = 'Employee';

const ROLES = [ADMIN, ACCESS_MANAGER, HELPDESK, AUDITOR, EMPLOYEE];

const ROLE_INFO = {
  [ADMIN]: 'Manages staff accounts, invitations, roles and security policies.',
  [ACCESS_MANAGER]: 'Reviews access requests and grants or revokes application access.',
  [HELPDESK]: 'Helps staff: unlocks accounts and sends password reset links. Cannot change roles.',
  [AUDITOR]: 'Read-only. Reviews the audit trail and who has access to what.',
  [EMPLOYEE]: 'Uses bank applications and requests the access needed for the job.',
};

const EVERYONE = ROLES;

const PERMISSIONS = {
  // Every signed-in person
  'profile.self':          EVERYONE,
  'access.request':        EVERYONE,

  // Staff directory and account management
  'users.view':            [ADMIN, ACCESS_MANAGER, HELPDESK, AUDITOR],
  'users.invite':          [ADMIN],
  'users.change_role':     [ADMIN],
  'users.change_status':   [ADMIN],             // suspend / re-activate / disable
  'users.edit_details':    [ADMIN],             // department, branch, designation, manager
  'users.unlock':          [ADMIN, HELPDESK],   // clear a lock after wrong passwords
  'users.send_reset':      [ADMIN, HELPDESK],   // email a password reset link
  'users.resend_invite':   [ADMIN, HELPDESK],
  'sessions.revoke':       [ADMIN],             // force sign-out everywhere

  // Access governance
  'access.view_all':       [ADMIN, ACCESS_MANAGER, AUDITOR],
  'access.review':         [ADMIN, ACCESS_MANAGER], // approve or reject
  'access.review_critical':[ADMIN],                 // "Admin" level on critical systems
  'access.revoke':         [ADMIN, ACCESS_MANAGER],

  // Audit and policy
  'audit.view':            [ADMIN, AUDITOR],
  'audit.verify':          [ADMIN, AUDITOR],
  'policies.view':         [ADMIN, AUDITOR],
  'policies.manage':       [ADMIN],
};

function can(role, permission) {
  const allowed = PERMISSIONS[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

const permissionsFor = (role) => Object.keys(PERMISSIONS).filter((p) => can(role, p));

// Sidebar menu. "perm" = permission needed to see the item.
const NAV = [
  { id: 'dashboard', label: 'Dashboard',        perm: 'profile.self' },
  { id: 'my-access', label: 'My Access',        perm: 'access.request' },
  { id: 'approvals', label: 'Approvals',        perm: 'access.review' },
  { id: 'access',    label: 'Access Register',  perm: 'access.view_all' },
  { id: 'users',     label: 'Staff & Accounts', perm: 'users.view' },
  { id: 'audit',     label: 'Audit Trail',      perm: 'audit.view' },
  { id: 'policies',  label: 'Security Policy',  perm: 'policies.view' },
  { id: 'bank',      label: 'About the Bank',   perm: 'profile.self' },
  { id: 'profile',   label: 'My Profile',       perm: 'profile.self' },
];

const navFor = (role) => NAV.filter((n) => can(role, n.perm)).map(({ id, label }) => ({ id, label }));

module.exports = {
  ROLES, ROLE_INFO, PERMISSIONS, can, permissionsFor, navFor,
  ADMIN, ACCESS_MANAGER, HELPDESK, AUDITOR, EMPLOYEE,
};
