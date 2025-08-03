#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { Connection, PublicKey } from '@solana/web3.js';
import { ConfigManager } from './core/ConfigManager';
import { WalletManager } from './core/WalletManager';
import { DexManager, LetsBonkClient, JupiterClient } from './core/DexManager';
import { Scheduler } from './core/Scheduler';
import { TradeOrchestrator } from './core/TradeOrchestrator';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { RestServer } from './monitoring/RestServer';

// Load environment variables
dotenv.config();

class SolanaMarketMakingBot {
  private configManager: ConfigManager;
  private connection: Connection | null = null;
  private walletManager: WalletManager | null = null;
  private dexManager: DexManager | null = null;
  private scheduler: Scheduler | null = null;
  private tradeOrchestrator: TradeOrchestrator | null = null;
  private metricsCollector: MetricsCollector | null = null;
  private restServer: RestServer | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Solana Market-Making Bot...');

      // Load configuration
      console.log('📋 Loading configuration...');
      const config = await this.configManager.loadConfigWithOverrides();
      
      // Initialize RPC connection
      console.log('🔗 Connecting to Solana RPC...');
      const rpcEndpoint = config.rpc.endpoints[0] || 'https://api.mainnet-beta.solana.com';
      console.log(`Using RPC endpoint: ${rpcEndpoint}`);

      const connectionConfig: any = {
        commitment: 'confirmed'
      };

      if (process.env['SOLANA_WS_URL']) {
        connectionConfig.wsEndpoint = process.env['SOLANA_WS_URL'];
      }

      this.connection = new Connection(rpcEndpoint, connectionConfig);

      // Test connection
      const version = await this.connection.getVersion();
      console.log(`✅ Connected to Solana RPC (version: ${version['solana-core']})`);

      // Initialize metrics collector
      console.log('📊 Initializing metrics collector...');
      this.metricsCollector = new MetricsCollector();

      // Initialize wallet manager
      console.log('👛 Loading wallets...');
      if (!this.connection) {
        throw new Error('Connection not initialized');
      }
      this.walletManager = new WalletManager(
        this.connection,
        config.wallets.keystoreDir,
        config.wallets.encryptionKey,
        new PublicKey(config.token.mint)
      );
      await this.walletManager.loadWallets();

      // Set up wallet balance monitoring
      this.walletManager.on('balanceUpdate', (update) => {
        console.log(`💰 Balance update: ${update.publicKey} - SOL: ${update.solBalance}, Token: ${update.tokenBalance}`);
      });

      // Initialize DEX clients
      console.log('🔄 Initializing DEX clients...');
      const primaryClient = config.dex.primary === 'letsbonk' 
        ? new LetsBonkClient(this.connection, config.dex.letsBonk?.apiUrl || '')
        : new JupiterClient(this.connection, config.dex.jupiter?.apiUrl || '', config.dex.jupiter?.rateLimit);

      const fallbackClient = config.dex.fallback === 'letsbonk'
        ? new LetsBonkClient(this.connection, config.dex.letsBonk?.apiUrl || '')
        : new JupiterClient(this.connection, config.dex.jupiter?.apiUrl || '', config.dex.jupiter?.rateLimit);

      this.dexManager = new DexManager(
        primaryClient,
        fallbackClient,
        config.dex.liquidityThreshold
      );

      // Initialize scheduler
      console.log('⏰ Initializing scheduler...');
      this.scheduler = new Scheduler(config.scheduling);

      // Initialize trade orchestrator
      console.log('🎯 Initializing trade orchestrator...');
      const tradeConfig: any = {
        minTradeAmount: config.wallets.minTradeAmount,
        maxSlippageBps: config.wallets.maxSlippageBps,
        maxConcurrentTrades: 10, // Default value
        tradePercentage: 0.1 // Default 10%
      };

      if (config.wallets.buyVolumeSol) {
        tradeConfig.buyVolumeSol = config.wallets.buyVolumeSol;
      }

      if (config.wallets.sellVolumeToken) {
        tradeConfig.sellVolumeToken = config.wallets.sellVolumeToken;
      }

      if (config.wallets.sellVolumeSolValue) {
        tradeConfig.sellVolumeSolValue = config.wallets.sellVolumeSolValue;
      }

