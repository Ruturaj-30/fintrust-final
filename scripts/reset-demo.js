// =====================================================================
//  npm run reset-demo
//  Deletes ALL data on your laptop (data/fintrust-data.json). The next
//  "npm start" creates fresh FinTrust Bank demo data.
//  (Online / Supabase: run supabase/schema.sql again instead.)
// =====================================================================
const fs = require('fs');
const path = require('path');
const { config } = require('../src/config');

if (config.storage !== 'file') {
  console.log('\nYou are using Supabase. To reset it, run supabase/schema.sql again in the Supabase SQL Editor, then restart the app.\n');
  process.exit(0);
}
const file = path.join(config.dataDir, 'fintrust-data.json');
if (fs.existsSync(file)) {
  fs.unlinkSync(file);
  console.log('\n✔ Demo data deleted. Run  npm start  to create fresh demo data.\n');
} else {
  console.log('\nNothing to delete. Run  npm start  to create demo data.\n');
}
