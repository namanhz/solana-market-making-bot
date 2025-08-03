import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';

interface EncryptedKeyfile {
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  type: 'buy-only' | 'sell-only' | 'dual';
  active: boolean; // Whether this wallet is active for trading
  createdAt: string;
  lastUsed?: string;
}

export class SimpleWalletCreator {
  private keystoreDir: string;
  private encryptionKey: string;

  constructor(keystoreDir: string, encryptionKey: string) {
    this.keystoreDir = keystoreDir;
    this.encryptionKey = encryptionKey;
  }

  /**
   * Create multiple wallets from base58 private keys (one per line)
   */
  async createMultipleWalletsFromBase58(
    privateKeysText: string,
    walletType: 'buy-only' | 'sell-only' | 'dual' = 'dual'
  ): Promise<Array<{ publicKey: string; filename: string; success: boolean; error?: string }>> {
    const lines = privateKeysText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const results = [];

    for (const privateKeyBase58 of lines) {
      try {
        const result = await this.createWalletFromBase58(privateKeyBase58, walletType);
        results.push({
          ...result,
          success: true
        });
      } catch (error) {
        results.push({
          publicKey: 'Failed to create',
          filename: '',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Create wallet from base58 private key
   */
  async createWalletFromBase58(
    privateKeyBase58: string,
    walletType: 'buy-only' | 'sell-only' | 'dual' = 'dual'
  ): Promise<{ publicKey: string; filename: string }> {
    try {
      // Decode base58 private key
      const privateKeyBytes = bs58.decode(privateKeyBase58);
      const keypair = Keypair.fromSecretKey(privateKeyBytes);
      
      // Convert to base64 for encryption
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
      
      // Encrypt the private key
      const encrypted = this.encryptPrivateKey(privateKeyBase64);
      
      // Create keyfile
      const keyfile: EncryptedKeyfile = {
        publicKey: keypair.publicKey.toString(),
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        salt: encrypted.salt,
        iv: encrypted.iv,
        type: walletType,
        active: true, // Default to active
        createdAt: new Date().toISOString()
      };
      
      // Generate filename
      const filename = `wallet_${keypair.publicKey.toString().slice(0, 8)}_${Date.now()}.json`;
      const filepath = path.join(this.keystoreDir, filename);
      
      // Ensure keystore directory exists
      if (!fs.existsSync(this.keystoreDir)) {
        fs.mkdirSync(this.keystoreDir, { recursive: true });
      }
      
      // Write keyfile
      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));
      
      // Clear sensitive data
      keypair.secretKey.fill(0);
      
      return {
        publicKey: keypair.publicKey.toString(),
        filename
      };
    } catch (error) {
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a new random wallet
   */
  async generateRandomWallet(
    walletType: 'buy-only' | 'sell-only' | 'dual' = 'dual'
  ): Promise<{ publicKey: string; privateKey: string; filename: string }> {
    try {
      // Generate new keypair
      const keypair = Keypair.generate();
      
      // Get base58 private key for return
      const privateKeyBase58 = bs58.encode(keypair.secretKey);
      
      // Convert to base64 for encryption
      const privateKeyBase64 = Buffer.from(keypair.secretKey).toString('base64');
      
      // Encrypt the private key
      const encrypted = this.encryptPrivateKey(privateKeyBase64);
      
      // Create keyfile
      const keyfile: EncryptedKeyfile = {
        publicKey: keypair.publicKey.toString(),
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        salt: encrypted.salt,
        iv: encrypted.iv,
        type: walletType,
        active: true, // Default to active
        createdAt: new Date().toISOString()
      };
      
      // Generate filename
      const filename = `wallet_${keypair.publicKey.toString().slice(0, 8)}_${Date.now()}.json`;
      const filepath = path.join(this.keystoreDir, filename);
      
      // Ensure keystore directory exists
      if (!fs.existsSync(this.keystoreDir)) {
        fs.mkdirSync(this.keystoreDir, { recursive: true });
      }
      
      // Write keyfile
      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));
      
      const publicKey = keypair.publicKey.toString();
      
      // Clear sensitive data from keypair
      keypair.secretKey.fill(0);
      
      return {
        publicKey,
        privateKey: privateKeyBase58,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to generate wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List existing wallets
   */
  listWallets(): Array<{
    filename: string;
    publicKey: string;
    type: string;
    active: boolean;
    createdAt: string;
    lastUsed: string | undefined;
  }> {
    try {
      if (!fs.existsSync(this.keystoreDir)) {
        return [];
      }

      const files = fs.readdirSync(this.keystoreDir)
        .filter(file => file.endsWith('.json'));

      return files.map(filename => {
        try {
          const filepath = path.join(this.keystoreDir, filename);
          const keyfile: EncryptedKeyfile = JSON.parse(fs.readFileSync(filepath, 'utf8'));

          return {
            filename,
            publicKey: keyfile.publicKey,
            type: keyfile.type,
            active: keyfile.active !== undefined ? keyfile.active : true, // Default to true for old files
            createdAt: keyfile.createdAt || 'Unknown',
            lastUsed: keyfile.lastUsed
          };
        } catch (error) {
          return {
            filename,
            publicKey: 'Error reading file',
            type: 'unknown',
            active: false,
            createdAt: 'Unknown',
            lastUsed: undefined
          };
        }
      });
    } catch (error) {
      throw new Error(`Failed to list wallets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Toggle wallet active status
   */
  async toggleWalletActive(publicKey: string): Promise<boolean> {
    try {
      const wallets = this.listWallets();
      const wallet = wallets.find(w => w.publicKey === publicKey);

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const filepath = path.join(this.keystoreDir, wallet.filename);
      const keyfile: EncryptedKeyfile = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      keyfile.active = !keyfile.active;

      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));

      return keyfile.active;
    } catch (error) {
      throw new Error(`Failed to toggle wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set wallet active status
   */
  async setWalletActive(publicKey: string, active: boolean): Promise<void> {
    try {
      const wallets = this.listWallets();
      const wallet = wallets.find(w => w.publicKey === publicKey);

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const filepath = path.join(this.keystoreDir, wallet.filename);
      const keyfile: EncryptedKeyfile = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      keyfile.active = active;

      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));
    } catch (error) {
      throw new Error(`Failed to set wallet status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update wallet last used timestamp
   */
  async updateWalletLastUsed(publicKey: string): Promise<void> {
    try {
      const wallets = this.listWallets();
      const wallet = wallets.find(w => w.publicKey === publicKey);

      if (!wallet) {
        return; // Wallet not found, skip silently
      }

      const filepath = path.join(this.keystoreDir, wallet.filename);
      const keyfile: EncryptedKeyfile = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      keyfile.lastUsed = new Date().toISOString();

      fs.writeFileSync(filepath, JSON.stringify(keyfile, null, 2));
    } catch (error) {
      // Log error but don't throw to avoid breaking trading
      console.error(`Failed to update wallet last used: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove wallet by public key
   */
  async removeWallet(publicKey: string): Promise<boolean> {
    try {
      const wallets = this.listWallets();
      const wallet = wallets.find(w => w.publicKey === publicKey);

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      const filepath = path.join(this.keystoreDir, wallet.filename);

      // Delete the keyfile
      fs.unlinkSync(filepath);

      return true;
    } catch (error) {
      throw new Error(`Failed to remove wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Remove multiple wallets by public keys
   */
  async removeMultipleWallets(publicKeys: string[]): Promise<Array<{ publicKey: string; success: boolean; error?: string }>> {
    const results = [];

    for (const publicKey of publicKeys) {
      try {
        await this.removeWallet(publicKey);
        results.push({
          publicKey,
          success: true
        });
      } catch (error) {
        results.push({
          publicKey,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Remove all wallets
   */
  async removeAllWallets(): Promise<{ removed: number; failed: number; errors: string[] }> {
    try {
      const wallets = this.listWallets();
      const errors: string[] = [];
      let removed = 0;
      let failed = 0;

      for (const wallet of wallets) {
        try {
          await this.removeWallet(wallet.publicKey);
          removed++;
        } catch (error) {
          failed++;
          errors.push(`${wallet.publicKey.slice(0, 8)}...: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        removed,
        failed,
        errors
      };
    } catch (error) {
      throw new Error(`Failed to remove all wallets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Encrypt private key using simple AES encryption
   */
  private encryptPrivateKey(privateKey: string): {
    encryptedPrivateKey: string;
    salt: string;
    iv: string;
  } {
    // Generate random salt and IV
    const salt = crypto.randomBytes(32).toString('hex');
    const iv = crypto.randomBytes(16);
    
    // Derive key from encryption key and salt
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
    
    // Create cipher
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
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
   * Validate base58 private key
   */
  static validateBase58PrivateKey(privateKey: string): boolean {
    try {
      const decoded = bs58.decode(privateKey);
      return decoded.length === 64; // Solana private keys are 64 bytes
    } catch {
      return false;
    }
  }
}