      if (config.wallets.buyMaxWallets) {
        tradeConfig.buyMaxWallets = config.wallets.buyMaxWallets;
      }

      if (config.wallets.sellMaxWallets) {
        tradeConfig.sellMaxWallets = config.wallets.sellMaxWallets;
      }

      this.tradeOrchestrator = new TradeOrchestrator(
        this.walletManager,
        this.dexManager,
        tradeConfig,
        new PublicKey('So11111111111111111111111111111111111111112'), // SOL mint
        new PublicKey(config.token.mint)
      );

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize REST server if enabled
      if (config.monitoring?.rest?.enabled) {
        console.log('🌐 Starting REST API server...');
        this.restServer = new RestServer(
          config.monitoring.rest.port || 3000,
          this.metricsCollector,
          this.tradeOrchestrator,
          this.walletManager,
          this.scheduler,
          config.wallets.keystoreDir,
          config.wallets.encryptionKey
        );
        await this.restServer.start();
      }

      console.log('✅ Bot initialization complete!');
    } catch (error) {
      console.error('❌ Failed to initialize bot:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.scheduler || !this.tradeOrchestrator || !this.metricsCollector || !this.walletManager) {
      throw new Error('Components not initialized');
    }

    // Handle trade ticks from scheduler
    this.scheduler.on('tradeTick', async (tradeTick) => {
      try {
        await this.tradeOrchestrator!.handleTradeTick(tradeTick);

        // Record scheduling delay
        const delay = Date.now() - tradeTick.timestamp.getTime();
        this.metricsCollector!.recordSchedulingDelay(delay);
      } catch (error) {
        console.error('Failed to handle trade tick:', error);
      }
    });

    // Handle trade completion
    this.tradeOrchestrator.on('tradeCompleted', (trade) => {
      this.metricsCollector!.processTradeRecord(trade);
    });

    // Handle trade session completion
    this.tradeOrchestrator.on('tradeSessionCompleted', (session) => {
      this.metricsCollector!.processTradeSession(session);
      console.log(`📈 Trade session completed: ${session.type} - ${session.trades.length} trades, Success: ${session.success}`);
    });

    // Handle wallet balance updates for metrics
    this.walletManager.on('balanceUpdate', () => {
      const wallets = this.walletManager!.getAllWallets();
      this.metricsCollector!.updateWalletBalances(wallets);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      this.shutdown();
    });
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Bot is already running');
      return;
    }

    try {
      console.log('🎬 Starting market-making bot...');
      
      if (!this.scheduler) {
        throw new Error('Scheduler not initialized');
      }

      this.scheduler.start();
      this.isRunning = true;

      console.log('✅ Market-making bot started successfully!');
      console.log('📊 Monitor at: http://localhost:3000/api/health');
      console.log('📈 Metrics at: http://localhost:3000/metrics');
      
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping market-making bot...');

    try {
      // Stop scheduler
      if (this.scheduler) {
        this.scheduler.stop();
      }

      // Stop wallet monitoring
      if (this.walletManager) {
        this.walletManager.stopBalanceMonitoring();
      }

      this.isRunning = false;
      console.log('✅ Bot stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping bot:', error);
    }
  }

  /**
   * Shutdown the bot and cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('🧹 Shutting down and cleaning up...');

    try {
      await this.stop();

      // Stop REST server
      if (this.restServer) {
        await this.restServer.stop();
      }

      // Cleanup wallet manager
      if (this.walletManager) {
        this.walletManager.cleanup();
      }

      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Get bot status
   */
  getStatus(): {
    isRunning: boolean;
    uptime: number;
    walletCount: number;
    totalSolBalance: number;
    totalTokenBalance: number;
  } {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - Date.now() : 0, // Would need to track start time
      walletCount: this.walletManager?.getAllWallets().length || 0,
      totalSolBalance: this.walletManager?.getTotalSolBalance() || 0,
      totalTokenBalance: this.walletManager?.getTotalTokenBalance() || 0
    };
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const bot = new SolanaMarketMakingBot();

  try {
    await bot.initialize();
    await bot.start();

    // Keep the process running
    process.stdin.resume();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the bot if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { SolanaMarketMakingBot };
