// =====================================================================
//  Blockchain anchoring of the audit trail (optional, free).
//
//  The audit trail is already a hash chain: every entry holds the SHA-256
//  of the one before it. But someone with full database access could, in
//  theory, rewrite the WHOLE chain and recompute every hash.
//
//  "Anchoring" closes that gap: we publish the latest hash (the "head")
//  on a public blockchain (the free Ethereum Sepolia test network) as a
//  tiny transaction from the bank's own wallet to itself. Blockchain
//  records cannot be changed by anyone, including us. Later, "Verify on
//  blockchain" reads each transaction back and checks that the audit
//  entry it points to still has exactly that hash.
//
//  Only hashes go on the blockchain: no names, emails or other data.
//  Off unless ANCHOR_PRIVATE_KEY is set (npm run wallet creates one).
// =====================================================================
const store = require('./store');
const { config } = require('./config');
const { HttpError } = require('./middleware');

const PREFIX = 'FINTRUST-AUDIT v1';
const MIN_GAP_MS = 60 * 1000;
// A transaction still pending after this long is treated as stuck and is
// replaced (same nonce, fresh fees) the next time someone clicks "Anchor now".
const STUCK_MS = (Number(process.env.ANCHOR_STUCK_SECONDS) || 180) * 1000;
// Validators skip transactions with a near-zero tip, so always offer at least 1.5 gwei.
// On Sepolia that is still only about 0.00004 test ETH per anchor.
const MIN_TIP = 1500000000n;

let ethers = null;
let wallet = null;
let provider = null;
let setupError = '';

function setup() {
  if (wallet || setupError || !config.anchorPrivateKey) return;
  try {
    ethers = require('ethers');
    const key = config.anchorPrivateKey.startsWith('0x') ? config.anchorPrivateKey : `0x${config.anchorPrivateKey}`;
    const network = ethers.Network.from(config.anchorChainId);
    provider = new ethers.JsonRpcProvider(config.anchorRpcUrl, network, { staticNetwork: network });
    wallet = new ethers.Wallet(key, provider);
  } catch {
    setupError = 'ANCHOR_PRIVATE_KEY is not a valid wallet key. Run "npm run wallet" to create a new one.';
    console.warn(`[blockchain] ${setupError}`);
  }
}

const enabled = () => { setup(); return Boolean(wallet); };

const txUrl = (hash) => `${config.anchorExplorer}/tx/${hash}`;
const addressUrl = (addr) => `${config.anchorExplorer}/address/${addr}`;

function friendly(err) {
  const msg = String((err && (err.shortMessage || err.message)) || err);
  if (/insufficient funds/i.test(msg)) return 'The bank wallet has no test ETH. Get free Sepolia ETH from a faucet (see the README), then try again.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|fetch failed|network/i.test(msg)) return 'Could not reach the blockchain network. Check your internet connection and try again.';
  return `Blockchain error: ${msg.slice(0, 160)}`;
}

const encode = (entryId, head) => ethers.hexlify(ethers.toUtf8Bytes(`${PREFIX} | entry ${entryId} | ${head}`));
function decode(data) {
  try {
    const text = ethers.toUtf8String(data);
    const m = text.match(/^FINTRUST-AUDIT v1 \| entry (\d+) \| ([0-9a-f]{64})$/);
    return m ? { entryId: Number(m[1]), head: m[2], text } : null;
  } catch { return null; }
}

function headEntry() {
  const rows = store.all('audit_log');
  let last = null;
  for (const r of rows) if (!last || r.id > last.id) last = r;
  return last;
}

// Pending transactions confirm in ~15 seconds. Check any that are still pending.
async function refreshPending() {
  if (!enabled()) return;
  const pending = store.find('audit_anchors', (a) => a.status === 'pending').slice(0, 5);
  await Promise.all(pending.map(async (a) => {
    try {
      const receipt = await provider.getTransactionReceipt(a.tx_hash);
      if (receipt) {
        await store.update('audit_anchors', a.id, {
          status: receipt.status === 1 ? 'confirmed' : 'failed', block_number: receipt.blockNumber,
          error: receipt.status === 1 ? null : 'The transaction was rejected by the network.',
        });
      }
    } catch { /* try again next time */ }
  }));
}

// Rough cost of one anchor: a plain transfer (21,000 gas) plus ~100 bytes of data, with headroom.
const ANCHOR_GAS = 30000n;
async function fees() {
  const f = await provider.getFeeData();
  const tip = f.maxPriorityFeePerGas && f.maxPriorityFeePerGas > MIN_TIP ? f.maxPriorityFeePerGas : MIN_TIP;
  const base = f.maxFeePerGas || f.gasPrice || 0n;
  return { maxPriorityFeePerGas: tip, maxFeePerGas: base + tip };
}
async function costEstimate() {
  return ANCHOR_GAS * (await fees()).maxFeePerGas;
}

async function status() {
  const base = { enabled: false, network: config.anchorNetwork, explorer: config.anchorExplorer };
  if (!enabled()) return { ...base, reason: setupError || 'Blockchain anchoring is off. Set ANCHOR_PRIVATE_KEY (npm run wallet creates one) to turn it on.' };
  await refreshPending();
  let balance = null; let reachable = true; let lowBalance = false; let anchorsLeft = null;
  try {
    const wei = await provider.getBalance(wallet.address);
    balance = ethers.formatEther(wei);
    const cost = await costEstimate();
    anchorsLeft = cost > 0n ? Number(wei / cost) : null;
    lowBalance = wei === 0n || (cost > 0n && wei < cost);
  } catch { reachable = false; }
  return { ...base, enabled: true, reachable, lowBalance, anchorsLeft, address: wallet.address, addressUrl: addressUrl(wallet.address), balance };
}

