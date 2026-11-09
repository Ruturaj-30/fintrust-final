// =====================================================================
//  FinTrust Final — Identity & Access Management for FinTrust Bank Ltd.
//  Start:  npm start      then open  http://localhost:5000
// =====================================================================
const path = require('path');
const express = require('express');
const { config, problems } = require('./src/config');
const store = require('./src/store');
const mw = require('./src/middleware');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.set('query parser', 'simple');

app.use(mw.securityHeaders);
// Small JSON bodies everywhere, except the profile photo upload (max 300 KB image).
const smallJson = express.json({ limit: '50kb' });
const photoJson = express.json({ limit: '450kb' });
app.use((req, res, next) => (req.path === '/api/profile/photo' ? photoJson : smallJson)(req, res, next));

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', mw.csrfProtection);
const apiLimit = mw.rateLimit({ name: 'api', windowMs: 60000, max: 300 });
// Profile photo downloads are small, cached by the browser and still need
// sign-in and permission, so a staff list full of photos does not use up the limit.
const isPhotoDownload = (req) => req.method === 'GET' && /^\/users\/[^/]+\/photo$/.test(req.path);
app.use('/api', (req, res, next) => (isPhotoDownload(req) ? next() : apiLimit(req, res, next)));

let ready = false;
app.get('/api/health', (req, res) => {
  const list = problems();
  const ok = ready && !list.length;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'needs attention',
    storage: store.describe().split(' ')[0],
    emailMode: config.emailMode,
    demoMode: config.demoMode,
    problems: config.isProduction ? (list.length ? ['configuration incomplete, check the server log'] : []) : list,
  });
});

app.use('/api', (req, res, next) => (ready ? next() : res.status(503).json({ error: 'The server is still starting. Try again in a few seconds.' })));
app.use('/api', mw.loadSession);
app.use('/api/auth', require('./src/routes/auth').router);

// Everything below needs a signed-in user
app.use('/api', mw.requireAuth);
const photos = require('./src/routes/photos');
app.use('/api', photos.router);
app.use('/api', photos.requirePhoto); // a profile photo is required before anything else
app.use('/api', require('./src/routes/users'));
app.use('/api', require('./src/routes/access'));
app.use('/api', require('./src/routes/governance'));
app.use('/api', require('./src/routes/dashboard'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

// ---------------------------------------------------------------------
// Web pages
// ---------------------------------------------------------------------
// The React app is built into the "public" folder by  npm run build.
const publicDir = path.join(__dirname, 'public');
app.use('/assets', express.static(path.join(publicDir, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(publicDir, { index: false }));
// Any other page address (/, /app, /app/users/..., /set-password) loads the React app.
app.get('*', (req, res) => {
  const index = path.join(publicDir, 'index.html');
  if (!require('fs').existsSync(index)) {
    return res.status(503).type('text').send('The web pages have not been built yet. Run:  npm run build   then  npm start');
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(index);
});
app.use(mw.errorHandler);

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------
async function start() {
  const list = problems();
  if (list.length) {
    console.warn('\n⚠  Settings need attention (.env file or Render environment):');
    list.forEach((p) => console.warn(`   - ${p}`));
    if (config.isProduction) process.exit(1);
    console.warn('');
  }

  const where = await store.init();
  let created = null;
  if (store.isEmpty()) created = await require('./src/seed').seed();
  ready = true;

  app.listen(config.port, () => {
    console.log('\n==============================================================');
    console.log('  FinTrust Bank Ltd. · Identity & Access Management');
    console.log(`  Open:     http://localhost:${config.port}`);
    console.log(`  Storage:  ${where}`);
    console.log(`  Email:    ${config.emailMode}${config.emailMode === 'console' ? ' (sign-in codes are printed below in this terminal)' : ''}`);
    if (config.demoMode) console.log('  Demo mode is ON: codes and links are also shown on screen.');
    console.log('==============================================================');
    if (created) {
      console.log('\n  Demo accounts (one per role):');
      created.forEach((u) => console.log(`   ${u.role.padEnd(22)} ${u.email}`));
      console.log(`  Password for all demo accounts: ${config.isProduction ? '(your DEMO_PASSWORD)' : config.demoPassword}`);
    }
    console.log('\n  Press Ctrl + C to stop.\n');
  });
}

start().catch((err) => {
  console.error(`\n✖ FinTrust could not start: ${err.message}\n`);
  process.exit(1);
});
