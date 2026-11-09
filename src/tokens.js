// One-time links for invitations and password resets.
// The token travels in the link's #fragment (after the #), so it is never
// sent to the server in the URL and never appears in server logs.
const store = require('./store');
const { config } = require('./config');
const { randomToken, hashToken } = require('./security');
const { getPolicies } = require('./policies');

function baseUrl(req) {
  if (config.appBaseUrl) return config.appBaseUrl;
  return `${req.protocol}://${req.get('host')}`;
}

// type: "invite" or "reset"
async function createLink(req, user, type, createdBy) {
  const p = getPolicies();
  const now = new Date();
  // Older unused links of the same kind stop working.
  for (const t of store.find('user_tokens', (x) => x.user_id === user.id && x.type === type && !x.used_at && !x.revoked_at)) {
    await store.update('user_tokens', t.id, { revoked_at: now.toISOString() });
  }
  const token = randomToken();
  const ms = type === 'invite' ? p.invite_expiry_hours * 3600000 : p.reset_expiry_minutes * 60000;
  await store.insert('user_tokens', {
    user_id: user.id,
    type,
    token_hash: hashToken(token),
    created_by: createdBy ? createdBy.id : null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ms).toISOString(),
    used_at: null,
    revoked_at: null,
  });
  return `${baseUrl(req)}/set-password#token=${token}`;
}

// Returns { token, user } for a valid link, or throws a message.
function findValid(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 100) return { error: 'This link is not valid.' };
  const t = store.findOne('user_tokens', (x) => x.token_hash === hashToken(rawToken));
  if (!t) return { error: 'This link is not valid. Ask for a new one.' };
  if (t.used_at) return { error: 'This link has already been used. Sign in, or ask for a new link.' };
  if (t.revoked_at) return { error: 'This link was replaced by a newer one. Use the latest email.' };
  if (new Date(t.expires_at).getTime() < Date.now()) return { error: 'This link has expired. Ask IT Helpdesk for a new one.' };
  const user = store.get('users', t.user_id);
  if (!user || ['suspended', 'disabled'].includes(user.status)) return { error: 'This account is not active. Contact the System Administrator.' };
  return { token: t, user };
}

module.exports = { createLink, findValid, baseUrl };
