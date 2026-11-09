// =====================================================================
//  Settings. Everything has a safe default, so the app runs on your
//  laptop with NO .env file at all. A .env file is only needed when you
//  want real emails or when you publish the app online.
// =====================================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = (name, fallback = '') => {
  const v = process.env[name];
  // An empty line in .env (e.g. "DEMO_PASSWORD=") means "use the default".
  return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim();
};
const bool = (name, fallback) => {
  const v = env(name, '');
  if (v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

const isProduction = env('NODE_ENV') === 'production';

const config = {
  isProduction,
  port: Number(env('PORT', '5000')) || 5000,
  appBaseUrl: env('APP_BASE_URL').replace(/\/+$/, ''),

  // Where data is kept: "file" (default, a JSON file in the data folder)
  // or "supabase" (a free online PostgreSQL database, needed for Render).
  storage: env('STORAGE', env('SUPABASE_URL') ? 'supabase' : 'file').toLowerCase(),
  dataDir: path.resolve(env('DATA_DIR', path.join(__dirname, '..', 'data'))),
  supabaseUrl: env('SUPABASE_URL').replace(/\/+$/, '').replace(/\/rest\/v1$/, ''),
  supabaseKey: env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY')),

  // How emails (sign-in codes, invitations, resets) are delivered:
  //   console = printed in the terminal (default, perfect for testing)
  //   gmail   = Gmail SMTP with an App Password (works on your laptop)
  //   brevo   = Brevo email API (works on Render's free plan)
  emailMode: env('EMAIL_MODE', 'console').toLowerCase(),
  gmailUser: env('GMAIL_USER'),
  gmailAppPassword: env('GMAIL_APP_PASSWORD').replace(/\s+/g, ''),
  brevoApiKey: env('BREVO_API_KEY'),
  mailFrom: env('MAIL_FROM', env('GMAIL_USER')),
  mailFromName: env('MAIL_FROM_NAME', 'FinTrust Bank IAM'),

  // DEMO_MODE=true shows sign-in codes and invitation links on the screen.
  // Handy for a classroom demo without email. Never use it for real users.
  demoMode: bool('DEMO_MODE', false),

  // Demo accounts created the very first time the app starts.
  adminEmail: env('ADMIN_EMAIL').toLowerCase(),
  demoPassword: env('DEMO_PASSWORD', isProduction ? '' : 'Mumbai@2026'),

  // Optional: blockchain anchoring of the audit trail on a free test network.
  // Off unless ANCHOR_PRIVATE_KEY is set (create one with: npm run wallet).
  anchorPrivateKey: env('ANCHOR_PRIVATE_KEY'),
  anchorRpcUrl: env('ANCHOR_RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
  anchorChainId: Number(env('ANCHOR_CHAIN_ID', '11155111')) || 11155111,
  anchorNetwork: env('ANCHOR_NETWORK', 'Ethereum Sepolia testnet'),
  anchorExplorer: env('ANCHOR_EXPLORER', 'https://sepolia.etherscan.io').replace(/\/+$/, ''),

  // Which proxy hops to trust for the visitor's IP address.
  // Render and Cloudflare Tunnel add one hop.
  trustProxy: env('TRUST_PROXY', isProduction ? '1' : 'loopback'),
};

// Returns a list of human-readable problems with the settings.
function problems() {
  const list = [];
  if (!['file', 'supabase'].includes(config.storage)) list.push('STORAGE must be "file" or "supabase".');
  if (config.storage === 'supabase') {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)) {
      list.push('SUPABASE_URL should look like https://abcdefghijkl.supabase.co (nothing after .co)');
    }
    if (!config.supabaseKey) list.push('SUPABASE_SECRET_KEY is empty (use the sb_secret_... or service_role key).');
    else if (config.supabaseKey.startsWith('sb_publishable_')) list.push('SUPABASE_SECRET_KEY is the publishable key. Use the SECRET key (sb_secret_...).');
  }
  if (!['console', 'gmail', 'brevo'].includes(config.emailMode)) list.push('EMAIL_MODE must be console, gmail or brevo.');
  if (config.emailMode === 'gmail') {
    if (!config.gmailUser) list.push('GMAIL_USER is empty.');
    if (config.gmailAppPassword.length !== 16) list.push('GMAIL_APP_PASSWORD must be the 16-letter App Password (no spaces).');
  }
  if (config.emailMode === 'brevo') {
    if (!config.brevoApiKey) list.push('BREVO_API_KEY is empty.');
    if (!config.mailFrom) list.push('MAIL_FROM is empty (use the sender email you verified in Brevo).');
  }
  if (config.isProduction) {
    if (config.storage !== 'supabase') list.push('Online the app needs SUPABASE_URL and SUPABASE_SECRET_KEY, because Render deletes files on every restart.');
    if (config.emailMode === 'console' && !config.demoMode) list.push('Online, set EMAIL_MODE=brevo, or DEMO_MODE=true to show codes on screen.');
    if (!config.demoPassword) list.push('DEMO_PASSWORD is empty. Choose the password for the demo accounts.');
    if (!config.appBaseUrl) list.push('APP_BASE_URL is empty (your https://....onrender.com address).');
  }
  if (config.demoPassword && config.demoPassword.length < 10) list.push('DEMO_PASSWORD must be at least 10 characters.');
  return list;
}

module.exports = { config, problems };
