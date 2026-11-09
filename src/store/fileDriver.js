// Saves all data into ONE JSON file: data/fintrust-data.json
// Used on your laptop. Needs no setup at all.
const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const file = path.join(config.dataDir, 'fintrust-data.json');

function writeSnapshot(data) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const text = JSON.stringify(data, null, 1);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  try {
    fs.renameSync(tmp, file); // atomic replace, so a crash never leaves half a file
  } catch {
    // Some antivirus tools on Windows briefly lock files; fall back to a direct write.
    fs.writeFileSync(file, text);
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

module.exports = {
  describe: () => `file (${path.relative(process.cwd(), file) || file})`,

  async load(tables) {
    if (!fs.existsSync(file)) return {};
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const out = {};
      tables.forEach((t) => { out[t] = Array.isArray(parsed[t]) ? parsed[t] : []; });
      return out;
    } catch (err) {
      throw new Error(`Could not read ${file}: ${err.message}. Run "npm run reset-demo" to start again with fresh demo data.`);
    }
  },

  async save(_table, _row, _op, data) { writeSnapshot(data); },
  async saveMany(_table, _rows, data) { writeSnapshot(data); },
  async wipe() { if (fs.existsSync(file)) fs.unlinkSync(file); },
};
