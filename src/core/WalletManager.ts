import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { EventEmitter } from 'events';

export interface WalletInfo {
  publicKey: PublicKey;
  keypair: Keypair;
  type: 'buy-only' | 'sell-only' | 'dual';
  solBalance: number;
  tokenBalance: number;
  lastUpdated: Date;
}

export interface EncryptedKeyfile {
  publicKey: string;
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
  type: 'buy-only' | 'sell-only' | 'dual';
  active?: boolean;
  createdAt?: string;
  lastUsed?: string;
}

export interface BalanceUpdate {
  publicKey: string;
  solBalance: number;
  tokenBalance: number;
  timestamp: Date;
}

export class WalletManager extends EventEmitter {
  private wallets: Map<string, WalletInfo> = new Map();
  private connection: Connection;
  private keystoreDir: string;
  private encryptionKey: string;
  private tokenMint: PublicKey;
  private balanceUpdateInterval: NodeJS.Timeout | null = null;

  constructor(
    connection: Connection,
    keystoreDir: string,
    encryptionKey: string,
    tokenMint: PublicKey
  ) {
    super();
    this.connection = connection;
    this.keystoreDir = keystoreDir;
    this.encryptionKey = encryptionKey;
    this.tokenMint = tokenMint;
  }

  /**
   * Load wallets from encrypted keyfiles
   */
  async loadWallets(): Promise<void> {
    try {
      const keyfiles = fs.readdirSync(this.keystoreDir)
        .filter(file => file.endsWith('.json'));

      for (const keyfile of keyfiles) {
        const keyfilePath = path.join(this.keystoreDir, keyfile);
        await this.loadWallet(keyfilePath);
      }

      console.log(`Loaded ${this.wallets.size} wallets`);
      
      // Start balance monitoring
      this.startBalanceMonitoring();
    } catch (error) {
      throw new Error(`Failed to load wallets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load a single wallet from encrypted keyfile
   */
  private async loadWallet(keyfilePath: string): Promise<void> {
    try {
      const encryptedData: EncryptedKeyfile = JSON.parse(
        fs.readFileSync(keyfilePath, 'utf8')
      );

      // Skip inactive wallets
      if (encryptedData.active === false) {
        console.log(`Skipping inactive wallet: ${encryptedData.publicKey.slice(0, 8)}...`);
        return;
      }

      // Decrypt private key
      const privateKey = this.decryptPrivateKey(
        encryptedData.encryptedPrivateKey,
        encryptedData.salt,
        encryptedData.iv
      );

      // Create keypair
      const keypair = Keypair.fromSecretKey(
        Buffer.from(privateKey, 'base64')
      );

      // Verify public key matches
      if (keypair.publicKey.toString() !== encryptedData.publicKey) {
        throw new Error('Public key mismatch after decryption');
      }

      // Create wallet info
      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey,
        keypair,
        type: encryptedData.type,
        solBalance: 0,
        tokenBalance: 0,
        lastUpdated: new Date()
      };

      this.wallets.set(keypair.publicKey.toString(), walletInfo);
      console.log(`✅ Loaded wallet: ${keypair.publicKey.toString().slice(0, 8)}... (${encryptedData.type})`);

      // Zero out sensitive data
      if (typeof privateKey === 'string') {
        // Can't zero out string, but it will be garbage collected
      }
      // Note: Don't zero out keypair.secretKey here as we need it for signing

    } catch (error) {
      console.error(`❌ Failed to load wallet from ${keyfilePath}:`, error);
    }
  }

  /**
   * Decrypt private key using AES-256-CBC (matching SimpleWalletCreator)
   */
  private decryptPrivateKey(encryptedKey: string, salt: string, _iv: string): string {
    try {
      // Derive key from encryption key and salt (matching SimpleWalletCreator)
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');

      // Create decipher (matching SimpleWalletCreator)
      const decipher = crypto.createDecipher('aes-256-cbc', key);

      // Decrypt
      let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get SOL balance for a wallet
   */
  async getSol(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error(`Failed to get SOL balance for ${publicKey.toString()}:`, error);
      return 0;
    }
  }

  /**
   * Get SPL token balance for a wallet
   */
  async getSpl(publicKey: PublicKey, mint: PublicKey): Promise<number> {
    try {
      const associatedTokenAddress = await getAssociatedTokenAddress(mint, publicKey);
      const account = await getAccount(this.connection, associatedTokenAddress);

      // Get mint info to determine decimals
      const mintInfo = await this.connection.getParsedAccountInfo(mint);
      let decimals = 6; // Default to 6 decimals

      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        decimals = mintInfo.value.data.parsed.info.decimals || 6;
      }

      return Number(account.amount) / Math.pow(10, decimals);
    } catch (error) {
      // Account might not exist yet
      return 0;
    }
  }

  /**
   * Update balances for all wallets
   */
  async updateBalances(): Promise<void> {
    const updatePromises = Array.from(this.wallets.values()).map(async (wallet) => {
      try {
        const [solBalance, tokenBalance] = await Promise.all([
          this.getSol(wallet.publicKey),
          this.getSpl(wallet.publicKey, this.tokenMint)
        ]);

        wallet.solBalance = solBalance;
        wallet.tokenBalance = tokenBalance;
        wallet.lastUpdated = new Date();

        // Emit balance update event
        this.emit('balanceUpdate', {
          publicKey: wallet.publicKey.toString(),
          solBalance,
          tokenBalance,
          timestamp: wallet.lastUpdated
        } as BalanceUpdate);

      } catch (error) {
        console.error(`Failed to update balance for ${wallet.publicKey.toString()}:`, error);
      }
    });

    await Promise.all(updatePromises);
  }

  /**
   * Start automatic balance monitoring
   */
  private startBalanceMonitoring(): void {
    // Update balances every 15 seconds as specified
    this.balanceUpdateInterval = setInterval(async () => {
      await this.updateBalances();
    }, 15000);

    // Initial balance update
    this.updateBalances();
  }

  /**
   * Stop balance monitoring
   */
  stopBalanceMonitoring(): void {
    if (this.balanceUpdateInterval) {
      clearInterval(this.balanceUpdateInterval);
      this.balanceUpdateInterval = null;
    }
  }

  /**
   * Get wallets by type
   */
  getWalletsByType(type: 'buy-only' | 'sell-only' | 'dual'): WalletInfo[] {
    return Array.from(this.wallets.values()).filter(wallet => 
      wallet.type === type || wallet.type === 'dual'
    );
  }

  /**
   * Get wallets suitable for buying (have SOL balance)
   */
  getBuyWallets(minSolBalance: number = 0.001): WalletInfo[] {
    return this.getWalletsByType('buy-only')
      .concat(this.getWalletsByType('dual'))
      .filter(wallet => wallet.solBalance >= minSolBalance);
  }

  /**
   * Get wallets suitable for selling (have token balance)
   */
  getSellWallets(minTokenBalance: number = 0): WalletInfo[] {
    return this.getWalletsByType('sell-only')
      .concat(this.getWalletsByType('dual'))
      .filter(wallet => wallet.tokenBalance > minTokenBalance);
  }

  /**
   * Get wallet by public key
   */
  getWallet(publicKey: string): WalletInfo | undefined {
    return this.wallets.get(publicKey);
  }

  /**
   * Get all wallets
   */
  getAllWallets(): WalletInfo[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Get total SOL balance across all wallets
   */
  getTotalSolBalance(): number {
    return Array.from(this.wallets.values())
      .reduce((total, wallet) => total + wallet.solBalance, 0);
  }

  /**
   * Get total token balance across all wallets
   */
  getTotalTokenBalance(): number {
    return Array.from(this.wallets.values())
      .reduce((total, wallet) => total + wallet.tokenBalance, 0);
  }

  /**
   * Reload wallets from keystore (useful when new wallets are added)
   */
  async reloadWallets(): Promise<void> {
    console.log('🔄 Reloading wallets...');

    // Stop current monitoring
    this.stopBalanceMonitoring();

    // Clear current wallets (but don't zero out keys as they might be in use)
    this.wallets.clear();

    // Reload from keystore
    await this.loadWallets();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopBalanceMonitoring();

    // Zero out sensitive data
    for (const wallet of this.wallets.values()) {
      wallet.keypair.secretKey.fill(0);
    }

    this.wallets.clear();
  }
}
