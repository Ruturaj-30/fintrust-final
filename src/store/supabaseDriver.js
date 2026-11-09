// Saves data into your free Supabase PostgreSQL database, using
// Supabase's REST API (no extra packages needed).
// Used when the app is published online (Render deletes local files).
const { config } = require('../config');

const ORDER = {
  settings: 'id', partner_banks: 'id', branches: 'id', departments: 'id', applications: 'id',
  users: 'created_at', access_requests: 'created_at', access_grants: 'granted_at',
  user_tokens: 'created_at', user_photos: 'id', audit_anchors: 'created_at', audit_log: 'id',
};

function headers(extra = {}) {
  const h = { apikey: config.supabaseKey, 'Content-Type': 'application/json', ...extra };
  // Old-style keys (service_role, starting with "eyJ") also go in Authorization.
  if (config.supabaseKey.startsWith('eyJ')) h.Authorization = `Bearer ${config.supabaseKey}`;
  return h;
}

class DbError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'DbError';
    this.status = status;
    this.code = code;
  }
}

async function call(method, pathAndQuery, body, extraHeaders) {
  const url = `${config.supabaseUrl}/rest/v1/${pathAndQuery}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: headers(extraHeaders),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const cause = err.cause && (err.cause.code || err.cause.message);
    if (String(cause).includes('CERT') || String(cause).includes('certificate')) {
      throw new DbError('Certificate problem while contacting Supabase. In PowerShell run  $env:NODE_USE_SYSTEM_CA="1"  and start again.', 503, 'TLS');
    }
    throw new DbError(`Could not reach Supabase (${cause || err.message}). Check SUPABASE_URL and your internet connection.`, 503, 'NETWORK');
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const code = json && json.code;
    const msg = (json && (json.message || json.hint)) || text || res.statusText;
    if (res.status === 401 || res.status === 403) {
      throw new DbError('Supabase rejected the key. Use the SECRET key (sb_secret_... or service_role) from THIS project.', 503, code);
    }
    if (code === 'PGRST205' || code === '42P01' || /does not exist|Could not find the table/i.test(msg)) {
      throw new DbError('Database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor.', 503, code);
    }
    throw new DbError(`Supabase error: ${msg}`, res.status, code);
  }
  return json;
}

module.exports = {
  DbError,
  describe: () => `supabase (${config.supabaseUrl.replace(/^https:\/\//, '')})`,

  async load(tables) {
    const out = {};
    for (const t of tables) {
      const rows = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const chunk = await call('GET', `${t}?select=*&order=${ORDER[t] || 'id'}.asc`, undefined, {
          'Range-Unit': 'items', Range: `${from}-${from + page - 1}`,
        });
        rows.push(...(chunk || []));
        if (!chunk || chunk.length < page) break;
      }
      out[t] = rows;
    }
    return out;
  },

  async save(table, row, op) {
    if (op === 'insert') {
      await call('POST', table, row, { Prefer: 'return=minimal' });
    } else {
      const { id, ...rest } = row;
      await call('PATCH', `${table}?id=eq.${encodeURIComponent(id)}`, rest, { Prefer: 'return=minimal' });
    }
  },

  async saveMany(table, rows) {
    for (let i = 0; i < rows.length; i += 500) {
      await call('POST', table, rows.slice(i, i + 500), { Prefer: 'return=minimal' });
    }
  },

  async wipe() {
    throw new Error('To reset an online (Supabase) database, run supabase/schema.sql again in the Supabase SQL Editor. It deletes and recreates all tables.');
  },

  // Used by "npm run check"
  async ping() {
    await call('GET', 'settings?select=id&limit=1');
    const users = await call('GET', 'users?select=id', undefined, { Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' });
    return { users: Array.isArray(users) ? users.length : 0 };
  },
};
