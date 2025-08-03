#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { Keypair } from '@solana/web3.js';

interface EncryptedKeyfile {
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  type: 'buy-only' | 'sell-only' | 'dual';
}

class KeyfileGenerator {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompt user for input
   */
  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  /**
   * Prompt for password without echoing
   */
  private async questionPassword(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      
      let password = '';
      
      process.stdin.on('data', (char) => {
        const charStr = char.toString('utf8');
        
        switch (charStr) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
            resolve(password);
            return;
          case '\u0003': // Ctrl+C
            process.exit(1);
          case '\u007f': // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
            break;
          default:
            password += charStr;
            process.stdout.write('*');
            break;
        }
      });
    });
  }

  /**
   * Encrypt private key using AES-256-GCM
   */
  private encryptPrivateKey(privateKey: string, encryptionKey: string): {
    encryptedPrivateKey: string;
    salt: string;
    iv: string;
  } {
    // Generate random salt and IV
    const salt = crypto.randomBytes(32).toString('hex');
    const iv = crypto.randomBytes(16);
    
    // Derive key from encryption key and salt
    const key = crypto.pbkdf2Sync(encryptionKey, salt, 100000, 32, 'sha256');
    
    // Create cipher
    const cipher = crypto.createCipher('aes-256-gcm', key);

    // Encrypt
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedPrivateKey: encrypted,
      salt,
      iv: iv.toString('hex')
    };
  }

  /**
   * Generate a new keypair
   */
  private generateKeypair(): Keypair {
    return Keypair.generate();
  }

  /**
   * Import keypair from private key
   */
  private importKeypair(privateKeyInput: string): Keypair {
    try {
      // Try different formats
      let privateKeyBytes: Uint8Array;

      if (privateKeyInput.startsWith('[') && privateKeyInput.endsWith(']')) {
        // Array format: [1,2,3,...]
        const numbers = JSON.parse(privateKeyInput);
        privateKeyBytes = new Uint8Array(numbers);
      } else if (privateKeyInput.length === 128) {
        // Hex format
        privateKeyBytes = new Uint8Array(
          privateKeyInput.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
        );
      } else if (privateKeyInput.length >= 80 && privateKeyInput.length <= 90) {
        // Base58 format (most common for Solana)
        try {
          const bs58 = require('bs58');
          privateKeyBytes = bs58.decode(privateKeyInput);
        } catch {
          throw new Error('Invalid base58 private key');
        }
      } else {
        // Base64 format
        try {
          privateKeyBytes = Buffer.from(privateKeyInput, 'base64');
        } catch {
          throw new Error('Invalid private key format');
        }
      }

      return Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      throw new Error(`Failed to import keypair: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main generation flow
   */
  async generate(): Promise<void> {
    try {
      console.log('🔐 Solana Wallet Keyfile Generator');
      console.log('=====================================\n');

      // Get encryption key
      const encryptionKey = await this.questionPassword('Enter encryption key (32+ characters): ');
      if (encryptionKey.length < 32) {
        throw new Error('Encryption key must be at least 32 characters');
      }

      // Choose generation method
      const method = await this.question('\nGenerate new wallet or import existing? (new/import): ');
      
      let keypair: Keypair;
      
      if (method.toLowerCase() === 'import') {
        const privateKeyInput = await this.questionPassword('Enter private key: ');
        keypair = this.importKeypair(privateKeyInput);
      } else {
        keypair = this.generateKeypair();
        console.log('\n✅ Generated new keypair');
      }

      // Get wallet type
      console.log('\nWallet types:');
      console.log('1. buy-only  - Only executes buy trades');
      console.log('2. sell-only - Only executes sell trades');
      console.log('3. dual      - Executes both buy and sell trades');
      
      const typeChoice = await this.question('Choose wallet type (1-3): ');
      const types = ['buy-only', 'sell-only', 'dual'] as const;
      const walletType = types[parseInt(typeChoice) - 1];
      
      if (!walletType) {
        throw new Error('Invalid wallet type choice');
      }

      // Encrypt private key
      console.log('\n🔒 Encrypting private key...');
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
      const encrypted = this.encryptPrivateKey(privateKeyBase64, encryptionKey);

      // Create keyfile
      const keyfile: EncryptedKeyfile = {
        publicKey: keypair.publicKey.toString(),
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        salt: encrypted.salt,
        iv: encrypted.iv,
        type: walletType
      };

      // Get output filename
      const defaultFilename = `wallet_${keypair.publicKey.toString().slice(0, 8)}.json`;
      const filename = await this.question(`\nOutput filename (${defaultFilename}): `) || defaultFilename;
      
      // Ensure keystore directory exists
      const keystoreDir = './keystore';
      if (!fs.existsSync(keystoreDir)) {
        fs.mkdirSync(keystoreDir, { recursive: true });
      }

      // Write keyfile
      const filepath = path.join(keystoreDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));

      // Clear sensitive data
      keypair.secretKey.fill(0);

      console.log('\n✅ Keyfile generated successfully!');
      console.log(`📁 Saved to: ${filepath}`);
      console.log(`🔑 Public Key: ${keyfile.publicKey}`);
      console.log(`🏷️  Type: ${keyfile.type}`);
      console.log('\n⚠️  Keep your encryption key safe - it\'s required to decrypt the wallet!');

    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  /**
   * Verify a keyfile can be decrypted
   */
  async verify(): Promise<void> {
    try {
      console.log('🔍 Keyfile Verification Tool');
      console.log('============================\n');

      const filename = await this.question('Enter keyfile path: ');
      const encryptionKey = await this.questionPassword('Enter encryption key: ');

      // Read keyfile
      const keyfileData = fs.readFileSync(filename, 'utf8');
      const keyfile: EncryptedKeyfile = JSON.parse(keyfileData);

      // Decrypt private key
      const key = crypto.pbkdf2Sync(encryptionKey, keyfile.salt, 100000, 32, 'sha256');
      const decipher = crypto.createDecipher('aes-256-gcm', key);

      let decrypted = decipher.update(keyfile.encryptedPrivateKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      // Verify keypair
      const privateKeyBytes = Buffer.from(decrypted, 'base64');
      const keypair = Keypair.fromSecretKey(privateKeyBytes);

      if (keypair.publicKey.toString() !== keyfile.publicKey) {
        throw new Error('Public key mismatch - decryption failed');
      }

      console.log('\n✅ Keyfile verification successful!');
      console.log(`🔑 Public Key: ${keyfile.publicKey}`);
      console.log(`🏷️  Type: ${keyfile.type}`);

      // Clear sensitive data
      keypair.secretKey.fill(0);

    } catch (error) {
      console.error('\n❌ Verification failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const generator = new KeyfileGenerator();

  switch (command) {
    case 'verify':
      await generator.verify();
      break;
    case 'generate':
    default:
      await generator.generate();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { KeyfileGenerator };
