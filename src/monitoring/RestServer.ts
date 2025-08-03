import express, { Request, Response } from 'express';
import { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { MetricsCollector } from './MetricsCollector';
import { TradeOrchestrator } from '../core/TradeOrchestrator';
import { WalletManager } from '../core/WalletManager';
import { Scheduler } from '../core/Scheduler';
import { SimpleWalletCreator } from '../utils/SimpleWalletCreator';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    scheduler: boolean;
    walletManager: boolean;
    dexManager: boolean;
    rpcConnection: boolean;
  };
  errors?: string[];
}

export interface SystemStats {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  lastUpdate: string;
}

export class RestServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  private metricsCollector: MetricsCollector;
  private tradeOrchestrator: TradeOrchestrator;
  private walletManager: WalletManager;
  private scheduler: Scheduler;
  private startTime: Date;
  private walletCreator: SimpleWalletCreator;

  constructor(
    port: number,
    metricsCollector: MetricsCollector,
    tradeOrchestrator: TradeOrchestrator,
    walletManager: WalletManager,
    scheduler: Scheduler,
    keystoreDir: string = './keystore',
    encryptionKey: string = 'demo_encryption_key_32_chars_long'
  ) {
    this.port = port;
    this.metricsCollector = metricsCollector;
    this.tradeOrchestrator = tradeOrchestrator;
    this.walletManager = walletManager;
    this.scheduler = scheduler;
    this.startTime = new Date();
    this.walletCreator = new SimpleWalletCreator(keystoreDir, encryptionKey);

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files
    this.app.use(express.static('public'));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/healthz', this.handleHealthCheck.bind(this));
    this.app.get('/health', this.handleHealthCheck.bind(this));

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', this.handleMetrics.bind(this));

    // API endpoints
    this.app.get('/api/health', this.handleApiHealth.bind(this));
    this.app.get('/api/metrics', this.handleApiMetrics.bind(this));
    this.app.get('/api/trading-stats', this.handleTradingStats.bind(this));
    this.app.get('/api/wallet-status', this.handleWalletStatus.bind(this));
    this.app.get('/api/system-stats', this.handleSystemStats.bind(this));
    this.app.get('/api/scheduler-status', this.handleSchedulerStatus.bind(this));
    this.app.get('/api/trade-history', this.handleTradeHistory.bind(this));
    this.app.get('/api/session-history', this.handleSessionHistory.bind(this));

    // Control endpoints
    this.app.post('/api/scheduler/start', this.handleSchedulerStart.bind(this));
    this.app.post('/api/scheduler/stop', this.handleSchedulerStop.bind(this));
    this.app.post('/api/trigger-trade', this.handleTriggerTrade.bind(this));

    // Wallet management endpoints
    this.app.post('/api/add-wallet', this.handleAddWallet.bind(this));
    this.app.post('/api/add-multiple-wallets', this.handleAddMultipleWallets.bind(this));
    this.app.get('/api/list-keyfiles', this.handleListKeyfiles.bind(this));
    this.app.post('/api/toggle-wallet', this.handleToggleWallet.bind(this));
    this.app.post('/api/set-wallet-active', this.handleSetWalletActive.bind(this));
    this.app.post('/api/remove-wallet', this.handleRemoveWallet.bind(this));
    this.app.post('/api/remove-all-wallets', this.handleRemoveAllWallets.bind(this));
    this.app.post('/api/reload-wallets', this.handleReloadWallets.bind(this));

    // Configuration management endpoints
    this.app.get('/api/config', this.handleGetConfig.bind(this));
    this.app.post('/api/config', this.handleUpdateConfig.bind(this));

    // 404 handler
    this.app.use('*', (_req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: any) => {
      console.error('API Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private async handleHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }

  private async handleApiHealth(_req: Request, res: Response): Promise<void> {
    const health = await this.getHealthStatus();
    res.json(health);
  }

  private async handleApiMetrics(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsCollector.getMetrics();
      res.json({ metrics });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }

  private handleTradingStats(_req: Request, res: Response): void {
    try {
      const stats = this.tradeOrchestrator.getTradingStats();
      const activeTradesCount = this.tradeOrchestrator.getActiveTradesCount();
      
      res.json({
        ...stats,
        activeTrades: activeTradesCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get trading stats' });
    }
  }

  private handleWalletStatus(_req: Request, res: Response): void {
    try {
      const wallets = this.walletManager.getAllWallets();
      const totalSol = this.walletManager.getTotalSolBalance();
      const totalToken = this.walletManager.getTotalTokenBalance();
      
      const walletSummary = wallets.map(wallet => ({
        publicKey: wallet.publicKey.toString(),
        type: wallet.type,
        solBalance: wallet.solBalance,
        tokenBalance: wallet.tokenBalance,
        lastUpdated: wallet.lastUpdated
      }));

      res.json({
        totalWallets: wallets.length,
        totalSolBalance: totalSol,
        totalTokenBalance: totalToken,
        wallets: walletSummary,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get wallet status' });
    }
  }

  private handleSystemStats(_req: Request, res: Response): void {
    try {
      const stats: SystemStats = {
        uptime: Date.now() - this.startTime.getTime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        activeConnections: this.server?.listening ? 1 : 0,
        lastUpdate: new Date().toISOString()
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get system stats' });
    }
  }

  private handleSchedulerStatus(_req: Request, res: Response): void {
    try {
      const status = {
        isRunning: this.scheduler.isSchedulerRunning(),
        config: this.scheduler.getConfig(),
        nextScheduledTime: this.scheduler.getNextScheduledTime(),
        timeUntilNextTick: this.scheduler.getTimeUntilNextTick(),
        timestamp: new Date().toISOString()
      };

      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get scheduler status' });
    }
  }

  private handleTradeHistory(req: Request, res: Response): void {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined;
      const history = this.tradeOrchestrator.getTradeHistory(limit);
      
      res.json({
        trades: history,
        count: history.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get trade history' });
    }
  }

  private handleSessionHistory(req: Request, res: Response): void {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined;
      const history = this.tradeOrchestrator.getSessionHistory(limit);
      
      res.json({
        sessions: history,
        count: history.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get session history' });
    }
  }

  private handleSchedulerStart(_req: Request, res: Response): void {
    try {
      this.scheduler.start();
      res.json({ message: 'Scheduler started', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start scheduler' });
    }
  }

  private handleSchedulerStop(_req: Request, res: Response): void {
    try {
      this.scheduler.stop();
      res.json({ message: 'Scheduler stopped', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop scheduler' });
    }
  }

  private handleTriggerTrade(req: Request, res: Response): void {
    try {
      const { type } = req.body;

      if (!type || !['buy', 'sell'].includes(type)) {
        res.status(400).json({ error: 'Invalid trade type. Must be "buy" or "sell"' });
        return;
      }

      this.scheduler.triggerTick(type);
      res.json({
        message: `${type} trade triggered`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to trigger trade' });
    }
  }

  private async handleAddWallet(req: Request, res: Response): Promise<void> {
    try {
      const { privateKey, walletType = 'dual' } = req.body;

      if (!privateKey) {
        res.status(400).json({ error: 'Private key is required' });
        return;
      }

      if (!['buy-only', 'sell-only', 'dual'].includes(walletType)) {
        res.status(400).json({ error: 'Invalid wallet type' });
        return;
      }

      // Validate base58 private key
      if (!SimpleWalletCreator.validateBase58PrivateKey(privateKey)) {
        res.status(400).json({ error: 'Invalid base58 private key format' });
        return;
      }

      const result = await this.walletCreator.createWalletFromBase58(privateKey, walletType);

      res.json({
        success: true,
        message: 'Wallet added successfully',
        publicKey: result.publicKey,
        filename: result.filename,
        type: walletType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to add wallet: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleAddMultipleWallets(req: Request, res: Response): Promise<void> {
    try {
      const { privateKeys, walletType = 'dual' } = req.body;

      if (!privateKeys) {
        res.status(400).json({ error: 'Private keys are required' });
        return;
      }

      if (!['buy-only', 'sell-only', 'dual'].includes(walletType)) {
        res.status(400).json({ error: 'Invalid wallet type' });
        return;
      }

      const results = await this.walletCreator.createMultipleWalletsFromBase58(privateKeys, walletType);

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      res.json({
        success: true,
        message: `Processed ${results.length} wallets`,
        results: {
          successful: successful.length,
          failed: failed.length,
          details: results
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to add wallets: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private handleListKeyfiles(_req: Request, res: Response): void {
    try {
      const wallets = this.walletCreator.listWallets();

      res.json({
        wallets,
        count: wallets.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to list wallets: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleToggleWallet(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey } = req.body;

      if (!publicKey) {
        res.status(400).json({ error: 'Public key is required' });
        return;
      }

      const newStatus = await this.walletCreator.toggleWalletActive(publicKey);

      res.json({
        success: true,
        message: `Wallet ${newStatus ? 'activated' : 'deactivated'}`,
        publicKey,
        active: newStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to toggle wallet: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleSetWalletActive(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey, active } = req.body;

      if (!publicKey) {
        res.status(400).json({ error: 'Public key is required' });
        return;
      }

      if (typeof active !== 'boolean') {
        res.status(400).json({ error: 'Active status must be boolean' });
        return;
      }

      await this.walletCreator.setWalletActive(publicKey, active);

      res.json({
        success: true,
        message: `Wallet ${active ? 'activated' : 'deactivated'}`,
        publicKey,
        active,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to set wallet status: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleRemoveWallet(req: Request, res: Response): Promise<void> {
    try {
      const { publicKey } = req.body;

      if (!publicKey) {
        res.status(400).json({ error: 'Public key is required' });
        return;
      }

      await this.walletCreator.removeWallet(publicKey);

      res.json({
        success: true,
        message: 'Wallet removed successfully',
        publicKey,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to remove wallet: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleRemoveAllWallets(_req: Request, res: Response): Promise<void> {
    try {
      const result = await this.walletCreator.removeAllWallets();

      res.json({
        success: true,
        message: `Removed ${result.removed} wallets successfully`,
        details: {
          removed: result.removed,
          failed: result.failed,
          errors: result.errors
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to remove all wallets: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async handleReloadWallets(_req: Request, res: Response): Promise<void> {
    try {
      await this.walletManager.reloadWallets();

      res.json({
        success: true,
        message: 'Wallets reloaded successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to reload wallets: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private handleGetConfig(_req: Request, res: Response): void {
    try {
      const envPath = path.join(process.cwd(), '.env');

      if (!fs.existsSync(envPath)) {
        res.status(404).json({ error: '.env file not found' });
        return;
      }

      const envContent = fs.readFileSync(envPath, 'utf8');
      const config = this.parseEnvContent(envContent);

      res.json({
        success: true,
        config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private handleUpdateConfig(req: Request, res: Response): void {
    try {
      const { config } = req.body;

      if (!config || typeof config !== 'object') {
        res.status(400).json({ error: 'Configuration object is required' });
        return;
      }

      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';

      // Read existing .env file if it exists
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update the configuration
      const updatedContent = this.updateEnvContent(envContent, config);

      // Write back to .env file
      fs.writeFileSync(envPath, updatedContent, 'utf8');

      res.json({
        success: true,
        message: 'Configuration updated successfully. Restart the bot to apply changes.',
        updatedConfig: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: `Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private parseEnvContent(content: string): Record<string, string> {
    const config: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          config[key.trim()] = valueParts.join('=').trim();
        }
      }
    }

    return config;
  }

  private updateEnvContent(existingContent: string, updates: Record<string, any>): string {
    const lines = existingContent.split('\n');
    const updatedLines: string[] = [];
    const processedKeys = new Set<string>();

    // Process existing lines
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        // Keep comments and empty lines
        updatedLines.push(line);
        continue;
      }

      const [key] = trimmed.split('=');
      const cleanKey = key?.trim();

      if (cleanKey && updates.hasOwnProperty(cleanKey)) {
        // Update existing key
        if (updates[cleanKey] !== undefined && updates[cleanKey] !== 'DISABLED') {
          updatedLines.push(`${cleanKey}=${updates[cleanKey]}`);
        } else {
          // Comment out disabled keys
          updatedLines.push(`# ${cleanKey}=${updates[cleanKey] === 'DISABLED' ? 'DISABLED' : ''}`);
        }
        processedKeys.add(cleanKey);
      } else {
        // Keep unchanged lines
        updatedLines.push(line);
      }
    }

    // Add new keys that weren't in the original file
    for (const [key, value] of Object.entries(updates)) {
      if (!processedKeys.has(key) && value !== undefined && value !== 'DISABLED') {
        updatedLines.push(`${key}=${value}`);
      }
    }

    return updatedLines.join('\n');
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const errors: string[] = [];
    
    // Check components
    const components = {
      scheduler: this.scheduler.isSchedulerRunning(),
      walletManager: this.walletManager.getAllWallets().length > 0,
      dexManager: true, // Would need actual health check
      rpcConnection: true // Would need actual health check
    };

    // Determine overall status
    const healthyComponents = Object.values(components).filter(Boolean).length;
    const totalComponents = Object.keys(components).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyComponents === totalComponents) {
      status = 'healthy';
    } else if (healthyComponents >= totalComponents / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime(),
      components,
      ...(errors.length > 0 && { errors })
    };
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`REST API server listening on port ${this.port}`);
          console.log(`Health check: http://localhost:${this.port}/healthz`);
          console.log(`Metrics: http://localhost:${this.port}/metrics`);
          resolve();
        });

        this.server.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('REST API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
