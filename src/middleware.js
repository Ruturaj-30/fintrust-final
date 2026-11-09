// Express middleware: security headers, CSRF protection, rate limits,
// sessions and permission checks.
const crypto = require('crypto');
const { config } = require('./config');
const store = require('./store');
const { hashToken, randomToken } = require('./security');
const { can } = require('./rbac');
const { getPolicies } = require('./policies');
const audit = require('./audit');

// ---------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------
function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
    "font-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "form-action 'self'",
    "base-uri 'self'", "object-src 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

// ---------------------------------------------------------------------
// CSRF protection: every change must come from our own pages, as JSON.
// ---------------------------------------------------------------------
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === req.get('host'); } catch { ok = false; }
    if (!ok) return res.status(403).json({ error: 'Request blocked: it did not come from this website.' });
  }
  if (!req.is('application/json')) return res.status(415).json({ error: 'Requests must be sent as JSON.' });
  next();
}

// ---------------------------------------------------------------------
// Rate limits (kept in memory). Messages clearly say they come from FinTrust.
// ---------------------------------------------------------------------
const buckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60000).unref();

function rateLimit({ name, windowMs, max, keyFn }) {
  return (req, res, next) => {
    const key = `${name}|${req.ip}|${keyFn ? keyFn(req) : ''}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > max) {
      const secs = Math.ceil((b.reset - now) / 1000);
      res.setHeader('Retry-After', String(secs));
      return res.status(429).json({
        error: `Too many attempts. Please wait ${secs > 90 ? `${Math.ceil(secs / 60)} minutes` : `${secs} seconds`} and try again.`,
        source: 'fintrust-rate-limit',
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------
// Sessions. Kept in server memory: a random token goes into an HttpOnly
// cookie and only its SHA-256 hash is kept on the server.
// ---------------------------------------------------------------------
const COOKIE = config.isProduction ? '__Host-ft_session' : 'ft_session';
const sessions = new Map(); // tokenHash -> session

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ }
    }
  });
  return out;
}

const cookieOptions = () => ({ httpOnly: true, secure: config.isProduction, sameSite: 'lax', path: '/' });

function createSession(req, res, user) {
  const token = randomToken();
  const now = Date.now();
  const session = {
    id: crypto.randomUUID(), userId: user.id, createdAt: now, lastSeen: now,
    ip: String(req.ip || '').replace(/^::ffff:/, ''), agent: String(req.get('user-agent') || '').slice(0, 120),
  };
  sessions.set(hashToken(token), session);
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: getPolicies().session_max_hours * 3600 * 1000 });
  return session;
}

function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) sessions.delete(hashToken(token));
  res.clearCookie(COOKIE, cookieOptions());
}

function revokeUserSessions(userId) {
  let n = 0;
  for (const [k, s] of sessions) if (s.userId === userId) { sessions.delete(k); n += 1; }
  return n;
}

const activeSessionsFor = (userId) => [...sessions.values()].filter((s) => s.userId === userId);
const activeSessionCount = () => new Set([...sessions.values()].map((s) => s.userId)).size;

// Never send password hashes or lock counters to the browser.
function publicUser(u) {
  if (!u) return null;
  const { password_hash: _p, failed_logins: _f, ...rest } = u;
  rest.has_password = Boolean(u.password_hash);
  rest.is_locked = Boolean(u.locked_until && new Date(u.locked_until).getTime() > Date.now());
  return rest;
}

function loadSession(req, res, next) {
  req.user = null;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || token.length > 100) return next();
  const key = hashToken(token);
  const s = sessions.get(key);
  if (!s) return next();
  const p = getPolicies();
  const now = Date.now();
  const user = store.get('users', s.userId);
  const expired = now - s.createdAt > p.session_max_hours * 3600000 || now - s.lastSeen > p.session_idle_minutes * 60000;
  if (expired || !user || user.status !== 'active') {
    sessions.delete(key);
    res.clearCookie(COOKIE, cookieOptions());
    req.sessionExpired = expired;
    return next();
  }
  s.lastSeen = now;
  req.user = publicUser(user);
  req.session = s;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: req.sessionExpired ? 'Your session expired. Please sign in again.' : 'Please sign in.' });
  }
  next();
}

// requirePermission('users.invite')  or  requirePermission(['a', 'b'])  (any of them)
function requirePermission(perm) {
  const perms = Array.isArray(perm) ? perm : [perm];
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in.' });
    if (perms.some((p) => can(req.user.role, p))) return next();
    await audit.record(req, {
      action: 'Permission denied',
      category: 'security',
      outcome: 'denied',
      details: { request: `${req.method} ${req.originalUrl.split('?')[0]}`, needed: perms.join(' or ') },
    });
    return res.status(403).json({ error: 'You do not have permission to do that.' });
  };
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  if (err.name === 'MailError') return res.status(502).json({ error: err.message });
  if (err.name === 'DbError') {
    console.error(`[database] ${req.method} ${req.path}: ${err.message}`);
    return res.status(503).json({ error: 'The database could not save this change. Check the server terminal.' });
  }
  console.error(`[error] ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the terminal for details.' });
}

module.exports = {
  securityHeaders, csrfProtection, rateLimit, createSession, destroySession, revokeUserSessions,
  activeSessionsFor, activeSessionCount, loadSession, requireAuth, requirePermission, publicUser,
  wrap, HttpError, errorHandler,
};
