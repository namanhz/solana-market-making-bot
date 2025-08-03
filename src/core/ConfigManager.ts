import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PublicKey } from '@solana/web3.js';

export interface RpcConfig {
  endpoints: string[];
  timeout: number;
  retries: number;
}

export interface TokenConfig {
  mint: string;
  symbol?: string;
  decimals?: number;
}

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

export interface WalletConfig {
  keystoreDir: string;
  encryptionKey: string;
  minTradeAmount: number;
  maxSlippageBps: number;
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

export interface DexConfig {
  primary: 'letsbonk' | 'jupiter';
  fallback: 'letsbonk' | 'jupiter';
  liquidityThreshold: number;
  letsBonk?: {
    apiUrl: string;
  };
  jupiter?: {
    apiUrl: string;
    rateLimit: number;
  };
}

export interface MonitoringConfig {
  prometheus?: {
    enabled: boolean;
    port: number;
  };
  rest?: {
    enabled: boolean;
    port: number;
  };
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
  };
}

export interface SecurityConfig {
  memoryZeroing: boolean;
  keystoreEncryption: 'aes-256-gcm';
}

export interface SolscanConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface Config {
  rpc: RpcConfig;
  token: TokenConfig;
  scheduling: SchedulingConfig;
  wallets: WalletConfig;
  dex: DexConfig;
  solscan: SolscanConfig;
  monitoring?: MonitoringConfig;
  security?: SecurityConfig;
}

