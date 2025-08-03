const crypto = require('crypto');
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Generate a test keypair
const keypair = Keypair.generate();

// Simple encryption for demo (not production-grade)
const encryptionKey = "demo_encryption_key_32_chars_long";
const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');

// Create a simple encrypted keyfile for demo
const salt = crypto.randomBytes(32).toString('hex');
const iv = crypto.randomBytes(16).toString('hex');

// Simple encryption (for demo purposes)
const cipher = crypto.createCipher('aes-256-cbc', encryptionKey + salt);
let encrypted = cipher.update(privateKeyBase64, 'utf8', 'hex');
encrypted += cipher.final('hex');

const keyfile = {
  publicKey: keypair.publicKey.toString(),
  encryptedPrivateKey: encrypted,
  salt: salt,
  iv: iv,
  type: "dual"
};

// Save the keyfile
const filename = `keystore/test_wallet_${keypair.publicKey.toString().slice(0, 8)}.json`;
fs.writeFileSync(filename, JSON.stringify(keyfile, null, 2));

console.log('✅ Test wallet created!');
console.log(`📁 Saved to: ${filename}`);
console.log(`🔑 Public Key: ${keypair.publicKey.toString()}`);
console.log(`🏷️  Type: dual`);
console.log('\n⚠️  This is a TEST wallet with no real funds!');
