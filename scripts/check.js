// =====================================================================
//  npm run check
//  Checks your settings and the database connection. Never prints secrets.
//  To also send yourself a test email:  npm run check -- you@gmail.com
// =====================================================================
const { config, problems } = require('../src/config');

const ok = (m) => console.log(`✔ ${m}`);
const bad = (m) => console.log(`✖ ${m}`);

(async () => {
  console.log('\n=== FinTrust Final · settings check ===\n');
  ok(`Node.js ${process.version}`);
  ok(`Mode: ${config.isProduction ? 'production (online)' : 'development (your laptop)'}`);
  ok(`Storage: ${config.storage}${config.storage === 'file' ? ' (data/fintrust-data.json, no setup needed)' : ''}`);
  if (config.storage === 'supabase') {
    console.log(`  SUPABASE_URL: ${config.supabaseUrl || '(empty)'}`);
    console.log(`  SUPABASE_SECRET_KEY: ${config.supabaseKey ? `set (${config.supabaseKey.length} characters, hidden)` : '(empty)'}`);
  }
  ok(`Email: ${config.emailMode}${config.emailMode === 'console' ? ' (codes printed in the terminal)' : ''}`);
  if (config.demoMode) ok('Demo mode: ON (codes and links shown on screen)');
  ok(`Blockchain anchoring: ${config.anchorPrivateKey ? `on (${config.anchorNetwork})` : 'off (optional, npm run wallet to set up)'}`);

  const list = problems();
  if (list.length) {
    console.log('\nPlease fix:');
    list.forEach((p) => bad(p));
  }

  if (config.storage === 'supabase') {
    try {
      const driver = require('../src/store/supabaseDriver');
      const r = await driver.ping();
      ok(`Database: connected. ${r.users ? 'Data already present.' : 'Empty: demo data will be created on first start.'}`);
    } catch (err) {
      bad(`Database: ${err.message}`);
    }
  }

  const to = process.argv[2];
  if (to) {
    try {
      const mailer = require('../src/mailer');
      await mailer.send({ to, subject: 'FinTrust test email', text: 'If you can read this, email is working.', html: '<p>If you can read this, email is working.</p>' });
      ok(`Test email sent to ${to}`);
    } catch (err) {
      bad(`Test email failed: ${err.message}`);
    }
  }
  console.log(list.length ? '\nFix the items above, save .env, and run the check again.\n' : '\nAll good. Start the app with:  npm start\n');
})();
