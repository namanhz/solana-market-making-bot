import { PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { WalletManager } from './WalletManager';
import { DexManager, SwapParams, SwapResult } from './DexManager';
import { 
  splitAmountAcrossWallets, 
  createBuyWeights, 
  createSellWeights,
  calculateOptimalTradeSize,
  SplitResult 
} from './SplitAlgorithm';
import { TradeTick } from './Scheduler';

/**
 * Generate a random number between min and max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}


export interface TradeConfig {
  minTradeAmount: number;
  maxSlippageBps: number;
  maxConcurrentTrades: number;
  tradePercentage: number;
  buyVolumeSol?: {
    min: number;
    max: number;
  };
  sellVolumeToken?: {
    min: number;
    max: number;
  };
  sellVolumeSolValue?: {
    min: number;
    max: number;
  };
  buyMaxWallets?: number;
  sellMaxWallets?: number;
}

export interface TradeRecord {
  id: string;
  timestamp: Date;
  type: 'buy' | 'sell';
  walletPublicKey: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount?: number;
  txId?: string;
  success: boolean;
  error?: string;
  slippage?: number;
  fees?: number;
}

export interface TradeSession {
  id: string;
  type: 'buy' | 'sell';
  timestamp: Date;
  totalAmount: number;
  walletCount: number;
  trades: TradeRecord[];
  completed: boolean;
  success: boolean;
}

export class TradeOrchestrator extends EventEmitter {
  private walletManager: WalletManager;
  private dexManager: DexManager;
  private config: TradeConfig;
  private solMint: PublicKey;
  private tokenMint: PublicKey;

  private activeTrades: Set<string> = new Set();
  private tradeHistory: TradeRecord[] = [];
  private sessionHistory: TradeSession[] = [];
  private tradeQueue: Array<{ type: 'buy' | 'sell'; timestamp: number }> = [];
  private isProcessingQueue = false;

  constructor(
    walletManager: WalletManager,
    dexManager: DexManager,
    config: TradeConfig,
    solMint: PublicKey,
    tokenMint: PublicKey
  ) {
    super();
    this.walletManager = walletManager;
    this.dexManager = dexManager;
    this.config = config;
    this.solMint = solMint;
    this.tokenMint = tokenMint;

  }

  /**
   * Handle trade tick from scheduler
   */
  async handleTradeTick(tradeTick: TradeTick): Promise<void> {
    console.log(`📥 Queuing ${tradeTick.type} trade tick at ${tradeTick.timestamp.toISOString()}`);

    // Add to queue instead of executing immediately
    this.tradeQueue.push({
      type: tradeTick.type,
      timestamp: Date.now()
    });

    // Start processing queue if not already running
    if (!this.isProcessingQueue) {
      this.processTradeQueue();
    }
  }

  /**
   * Process trade queue with rate limiting
   */
  private async processTradeQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;
    console.log(`🔄 Starting trade queue processing (${this.tradeQueue.length} trades queued)`);

    while (this.tradeQueue.length > 0) {
      const trade = this.tradeQueue.shift();
      if (!trade) break;

      try {
        console.log(`⚡ Processing ${trade.type} trade from queue`);

        if (trade.type === 'buy') {
          await this.executeBuyTrades();
        } else {
          await this.executeSellTrades();
        }

        // Wait between trades to respect rate limits
        if (this.tradeQueue.length > 0) {
          console.log(`⏳ Waiting 2 seconds before next trade (${this.tradeQueue.length} remaining)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Failed to process ${trade.type} trade:`, error);
        this.emit('tradeError', {
          type: trade.type,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    this.isProcessingQueue = false;
    console.log(`✅ Trade queue processing completed`);
  }

  /**
   * Execute buy trades
   */
  private async executeBuyTrades(): Promise<void> {
    // Get wallets with SOL balance
    const allBuyWallets = this.walletManager.getBuyWallets(this.config.minTradeAmount);

    if (allBuyWallets.length === 0) {
      console.warn('No wallets available for buying (insufficient SOL balance)');
      return;
    }

    // Randomly select 1 to all available wallets for more natural trading patterns
    const maxWallets = Math.min(allBuyWallets.length, this.config.buyMaxWallets || 5); // Configurable cap
    const numWallets = Math.floor(Math.random() * maxWallets) + 1; // Random between 1 and maxWallets

    // Shuffle wallets and take the random number
    const shuffledWallets = [...allBuyWallets].sort(() => Math.random() - 0.5);
    const buyWallets = shuffledWallets.slice(0, numWallets);

    console.log(`🎲 Randomly selected ${numWallets} out of ${allBuyWallets.length} available buy wallets`);

    // Calculate total available SOL
    const totalSol = buyWallets.reduce((sum, wallet) => sum + wallet.solBalance, 0);

    // Calculate trade size - use specific buy volume if configured
    let tradeSize: number;
    if (this.config.buyVolumeSol) {
      // Generate random buy volume within the specified range
      const randomBuyVolume = randomBetween(this.config.buyVolumeSol.min, this.config.buyVolumeSol.max);
      tradeSize = Math.min(randomBuyVolume, totalSol);
      tradeSize = Math.max(tradeSize, this.config.minTradeAmount);
      console.log(`💰 Random buy volume (TOTAL): ${randomBuyVolume.toFixed(6)} SOL (range: ${this.config.buyVolumeSol.min}-${this.config.buyVolumeSol.max})`);
      console.log(`💰 This total will be split across ${buyWallets.length} selected wallets`);
    } else {
      tradeSize = calculateOptimalTradeSize(
        totalSol,
        this.config.tradePercentage,
        undefined,
        this.config.minTradeAmount
      );
    }

    console.log(`Executing buy trades: ${tradeSize.toFixed(6)} SOL TOTAL across ${buyWallets.length} wallets (${allBuyWallets.length} total available)`);

    // Create weights and split amount
    const walletData = buyWallets.map(w => ({
      publicKey: w.publicKey.toString(),
      solBalance: w.solBalance
    }));
    const weights = createBuyWeights(walletData, this.config.minTradeAmount);
    const splits = splitAmountAcrossWallets(tradeSize, weights, {
      minPerWalletAmount: this.config.minTradeAmount,
      maxWallets: this.config.maxConcurrentTrades
    });

    // Log the split details
    console.log(`📊 Buy volume split details:`);
    splits.forEach((split, index) => {
      const percentage = (split.amount / tradeSize * 100).toFixed(1);
      console.log(`   Wallet ${index + 1}: ${split.amount.toFixed(6)} SOL (${percentage}%)`);
    });

    // Create trade session
    const session = this.createTradeSession('buy', tradeSize, splits.length);

    // Execute trades in parallel
    const tradePromises = splits.map(split =>
      this.executeSingleTrade(session, 'buy', split)
    );

    const results = await Promise.allSettled(tradePromises);
    
    // Update session
    session.completed = true;
    session.success = results.every(result => result.status === 'fulfilled');
    
    this.emit('tradeSessionCompleted', session);
  }

  /**
   * Execute sell trades
   */
  private async executeSellTrades(): Promise<void> {
    // Get wallets with token balance AND sufficient SOL for transaction fees
    const allSellWallets = this.walletManager.getSellWallets(0);

    if (allSellWallets.length === 0) {
      console.warn('No wallets available for selling (no token balance)');
      return;
    }

    // Filter wallets that have enough SOL for transaction fees (minimum 0.01 SOL)
    const walletsWithSol = allSellWallets.filter(wallet => wallet.solBalance >= 0.01);

    if (walletsWithSol.length === 0) {
      console.warn('No sell wallets have sufficient SOL for transaction fees (need at least 0.01 SOL)');
      console.warn('Sell wallet balances:', allSellWallets.map(w => `${w.publicKey.toString().slice(0, 8)}: ${w.solBalance.toFixed(6)} SOL`));
      return;
    }

    // Randomly select 1 to all available wallets for more natural trading patterns
    const maxSellWallets = Math.min(walletsWithSol.length, this.config.sellMaxWallets || 3); // Configurable cap
    const numSellWallets = Math.floor(Math.random() * maxSellWallets) + 1; // Random between 1 and maxSellWallets

    // Shuffle wallets and take the random number
    const shuffledSellWallets = [...walletsWithSol].sort(() => Math.random() - 0.5);
    const sellWallets = shuffledSellWallets.slice(0, numSellWallets);

    console.log(`🎲 Randomly selected ${numSellWallets} out of ${walletsWithSol.length} available sell wallets`);

    // Calculate total available tokens
    const totalTokens = sellWallets.reduce((sum, wallet) => sum + wallet.tokenBalance, 0);

    // Calculate trade size - use specific sell volume if configured
    let tradeSize: number;
    if (this.config.sellVolumeSolValue) {
      // Generate random sell volume SOL value within the specified range
      const randomSellVolumeSol = randomBetween(this.config.sellVolumeSolValue.min, this.config.sellVolumeSolValue.max);

      // Calculate tokens based on recent market rate (approximately 705,000 tokens per SOL)
      const estimatedTokensPerSol = 705000; // Based on recent trading data
      const targetTokenAmount = randomSellVolumeSol * estimatedTokensPerSol;

      console.log(`💰 Target sell volume: ${randomSellVolumeSol.toFixed(6)} SOL (range: ${this.config.sellVolumeSolValue.min}-${this.config.sellVolumeSolValue.max})`);
      console.log(`💰 Estimated tokens needed: ${targetTokenAmount.toFixed(0)} tokens (at ~${estimatedTokensPerSol.toLocaleString()} tokens/SOL)`);

      // Leave 10% buffer to avoid insufficient funds errors
      const maxSellable = totalTokens * 0.9;
      tradeSize = Math.min(targetTokenAmount, maxSellable);
      tradeSize = Math.max(tradeSize, 0);

      console.log(`Selling ${tradeSize.toFixed(6)} tokens for target ~${randomSellVolumeSol.toFixed(6)} SOL`);
      console.log(`Available tokens: ${totalTokens.toFixed(6)}, Max sellable (90%): ${maxSellable.toFixed(6)}`);

      // If calculated amount is too small, use a reasonable fallback
      if (tradeSize < 1000) {
        console.warn('Calculated sell amount too small, using reasonable fallback');
        if (this.config.sellVolumeToken) {
          const randomSellVolumeToken = randomBetween(this.config.sellVolumeToken.min, this.config.sellVolumeToken.max);
          tradeSize = randomSellVolumeToken;
          console.log(`💰 Using random token fallback: ${randomSellVolumeToken.toFixed(6)} tokens (range: ${this.config.sellVolumeToken.min}-${this.config.sellVolumeToken.max})`);
        } else {
          // Use a small fixed amount instead of percentage-based calculation
          tradeSize = Math.min(2000, totalTokens * 0.01); // 1% of tokens or 2000 tokens, whichever is smaller
          console.log(`💰 Using fixed fallback: ${tradeSize.toFixed(6)} tokens (1% of available or 2000 max)`);
        }
      }
    } else if (this.config.sellVolumeToken) {
      // Use random token volume if configured
      const randomSellVolumeToken = randomBetween(this.config.sellVolumeToken.min, this.config.sellVolumeToken.max);
      const maxSellable = totalTokens * 0.9; // Leave 10% buffer to avoid insufficient funds errors
      tradeSize = Math.min(randomSellVolumeToken, maxSellable);
      tradeSize = Math.max(tradeSize, 0); // No minimum for token sales
      console.log(`💰 Random sell volume: ${randomSellVolumeToken.toFixed(6)} tokens (range: ${this.config.sellVolumeToken.min}-${this.config.sellVolumeToken.max})`);
      console.log(`Available tokens: ${totalTokens.toFixed(6)}, Max sellable (90%): ${maxSellable.toFixed(6)}`);
    } else {
      tradeSize = calculateOptimalTradeSize(
        totalTokens,
        this.config.tradePercentage,
        undefined,
        0 // No minimum for token sales
      );
    }

    console.log(`Executing sell trades: ${tradeSize} tokens across ${sellWallets.length} wallets`);
    if (sellWallets.length > 0 && sellWallets[0]) {
      const wallet = sellWallets[0];
      console.log(`🔍 Debug: Wallet ${wallet.publicKey.toString().slice(0, 8)} has ${wallet.tokenBalance} tokens, trying to sell ${tradeSize} tokens`);
    }

    // Create weights and split amount
    const walletData = sellWallets.map(w => ({
      publicKey: w.publicKey.toString(),
      tokenBalance: w.tokenBalance
    }));
    const weights = createSellWeights(walletData, 0);
    const splits = splitAmountAcrossWallets(tradeSize, weights, {
      minPerWalletAmount: 0,
      maxWallets: this.config.maxConcurrentTrades
    });

    // Create trade session
    const session = this.createTradeSession('sell', tradeSize, splits.length);

    // Execute trades in parallel
    const tradePromises = splits.map(split => 
      this.executeSingleTrade(session, 'sell', split)
    );

    const results = await Promise.allSettled(tradePromises);
    
    // Update session
    session.completed = true;
    session.success = results.every(result => result.status === 'fulfilled');
    
    this.emit('tradeSessionCompleted', session);
  }

  /**
   * Execute a single trade
   */
  private async executeSingleTrade(
    session: TradeSession,
    type: 'buy' | 'sell',
    split: SplitResult
  ): Promise<TradeRecord> {
    const tradeId = `${session.id}-${split.publicKey}-${Date.now()}`;
    
    // Get wallet info
    const wallet = this.walletManager.getWallet(split.publicKey);
    if (!wallet) {
      throw new Error(`Wallet not found: ${split.publicKey}`);
    }

    // Create trade record
    const trade: TradeRecord = {
      id: tradeId,
      timestamp: new Date(),
      type,
      walletPublicKey: split.publicKey,
      inputMint: type === 'buy' ? this.solMint.toString() : this.tokenMint.toString(),
      outputMint: type === 'buy' ? this.tokenMint.toString() : this.solMint.toString(),
      inputAmount: split.amount,
      success: false
    };

    try {
      this.activeTrades.add(tradeId);

      // Prepare swap parameters
      const swapParams: SwapParams = {
        srcPk: type === 'buy' ? this.solMint : this.tokenMint,
        dstPk: type === 'buy' ? this.tokenMint : this.solMint,
        amount: split.amount,
        slippage: this.config.maxSlippageBps, // Keep as basis points
        userKeypair: wallet.keypair
      };

      // Execute swap
      const result: SwapResult = await this.dexManager.swap(swapParams);

      // Update trade record
      trade.success = result.success;
      if (result.txId) trade.txId = result.txId;
      if (result.outputAmount !== undefined) trade.outputAmount = result.outputAmount;
      if (result.actualSlippage !== undefined) trade.slippage = result.actualSlippage;
      if (result.fees !== undefined) trade.fees = result.fees;
      if (result.error) trade.error = result.error;

      if (result.success) {
        console.log(`✅ ${type} trade successful: ${split.amount} -> ${result.outputAmount} (${result.txId})`);
      } else {
        console.error(`❌ ${type} trade failed: ${result.error}`);
      }

    } catch (error) {
      trade.success = false;
      trade.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${type} trade error:`, error);
    } finally {
      this.activeTrades.delete(tradeId);
      this.tradeHistory.push(trade);
      session.trades.push(trade);
      
      this.emit('tradeCompleted', trade);
    }

    return trade;
  }

  /**
   * Create a new trade session
   */
  private createTradeSession(
    type: 'buy' | 'sell',
    totalAmount: number,
    walletCount: number
  ): TradeSession {
    const session: TradeSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      totalAmount,
      walletCount,
      trades: [],
      completed: false,
      success: false
    };

    this.sessionHistory.push(session);
    this.emit('tradeSessionStarted', session);
    
    return session;
  }

  /**
   * Get active trades count
   */
  getActiveTradesCount(): number {
    return this.activeTrades.size;
  }

  /**
   * Get trade history
   */
  getTradeHistory(limit?: number): TradeRecord[] {
    if (limit) {
      return this.tradeHistory.slice(-limit);
    }
    return [...this.tradeHistory];
  }

  /**
   * Get session history
   */
  getSessionHistory(limit?: number): TradeSession[] {
    if (limit) {
      return this.sessionHistory.slice(-limit);
    }
    return [...this.sessionHistory];
  }

  /**
   * Get trading statistics
   */
  getTradingStats(): {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalVolume: number;
    averageTradeSize: number;
  } {
    const totalTrades = this.tradeHistory.length;
    const successfulTrades = this.tradeHistory.filter(t => t.success).length;
    const failedTrades = totalTrades - successfulTrades;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;
    const totalVolume = this.tradeHistory.reduce((sum, t) => sum + t.inputAmount, 0);
    const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

    return {
      totalTrades,
      successfulTrades,
      failedTrades,
      successRate,
      totalVolume,
      averageTradeSize
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TradeConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): TradeConfig {
    return { ...this.config };
  }


}
