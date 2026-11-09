// Security helpers: password hashing, one-time codes, random tokens.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
// Used so "unknown email" takes as long as "wrong password".
// (Stops attackers from finding valid emails by timing the response.)
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

// Codes live only in server memory, so this key can change on every restart.
const CODE_KEY = crypto.randomBytes(32);

const hashPassword = (password) => bcrypt.hash(String(password), BCRYPT_ROUNDS);
const checkPassword = (password, hash) => bcrypt.compare(String(password || ''), hash || DUMMY_HASH);

// 256-bit random token for sessions, invitations and password resets.
const randomToken = () => crypto.randomBytes(32).toString('base64url');

// Only the SHA-256 of a token is stored. Even someone who reads the
// database cannot use the stored value to sign in.
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const hashCode = (challengeId, code) => crypto.createHmac('sha256', CODE_KEY).update(`${challengeId}:${code}`).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Returns a message explaining what is wrong, or null if the password is fine.
function passwordProblem(password, minLength, user = {}) {
  const p = String(password || '');
  if (p.length < minLength) return `Password must be at least ${minLength} characters.`;
  if (p.length > 72) return 'Password must be 72 characters or fewer.';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (kinds < 3) return 'Use at least three of: lowercase letters, uppercase letters, numbers, symbols.';
  const lower = p.toLowerCase();
  const local = String(user.email || '').split('@')[0].toLowerCase().replace(/\+.*/, '');
  if (local.length >= 4 && lower.includes(local)) return 'Password must not contain your email name.';
  const first = String(user.full_name || '').split(' ')[0].toLowerCase();
  if (first.length >= 4 && lower.includes(first)) return 'Password must not contain your name.';
  if (/^(password|qwerty|123456|abc123|welcome|admin)/i.test(p)) return 'That password is too easy to guess.';
  return null;
}

function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}

// "rahul.sharma@gmail.com" -> "ra*********@gmail.com"
function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

// Stable JSON (keys sorted) so the audit hash chain gives the same result
// after the data has been saved and loaded again.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

module.exports = {
  hashPassword, checkPassword, randomToken, hashToken, generateCode, hashCode, safeEqual,
  passwordProblem, normalizeEmail, maskEmail, stableStringify, sha256,
};