function list() {
  return store.all('audit_anchors')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((a) => ({ ...a, tx_url: a.tx_hash ? txUrl(a.tx_hash) : null }));
}

// Publish the current head hash. Returns the new anchor (status "pending").
async function anchorNow(user) {
  if (!enabled()) throw new HttpError(503, setupError || 'Blockchain anchoring is off.');
  const head = headEntry();
  if (!head) throw new HttpError(400, 'The audit trail is empty.');
  const previous = list()[0];
  // A stuck (long-pending) anchor is replaced: same nonce, proper fees, latest hash.
  let replaceNonce = null;
  if (previous && previous.status === 'pending' && Date.now() - new Date(previous.created_at).getTime() > STUCK_MS) {
    try {
      const old = await provider.getTransaction(previous.tx_hash);
      const receipt = await provider.getTransactionReceipt(previous.tx_hash);
      if (old && !receipt) replaceNonce = old.nonce;
    } catch { /* fall through to a normal send */ }
  }
  if (previous && previous.status !== 'failed' && replaceNonce === null) {
    if (previous.entry_id === head.id) throw new HttpError(409, 'Nothing new to anchor: the latest audit entry is already on the blockchain.');
    if (Date.now() - new Date(previous.created_at).getTime() < MIN_GAP_MS) throw new HttpError(429, 'Please wait a minute between anchors.');
  }
  // Check the test balance first, so a low wallet gives a clear message (and the app carries on as normal).
  try {
    const [wei, cost] = await Promise.all([provider.getBalance(wallet.address), costEstimate()]);
    if (wei === 0n || wei < cost) throw new HttpError(402, 'Anchoring paused: the bank wallet is low on test ETH. Get free Sepolia ETH from a faucet, then try again. Everything else keeps working normally.');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, friendly(err));
  }
  let tx;
  try {
    const fee = await fees();
    if (replaceNonce !== null) { fee.maxPriorityFeePerGas *= 2n; fee.maxFeePerGas *= 2n; } // a replacement must pay more
    tx = await wallet.sendTransaction({
      to: wallet.address, value: 0, data: encode(head.id, head.hash), gasLimit: ANCHOR_GAS, ...fee,
      ...(replaceNonce !== null ? { nonce: replaceNonce } : {}),
    });
  } catch (err) {
    throw new HttpError(502, friendly(err));
  }
  if (replaceNonce !== null) {
    await store.update('audit_anchors', previous.id, { status: 'failed', error: 'Stuck in the network; replaced by a newer anchor.' });
  }
  const row = await store.insert('audit_anchors', {
    created_at: new Date().toISOString(), created_by: user ? user.id : null,
    entry_id: head.id, head_hash: head.hash, network: config.anchorNetwork,
    tx_hash: tx.hash, status: 'pending', block_number: null, error: null,
  });
  // Mark as confirmed in the background once it is mined.
  tx.wait(1, 180000).then((r) => store.update('audit_anchors', row.id, { status: r && r.status === 1 ? 'confirmed' : 'failed', block_number: r ? r.blockNumber : null }))
    .catch(() => { /* refreshPending() will pick it up later */ });
  return { ...row, tx_url: txUrl(tx.hash) };
}

// Read every anchor back from the blockchain and compare with today's audit trail.
async function verifyAll() {
  if (!enabled()) throw new HttpError(503, setupError || 'Blockchain anchoring is off.');
  await refreshPending();
  const anchors = list().filter((a) => a.tx_hash && a.status !== 'failed');
  const results = [];
  for (const a of anchors) {
    let result;
    try {
      const tx = await provider.getTransaction(a.tx_hash);
      const onChain = tx ? decode(tx.data) : null;
      const entry = store.get('audit_log', onChain ? onChain.entryId : a.entry_id);
      if (!tx) result = { ok: false, reason: 'Transaction not found on the blockchain yet.' };
      else if (tx.from.toLowerCase() !== wallet.address.toLowerCase()) result = { ok: false, reason: 'Transaction was not sent by the bank wallet.' };
      else if (!onChain) result = { ok: false, reason: 'Transaction does not contain a FinTrust audit anchor.' };
      else if (onChain.entryId !== a.entry_id || onChain.head !== a.head_hash) result = { ok: false, reason: 'The anchor record in the database was changed (it no longer matches the blockchain).' };
      else if (!entry) result = { ok: false, reason: `Audit entry #${onChain.entryId} is missing (deleted after anchoring).` };
      else if (entry.hash !== onChain.head) result = { ok: false, reason: `Audit history up to entry #${onChain.entryId} was rewritten after anchoring.` };
      else result = { ok: true, reason: `Entry #${onChain.entryId} matches the blockchain.` };
    } catch (err) {
      result = { ok: false, reason: friendly(err) };
    }
    results.push({ id: a.id, entry_id: a.entry_id, tx_hash: a.tx_hash, tx_url: a.tx_url, ...result });
  }
  return { ok: results.length > 0 && results.every((r) => r.ok), checked: results.length, results };
}

module.exports = { enabled, status, list, anchorNow, verifyAll, decode, PREFIX };
