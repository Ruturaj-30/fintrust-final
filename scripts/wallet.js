// =====================================================================
//  npm run wallet
//  Creates the bank's blockchain wallet for audit anchoring and saves its
//  key straight into your .env file (you never need to copy it by hand).
//  If a wallet already exists, shows its address and test-ETH balance.
//
//  This wallet is ONLY for the free Sepolia TEST network. Its coins have
//  no value. Never send real money to it and never reuse its key elsewhere.
// =====================================================================
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { config } = require('../src/config');

const envFile = path.join(__dirname, '..', '.env');

(async () => {
  console.log('\n=== FinTrust · blockchain wallet (Sepolia test network) ===\n');
  if (config.anchorPrivateKey) {
    let wallet;
    try { wallet = new ethers.Wallet(config.anchorPrivateKey.startsWith('0x') ? config.anchorPrivateKey : `0x${config.anchorPrivateKey}`); } catch {
      console.log('✖ ANCHOR_PRIVATE_KEY in your .env is not valid. Delete that line and run  npm run wallet  again.\n');
      process.exit(1);
    }
    console.log(`✔ Wallet address: ${wallet.address}`);
    console.log(`  View it:        ${config.anchorExplorer}/address/${wallet.address}`);
    try {
      const network = ethers.Network.from(config.anchorChainId);
      const provider = new ethers.JsonRpcProvider(config.anchorRpcUrl, network, { staticNetwork: network });
      const bal = await provider.getBalance(wallet.address);
      console.log(`✔ Balance:        ${ethers.formatEther(bal)} test ETH`);
      if (bal === 0n) console.log('\n  The wallet is empty. Get free Sepolia test ETH from a faucet (see README, "Blockchain"), using the address above.');
    } catch {
      console.log('✖ Could not reach the Sepolia network to read the balance. Check your internet connection.');
    }
    console.log('');
    return;
  }

  const wallet = ethers.Wallet.createRandom();
  let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  if (text && !text.endsWith('\n')) text += '\n';
  text += `\n# Blockchain anchoring (Sepolia TEST network only). Keep this secret.\nANCHOR_PRIVATE_KEY=${wallet.privateKey}\n`;
  fs.writeFileSync(envFile, text);
  console.log('✔ New wallet created. Its secret key was saved in your .env file as ANCHOR_PRIVATE_KEY.');
  console.log(`\n  Wallet address (safe to share): ${wallet.address}\n`);
  console.log('  Next:');
  console.log('  1. Get free Sepolia test ETH for this address from a faucet (see README, "Blockchain").');
  console.log('  2. Run  npm run wallet  again to see the balance.');
  console.log('  3. Restart the app (npm start). Audit Trail -> "Anchor now".');
  console.log('\n  Online (Render): copy the ANCHOR_PRIVATE_KEY line from .env into Render -> Environment.');
  console.log('  Never upload .env to GitHub and never paste the key in a chat.\n');
})();
