// =====================================================================
//  Profile photos. A photo is REQUIRED: until someone has one, every
//  other API answers 403 PHOTO_REQUIRED (see requirePhoto below).
//
//  Security:
//   - only JPEG, PNG or WebP, checked from the file's own bytes (magic
//     numbers), never from the name or the type the browser claims
//   - SVG, GIF and anything else is refused (SVG can carry scripts)
//   - at most 300 KB; the browser shrinks photos to 320 x 320 first
//   - served with nosniff and a "sandbox" CSP, so an image can never run
//   - staff see their own photo; people who may view the staff directory
//     see everyone's (the same people who can already see their details)
// =====================================================================
const express = require('express');
const store = require('../store');
const audit = require('../audit');
const rbac = require('../rbac');
const mw = require('../middleware');

const router = express.Router();
const { wrap, HttpError, requirePermission: need } = mw;

const MAX_BYTES = 300 * 1024;

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function photoOf(userId) {
  const row = store.get('user_photos', userId);
  return row && row.data ? row : null;
}
const hasPhoto = (userId) => Boolean(photoOf(userId));

const canSeeOthers = (user) => rbac.can(user.role, 'users.view');

// Blocks everything except sign-in, the photo routes and /meta until the person has a photo.
const ALLOWED_WITHOUT_PHOTO = new Set(['/meta']);
function requirePhoto(req, res, next) {
  if (!req.user || hasPhoto(req.user.id) || ALLOWED_WITHOUT_PHOTO.has(req.path)) return next();
  res.status(403).json({ error: 'Please add your profile photo first. It is required for every FinTrust account.', code: 'PHOTO_REQUIRED' });
}

// Which people have a photo, and its version (used as ?v= so browsers refresh after a change).
router.get('/photos', (req, res) => {
  const rows = store.find('user_photos', (r) => r.data && (r.id === req.user.id || canSeeOthers(req.user)));
  res.json({ photos: Object.fromEntries(rows.map((r) => [r.id, new Date(r.updated_at).getTime()])) });
});

router.get('/users/:id/photo', (req, res) => {
  const id = req.params.id;
  if (id !== req.user.id && !canSeeOthers(req.user)) return res.status(403).json({ error: 'You cannot view this photo.' });
  const row = photoOf(id);
  if (!row) return res.status(404).json({ error: 'No photo.' });
  const buf = Buffer.from(row.data, 'base64');
  res.setHeader('Content-Type', sniff(buf) || 'application/octet-stream');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', 'inline; filename="photo"');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(buf);
});

// Add or replace MY photo. Body: { image: "<base64>" }
router.put('/profile/photo', wrap(async (req, res) => {
  const b64 = typeof req.body?.image === 'string' ? req.body.image : '';
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw new HttpError(400, 'Choose a photo to upload.');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'The photo is too large. The limit is 300 KB.');
  const mime = sniff(buf);
  if (!mime) {
    await audit.record(req, { action: 'Profile photo refused (not a JPEG, PNG or WebP image)', category: 'security', outcome: 'denied' });
    throw new HttpError(400, 'Only JPEG, PNG or WebP photos are accepted.');
  }
  const now = new Date().toISOString();
  const row = { mime, data: buf.toString('base64'), updated_at: now, updated_by: req.user.id };
  const existing = store.get('user_photos', req.user.id);
  if (existing) await store.update('user_photos', req.user.id, row);
  else await store.insert('user_photos', { id: req.user.id, ...row });
  await audit.record(req, {
    action: existing && existing.data ? 'Changed profile photo' : 'Added profile photo', category: 'account',
    target: { type: 'user', id: req.user.id, label: req.user.full_name }, details: { type: mime, bytes: buf.length },
  });
  res.json({ ok: true, version: new Date(now).getTime() });
}));

// An administrator removes someone's photo (for example an unsuitable one).
// That person must then upload a new one before they can continue.
router.delete('/users/:id/photo', need('users.edit_details'), wrap(async (req, res) => {
  const target = store.get('users', req.params.id);
  if (!target) throw new HttpError(404, 'Staff member not found.');
  if (!hasPhoto(target.id)) throw new HttpError(400, 'This person has no photo.');
  await store.update('user_photos', target.id, { mime: null, data: null, updated_at: new Date().toISOString(), updated_by: req.user.id });
  await audit.record(req, {
    action: 'Removed profile photo (must upload a new one)', category: 'account',
    target: { type: 'user', id: target.id, label: `${target.full_name} (${target.employee_id})` },
  });
  res.json({ ok: true });
}));

module.exports = { router, requirePhoto, hasPhoto };