export class ConfigManager {
  private config: Config | null = null;
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  /**
   * Load and validate configuration from YAML file
   */
  async loadConfig(configPath: string = './config.yaml'): Promise<Config> {
    try {
      // Load YAML file
      const configFile = fs.readFileSync(configPath, 'utf8');
      const rawConfig = yaml.parse(configFile);

      // Load schema
      const schemaPath = path.join(process.cwd(), 'config.schema.json');
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

      // Validate against schema
      const validate = this.ajv.compile(schema);
      const valid = validate(rawConfig);

      if (!valid) {
        const errors = validate.errors?.map(err => 
          `${err.instancePath}: ${err.message}`
        ).join(', ');
        throw new Error(`Configuration validation failed: ${errors}`);
      }

      // Additional validation
      this.validateConfig(rawConfig);

      this.config = rawConfig as Config;
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Additional custom validation
   */
  private validateConfig(config: any): void {
    // Validate token mint address
    try {
      new PublicKey(config.token.mint);
    } catch {
      throw new Error('Invalid token mint address');
    }

    // Validate scheduling configuration
    if (config.scheduling.mode === 'random') {
      if (!config.scheduling.randomInterval) {
        throw new Error('Random interval configuration required for random mode');
      }
      if (config.scheduling.randomInterval.min >= config.scheduling.randomInterval.max) {
        throw new Error('Random interval min must be less than max');
      }
    }

    // Validate DEX configuration
    if (config.dex.primary === config.dex.fallback) {
      throw new Error('Primary and fallback DEX cannot be the same');
    }

    // Validate RPC endpoints
    for (const endpoint of config.rpc.endpoints) {
      try {
        new URL(endpoint);
      } catch {
        throw new Error(`Invalid RPC endpoint URL: ${endpoint}`);
      }
    }

    // Validate keystore directory exists or can be created
    if (!fs.existsSync(config.wallets.keystoreDir)) {
      try {
        fs.mkdirSync(config.wallets.keystoreDir, { recursive: true });
      } catch {
        throw new Error(`Cannot create keystore directory: ${config.wallets.keystoreDir}`);
      }
    }
  }

  /**
   * Get environment-specific overrides
   */
  getEnvironmentOverrides(): Partial<Config> {
    const overrides: Partial<Config> = {};

    // RPC endpoints from environment
    if (process.env['SOLANA_RPC_ENDPOINTS']) {
      try {
        const endpoints = JSON.parse(process.env['SOLANA_RPC_ENDPOINTS']);
        overrides.rpc = {
          endpoints,
          timeout: 30000,
          retries: 2
        };
      } catch {
        // Fallback to single endpoint
        overrides.rpc = {
          endpoints: [process.env['SOLANA_RPC_ENDPOINTS']],
          timeout: 30000,
          retries: 2
        };
      }
    }

    // Token mint from environment
    if (process.env['TARGET_TOKEN_MINT']) {
      overrides.token = {
        mint: process.env['TARGET_TOKEN_MINT']
      };
    }

    // Encryption key and trading parameters from environment
    if (process.env['ENCRYPTION_KEY']) {
      const walletOverrides: any = {
        keystoreDir: './keystore',
        encryptionKey: process.env['ENCRYPTION_KEY'],
        minTradeAmount: parseFloat(process.env['MIN_TRADE_AMOUNT_SOL'] || '0.001'),
        maxSlippageBps: parseInt(process.env['MAX_SLIPPAGE_BPS'] || '100')
      };

      // Buy Volume SOL Range
      if (process.env['BUY_VOLUME_SOL_MIN'] && process.env['BUY_VOLUME_SOL_MAX']) {
        walletOverrides.buyVolumeSol = {
          min: parseFloat(process.env['BUY_VOLUME_SOL_MIN']),
          max: parseFloat(process.env['BUY_VOLUME_SOL_MAX'])
        };
      }

      // Sell Volume Token Range
      if (process.env['SELL_VOLUME_TOKEN_MIN'] && process.env['SELL_VOLUME_TOKEN_MAX']) {
        walletOverrides.sellVolumeToken = {
          min: parseFloat(process.env['SELL_VOLUME_TOKEN_MIN']),
          max: parseFloat(process.env['SELL_VOLUME_TOKEN_MAX'])
        };
      }

      // Sell Volume SOL Value Range
      if (process.env['SELL_VOLUME_SOL_VALUE_MIN'] && process.env['SELL_VOLUME_SOL_VALUE_MAX']) {
        walletOverrides.sellVolumeSolValue = {
          min: parseFloat(process.env['SELL_VOLUME_SOL_VALUE_MIN']),
          max: parseFloat(process.env['SELL_VOLUME_SOL_VALUE_MAX'])
        };
      }

      // Max wallets configuration
      if (process.env['BUY_MAX_WALLETS']) {
        walletOverrides.buyMaxWallets = parseInt(process.env['BUY_MAX_WALLETS']);
      }

      if (process.env['SELL_MAX_WALLETS']) {
        walletOverrides.sellMaxWallets = parseInt(process.env['SELL_MAX_WALLETS']);
      }

      overrides.wallets = walletOverrides;
    }

    // Scheduling intervals from environment
    if (process.env['BUY_INTERVAL_MIN'] || process.env['SELL_INTERVAL_MIN']) {
      overrides.scheduling = {
        mode: 'random' as const,
        buyInterval: {
          min: parseInt(process.env['BUY_INTERVAL_MIN'] || '60'),
          max: parseInt(process.env['BUY_INTERVAL_MAX'] || '300')
        },
        sellInterval: {
          min: parseInt(process.env['SELL_INTERVAL_MIN'] || '120'),
          max: parseInt(process.env['SELL_INTERVAL_MAX'] || '600')
        }
      };
    }

    // Solscan configuration from environment
    if (process.env['SOLSCAN_API_KEY']) {
      overrides.solscan = {
        apiKey: process.env['SOLSCAN_API_KEY'],
        apiUrl: process.env['SOLSCAN_API_URL'] || 'https://pro-api.solscan.io/v2.0'
      };
    }

    return overrides;
  }

  /**
   * Merge configuration with environment overrides
   */
  async loadConfigWithOverrides(configPath?: string): Promise<Config> {
    const baseConfig = await this.loadConfig(configPath);
    const overrides = this.getEnvironmentOverrides();

    // Deep merge overrides
    this.config = this.deepMerge(baseConfig, overrides);
    return this.config!;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}
