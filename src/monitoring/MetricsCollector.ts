import { register, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import { EventEmitter } from 'events';
import { TradeRecord, TradeSession } from '../core/TradeOrchestrator';
import { WalletInfo } from '../core/WalletManager';

export class MetricsCollector extends EventEmitter {
  // Counters
  private mmTxSuccessTotal!: Counter<string>;
  private mmTxFailTotal!: Counter<string>;

  // Gauges
  private mmWalletSol!: Gauge<string>;
  private mmWalletToken!: Gauge<string>;
  private mmActiveWallets!: Gauge<string>;
  private mmTotalSolBalance!: Gauge<string>;
  private mmTotalTokenBalance!: Gauge<string>;

  // Histograms
  private mmSchedDelayMs!: Histogram<string>;
  private mmTradeExecutionMs!: Histogram<string>;
  private mmSlippageBps!: Histogram<string>;

  // Additional metrics
  private mmRpcResponseMs!: Histogram<string>;
  private mmJupiterResponseMs!: Histogram<string>;
  private mmErrorRate!: Gauge<string>;
  private mmThroughputTps!: Gauge<string>;

  constructor() {
    super();

    // Initialize default metrics
    collectDefaultMetrics({ register });

    // Initialize custom metrics
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Transaction counters
    this.mmTxSuccessTotal = new Counter({
      name: 'mm_tx_success_total',
      help: 'Total number of successful swaps',
      labelNames: ['type', 'dex'] // buy/sell, letsbonk/jupiter
    });

    this.mmTxFailTotal = new Counter({
      name: 'mm_tx_fail_total',
      help: 'Total number of failed swaps after retries',
      labelNames: ['type', 'dex', 'error_type']
    });

    // Wallet balance gauges
    this.mmWalletSol = new Gauge({
      name: 'mm_wallet_sol',
      help: 'Per-wallet SOL balance',
      labelNames: ['wallet_address', 'wallet_type']
    });

    this.mmWalletToken = new Gauge({
      name: 'mm_wallet_token',
      help: 'Per-wallet token balance',
      labelNames: ['wallet_address', 'wallet_type']
    });

    this.mmActiveWallets = new Gauge({
      name: 'mm_active_wallets',
      help: 'Number of active wallets',
      labelNames: ['type'] // buy/sell/dual
    });

    this.mmTotalSolBalance = new Gauge({
      name: 'mm_total_sol_balance',
      help: 'Total SOL balance across all wallets'
    });

    this.mmTotalTokenBalance = new Gauge({
      name: 'mm_total_token_balance',
      help: 'Total token balance across all wallets'
    });

    // Performance histograms
    this.mmSchedDelayMs = new Histogram({
      name: 'mm_sched_delay_ms',
      help: 'Latency between scheduled tick and first tx submit',
      buckets: [10, 50, 100, 500, 1000, 2000, 5000]
    });

    this.mmTradeExecutionMs = new Histogram({
      name: 'mm_trade_execution_ms',
      help: 'Trade execution time from start to confirmation',
      buckets: [100, 500, 1000, 2000, 5000, 10000, 30000]
    });

    this.mmSlippageBps = new Histogram({
      name: 'mm_slippage_bps',
      help: 'Actual slippage in basis points',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500]
    });

    // API response times
    this.mmRpcResponseMs = new Histogram({
      name: 'mm_rpc_response_ms',
      help: 'RPC response time in milliseconds',
      buckets: [10, 50, 100, 200, 500, 1000, 2000]
    });

    this.mmJupiterResponseMs = new Histogram({
      name: 'mm_jupiter_response_ms',
      help: 'Jupiter API response time in milliseconds',
      buckets: [50, 100, 200, 500, 1000, 2000, 5000]
    });

    // Error rates and throughput
    this.mmErrorRate = new Gauge({
      name: 'mm_error_rate',
      help: 'Error rate percentage over last period',
      labelNames: ['error_type'] // rpc/jupiter/network/validation
    });

    this.mmThroughputTps = new Gauge({
      name: 'mm_throughput_tps',
      help: 'Transactions per second throughput'
    });

    // Register all metrics
    register.registerMetric(this.mmTxSuccessTotal);
    register.registerMetric(this.mmTxFailTotal);
    register.registerMetric(this.mmWalletSol);
    register.registerMetric(this.mmWalletToken);
    register.registerMetric(this.mmActiveWallets);
    register.registerMetric(this.mmTotalSolBalance);
    register.registerMetric(this.mmTotalTokenBalance);
    register.registerMetric(this.mmSchedDelayMs);
    register.registerMetric(this.mmTradeExecutionMs);
    register.registerMetric(this.mmSlippageBps);
    register.registerMetric(this.mmRpcResponseMs);
    register.registerMetric(this.mmJupiterResponseMs);
    register.registerMetric(this.mmErrorRate);
    register.registerMetric(this.mmThroughputTps);
  }

  /**
   * Record successful transaction
   */
  recordSuccessfulTx(type: 'buy' | 'sell', dex: string): void {
    this.mmTxSuccessTotal.inc({ type, dex });
  }

  /**
   * Record failed transaction
   */
  recordFailedTx(type: 'buy' | 'sell', dex: string, errorType: string): void {
    this.mmTxFailTotal.inc({ type, dex, error_type: errorType });
  }

  /**
   * Update wallet balances
   */
  updateWalletBalances(wallets: WalletInfo[]): void {
    let totalSol = 0;
    let totalToken = 0;
    const activeWalletCounts = { 'buy-only': 0, 'sell-only': 0, 'dual': 0 };

    for (const wallet of wallets) {
      const address = wallet.publicKey.toString();
      const type = wallet.type;

      // Update individual wallet metrics
      this.mmWalletSol.set({ wallet_address: address, wallet_type: type }, wallet.solBalance);
      this.mmWalletToken.set({ wallet_address: address, wallet_type: type }, wallet.tokenBalance);

      // Accumulate totals
      totalSol += wallet.solBalance;
      totalToken += wallet.tokenBalance;

      // Count active wallets (those with balance)
      if (wallet.solBalance > 0.001 || wallet.tokenBalance > 0) {
        activeWalletCounts[type]++;
      }
    }

    // Update total balances
    this.mmTotalSolBalance.set(totalSol);
    this.mmTotalTokenBalance.set(totalToken);

    // Update active wallet counts
    this.mmActiveWallets.set({ type: 'buy-only' }, activeWalletCounts['buy-only']);
    this.mmActiveWallets.set({ type: 'sell-only' }, activeWalletCounts['sell-only']);
    this.mmActiveWallets.set({ type: 'dual' }, activeWalletCounts['dual']);
  }

  /**
   * Record scheduling delay
   */
  recordSchedulingDelay(delayMs: number): void {
    this.mmSchedDelayMs.observe(delayMs);
  }

  /**
   * Record trade execution time
   */
  recordTradeExecution(executionMs: number): void {
    this.mmTradeExecutionMs.observe(executionMs);
  }

  /**
   * Record slippage
   */
  recordSlippage(slippageBps: number): void {
    this.mmSlippageBps.observe(slippageBps);
  }

  /**
   * Record RPC response time
   */
  recordRpcResponse(responseMs: number): void {
    this.mmRpcResponseMs.observe(responseMs);
  }

  /**
   * Record Jupiter API response time
   */
  recordJupiterResponse(responseMs: number): void {
    this.mmJupiterResponseMs.observe(responseMs);
  }

  /**
   * Update error rate
   */
  updateErrorRate(errorType: string, rate: number): void {
    this.mmErrorRate.set({ error_type: errorType }, rate);
  }

  /**
   * Update throughput
   */
  updateThroughput(tps: number): void {
    this.mmThroughputTps.set(tps);
  }

  /**
   * Process trade record for metrics
   */
  processTradeRecord(trade: TradeRecord): void {
    const dex = 'unknown'; // Would need to track which DEX was used
    
    if (trade.success) {
      this.recordSuccessfulTx(trade.type, dex);
      
      if (trade.slippage !== undefined) {
        this.recordSlippage(trade.slippage * 100); // Convert to bps
      }
    } else {
      const errorType = this.categorizeError(trade.error || 'unknown');
      this.recordFailedTx(trade.type, dex, errorType);
    }
  }

  /**
   * Process trade session for metrics
   */
  processTradeSession(session: TradeSession): void {
    const executionTime = Date.now() - session.timestamp.getTime();
    this.recordTradeExecution(executionTime);

    // Process individual trades
    for (const trade of session.trades) {
      this.processTradeRecord(trade);
    }
  }

  /**
   * Categorize error for metrics
   */
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('rpc') || errorLower.includes('connection')) {
      return 'rpc';
    } else if (errorLower.includes('jupiter')) {
      return 'jupiter';
    } else if (errorLower.includes('network') || errorLower.includes('timeout')) {
      return 'network';
    } else if (errorLower.includes('slippage') || errorLower.includes('insufficient')) {
      return 'validation';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    register.clear();
    this.initializeMetrics();
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): any {
    return register.getSingleMetric(name);
  }
}
