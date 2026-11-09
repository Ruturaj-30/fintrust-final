// =====================================================================
//  Audit trail (tamper-evident).
//  Every entry stores the hash of the entry before it, like a chain.
//  If anyone edits or deletes an old entry, the chain breaks and
//  "Verify integrity" on the Audit Trail page shows exactly where.
//  In Supabase, a database trigger also blocks UPDATE and DELETE.
// =====================================================================
const store = require('./store');
const { stableStringify, sha256 } = require('./security');

const GENESIS = '0'.repeat(64);

function entryHash(e) {
  const { hash, ...rest } = e;
  return sha256(stableStringify(rest));
}

function clientIp(req) {
  return req ? String(req.ip || '').replace(/^::ffff:/, '') : 'system';
}

// record(req, { action, category, outcome, actor, target, details })
async function record(req, { action, category = 'account', outcome = 'success', actor, target, details = {} }) {
  const who = actor || (req && req.user) || null;
  const rows = store.all('audit_log');
  const last = rows[rows.length - 1];
  const entry = {
    id: last ? last.id + 1 : 1,
    at: new Date().toISOString(),
    actor_id: who ? who.id : null,
    actor_name: who ? who.full_name : 'System',
    actor_role: who ? who.role : 'System',
    action,
    category,
    outcome,
    target_type: target ? target.type : null,
    target_id: target ? String(target.id) : null,
    target_label: target ? target.label : null,
    details: JSON.parse(JSON.stringify(details || {})), // drops undefined values so the hash stays stable
    ip: clientIp(req),
    prev_hash: last ? last.hash : GENESIS,
  };
  entry.hash = entryHash(entry);
  try {
    await store.insert('audit_log', entry);
  } catch (err) {
    // Never let an audit failure crash the request, but make it loud.
    console.error(`[audit] could not save "${action}": ${err.message}`);
  }
  return entry;
}

function verifyChain() {
  const rows = store.all('audit_log').sort((a, b) => a.id - b.id);
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.prev_hash !== prev) return { ok: false, checked: i, brokenAt: r.id, reason: 'Link to the previous entry is broken (an entry was removed or reordered).' };
    if (entryHash(r) !== r.hash) return { ok: false, checked: i, brokenAt: r.id, reason: 'Entry content was changed after it was written.' };
    prev = r.hash;
  }
  return { ok: true, checked: rows.length };
}

module.exports = { record, verifyChain, entryHash, GENESIS };
