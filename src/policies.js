// Security policy values (editable by the System Administrator).
const store = require('./store');

const DEFAULTS = {
  password_min_length: 10,
  max_failed_logins: 5,
  lockout_minutes: 15,
  otp_expiry_minutes: 5,
  otp_max_attempts: 5,
  session_idle_minutes: 15,
  session_max_hours: 8,
  invite_expiry_hours: 72,
  reset_expiry_minutes: 30,
};

// What each value means and the range an admin may choose.
const RULES = {
  password_min_length:  { label: 'Minimum password length',              min: 8,  max: 32,  unit: 'characters' },
  max_failed_logins:    { label: 'Wrong passwords before lockout',       min: 3,  max: 10,  unit: 'attempts' },
  lockout_minutes:      { label: 'Lockout duration',                     min: 5,  max: 1440, unit: 'minutes' },
  otp_expiry_minutes:   { label: 'Sign-in code valid for',               min: 2,  max: 15,  unit: 'minutes' },
  otp_max_attempts:     { label: 'Wrong codes allowed',                  min: 3,  max: 10,  unit: 'attempts' },
  session_idle_minutes: { label: 'Sign out after inactivity',            min: 5,  max: 120, unit: 'minutes' },
  session_max_hours:    { label: 'Maximum session length',               min: 1,  max: 24,  unit: 'hours' },
  invite_expiry_hours:  { label: 'Invitation link valid for',            min: 1,  max: 168, unit: 'hours' },
  reset_expiry_minutes: { label: 'Password reset link valid for',        min: 10, max: 1440, unit: 'minutes' },
};

function getPolicies() {
  const row = store.get('settings', 'security_policy');
  return { ...DEFAULTS, ...(row ? row.value : {}) };
}

function getOrganization() {
  const row = store.get('settings', 'organization');
  return row ? row.value : {};
}

module.exports = { DEFAULTS, RULES, getPolicies, getOrganization };
