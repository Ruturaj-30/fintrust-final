// =====================================================================
//  Data store.
//  All records are kept in memory for speed and simplicity, and every
//  change is immediately saved by a "driver":
//    - file driver:     data/fintrust-data.json on your laptop (default)
//    - supabase driver: PostgreSQL tables in your free Supabase project
//  The app runs as ONE server for ONE bank. (Scaling to several servers
//  would mean reading from the database on every request. That is a
//  "later" step, as your mentor suggested.)
// =====================================================================
const crypto = require('crypto');
const { config } = require('../config');

const TABLES = [
  'settings',
  'partner_banks',
  'branches',
  'departments',
  'applications',
  'users',
  'access_requests',
  'access_grants',
  'user_tokens',
  'user_photos',
  'audit_anchors',
  'audit_log',
];

let driver = null;
const data = {};
TABLES.forEach((t) => { data[t] = []; });

// Saves happen one after another, in order, so a database never sees a
// child row before its parent row.
let queue = Promise.resolve();
function enqueue(fn) {
  const p = queue.then(fn);
  queue = p.catch(() => {});
  return p;
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function normalizeRow(row) {
  // Databases may return timestamps as "...+00:00". Turn them back into
  // the exact same "....Z" text the app produced.
  for (const k of Object.keys(row)) {
    if ((k.endsWith('_at') || k === 'at') && typeof row[k] === 'string' && row[k]) {
      const d = new Date(row[k]);
      if (!Number.isNaN(d.getTime())) row[k] = d.toISOString();
    }
  }
  return row;
}

async function init() {
  driver = config.storage === 'supabase' ? require('./supabaseDriver') : require('./fileDriver');
  const loaded = await driver.load(TABLES);
  TABLES.forEach((t) => { data[t] = (loaded[t] || []).map(normalizeRow); });
  return driver.describe();
}

function check(table) {
  if (!data[table]) throw new Error(`Unknown table: ${table}`);
}

// ---- reading (always returns copies, so callers cannot change data by accident)
function all(table) { check(table); return clone(data[table]); }
function find(table, fn) { check(table); return clone(data[table].filter(fn)); }
function findOne(table, fn) { check(table); return clone(data[table].find(fn)) || null; }
function get(table, id) { check(table); return clone(data[table].find((r) => r.id === id)) || null; }
function count(table, fn = () => true) { check(table); return data[table].filter(fn).length; }

// ---- writing
async function insert(table, row) {
  check(table);
  const rec = clone(row);
  if (rec.id === undefined || rec.id === null) rec.id = crypto.randomUUID();
  if (data[table].some((r) => r.id === rec.id)) throw new Error(`Duplicate id in ${table}`);
  data[table].push(rec);
  try {
    await enqueue(() => driver.save(table, rec, 'insert', data));
  } catch (err) {
    data[table] = data[table].filter((r) => r !== rec);
    throw err;
  }
  return clone(rec);
}

async function update(table, id, patch) {
  check(table);
  const idx = data[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const before = data[table][idx];
  const after = { ...before, ...clone(patch), id: before.id };
  data[table][idx] = after;
  try {
    await enqueue(() => driver.save(table, after, 'update', data));
  } catch (err) {
    const i = data[table].indexOf(after);
    if (i !== -1) data[table][i] = before;
    throw err;
  }
  return clone(after);
}

// Seeding: save many rows at once (used only when the store is empty).
async function bulkInsert(table, rows) {
  check(table);
  const recs = rows.map((r) => ({ ...clone(r), id: r.id ?? crypto.randomUUID() }));
  data[table].push(...recs);
  await enqueue(() => driver.saveMany(table, recs, data));
}

function isEmpty() {
  return data.users.length === 0;
}

function describe() {
  return driver ? driver.describe() : 'not started';
}

// Remove everything (only used by "npm run reset-demo").
async function wipe() {
  await enqueue(() => driver.wipe(TABLES));
  TABLES.forEach((t) => { data[t] = []; });
}

module.exports = {
  TABLES, init, all, find, findOne, get, count, insert, update, bulkInsert, isEmpty, describe, wipe,
};
