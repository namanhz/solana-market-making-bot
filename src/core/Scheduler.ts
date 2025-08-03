import { EventEmitter } from 'events';
import * as cron from 'node-cron';

export type TradeType = 'buy' | 'sell';

export interface SchedulingConfig {
  mode: 'fixed' | 'random';
  cron?: string;
  randomInterval?: {
    min: number;
    max: number;
  };
  buyInterval?: {
    min: number;
    max: number;
  };
  sellInterval?: {
    min: number;
    max: number;
  };
}

export interface TradeTick {
  type: TradeType;
  timestamp: Date;
}

export class Scheduler extends EventEmitter {
  private config: SchedulingConfig;
  private cronJob: cron.ScheduledTask | null = null;
  private randomTimeout: NodeJS.Timeout | null = null;
  private buyTimeout: NodeJS.Timeout | null = null;
  private sellTimeout: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: SchedulingConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting scheduler in ${this.config.mode} mode`);

    if (this.config.mode === 'fixed') {
      this.startFixedSchedule();
    } else {
      // Check if we have separate buy/sell intervals
      if (this.config.buyInterval && this.config.sellInterval) {
        this.startSeparateRandomSchedule();
      } else {
        this.startRandomSchedule();
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('Stopping scheduler');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    if (this.randomTimeout) {
      clearTimeout(this.randomTimeout);
      this.randomTimeout = null;
    }

    if (this.buyTimeout) {
      clearTimeout(this.buyTimeout);
      this.buyTimeout = null;
    }

    if (this.sellTimeout) {
      clearTimeout(this.sellTimeout);
      this.sellTimeout = null;
    }
  }

  /**
   * Start fixed schedule using cron
   */
  private startFixedSchedule(): void {
    if (!this.config.cron) {
      throw new Error('Cron expression required for fixed mode');
    }

    console.log(`Starting fixed schedule with cron: ${this.config.cron}`);

    this.cronJob = cron.schedule(this.config.cron, () => {
      this.emitTradeTick();
    }, {
      scheduled: false
    });

    this.cronJob.start();
  }

  /**
   * Start random schedule
   */
  private startRandomSchedule(): void {
    if (!this.config.randomInterval) {
      throw new Error('Random interval configuration required for random mode');
    }

    this.scheduleNextRandomTick();
  }

  /**
   * Start separate random schedule for buy and sell
   */
  private startSeparateRandomSchedule(): void {
    if (!this.config.buyInterval || !this.config.sellInterval) {
      throw new Error('Buy and sell interval configuration required for separate scheduling');
    }

    console.log('Using separate buy/sell intervals');
    this.scheduleNextBuyTick();
    this.scheduleNextSellTick();
  }

  /**
   * Schedule the next random tick
   */
  private scheduleNextRandomTick(): void {
    if (!this.isRunning || !this.config.randomInterval) {
      return;
    }

    const { min, max } = this.config.randomInterval;
    const delay = Math.random() * (max - min) + min;
    const delayMs = delay * 1000; // Convert to milliseconds

    console.log(`Next trade scheduled in ${delay.toFixed(1)} seconds`);

    this.randomTimeout = setTimeout(() => {
      this.emitTradeTick();
      this.scheduleNextRandomTick(); // Schedule the next one
    }, delayMs);
  }

  /**
   * Schedule the next buy tick
   */
  private scheduleNextBuyTick(): void {
    if (!this.isRunning || !this.config.buyInterval) {
      return;
    }

    const { min, max } = this.config.buyInterval;
    const delay = Math.random() * (max - min) + min;
    const delayMs = delay * 1000; // Convert to milliseconds

    console.log(`Next buy scheduled in ${delay.toFixed(1)} seconds`);

    this.buyTimeout = setTimeout(() => {
      this.emitBuyTick();
      this.scheduleNextBuyTick(); // Schedule the next one
    }, delayMs);
  }

  /**
   * Schedule the next sell tick
   */
  private scheduleNextSellTick(): void {
    if (!this.isRunning || !this.config.sellInterval) {
      return;
    }

    const { min, max } = this.config.sellInterval;
    const delay = Math.random() * (max - min) + min;
    const delayMs = delay * 1000; // Convert to milliseconds

    console.log(`Next sell scheduled in ${delay.toFixed(1)} seconds`);

    this.sellTimeout = setTimeout(() => {
      this.emitSellTick();
      this.scheduleNextSellTick(); // Schedule the next one
    }, delayMs);
  }

  /**
   * Emit a trade tick event
   */
  private emitTradeTick(): void {
    if (!this.isRunning) {
      return;
    }

    // Randomly choose between buy and sell
    // In a real implementation, this might be based on strategy
    const type: TradeType = Math.random() < 0.5 ? 'buy' : 'sell';
    
    const tradeTick: TradeTick = {
      type,
      timestamp: new Date()
    };

    console.log(`Emitting trade tick: ${type} at ${tradeTick.timestamp.toISOString()}`);
    this.emit('tradeTick', tradeTick);
  }

  /**
   * Manually trigger a trade tick
   */
  triggerTick(type: TradeType): void {
    const tradeTick: TradeTick = {
      type,
      timestamp: new Date()
    };

    console.log(`Manual trade tick: ${type} at ${tradeTick.timestamp.toISOString()}`);
    this.emit('tradeTick', tradeTick);
  }

  /**
   * Emit a buy tick
   */
  private emitBuyTick(): void {
    if (!this.isRunning) {
      return;
    }

    const tradeTick: TradeTick = {
      type: 'buy',
      timestamp: new Date()
    };

    console.log(`Emitting buy tick at ${tradeTick.timestamp.toISOString()}`);
    this.emit('tradeTick', tradeTick);
  }

  /**
   * Emit a sell tick
   */
  private emitSellTick(): void {
    if (!this.isRunning) {
      return;
    }

    const tradeTick: TradeTick = {
      type: 'sell',
      timestamp: new Date()
    };

    console.log(`Emitting sell tick at ${tradeTick.timestamp.toISOString()}`);
    this.emit('tradeTick', tradeTick);
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: SchedulingConfig): void {
    console.log('Updating scheduler configuration');
    
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.config = config;

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SchedulingConfig {
    return { ...this.config };
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get next scheduled time (for fixed mode)
   */
  getNextScheduledTime(): Date | null {
    if (this.config.mode !== 'fixed' || !this.cronJob) {
      return null;
    }

    // This is a simplified implementation
    // In a real scenario, you'd parse the cron expression to get the next execution time
    return new Date(Date.now() + 60000); // Placeholder: 1 minute from now
  }

  /**
   * Get time until next random tick
   */
  getTimeUntilNextTick(): number | null {
    if (this.config.mode !== 'random' || !this.randomTimeout) {
      return null;
    }

    // This would require tracking when the timeout was set
    // For now, return null as we don't track this
    return null;
  }
}
