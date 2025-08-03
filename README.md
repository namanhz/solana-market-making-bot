# 🤖 Solana Market-Making Bot

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3%2B-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

**A professional-grade, lightweight, and secure market-making bot for SPL tokens on Solana mainnet**

*Programmatically creates buy/sell volume for target tokens using multiple encrypted wallets and intelligent DEX routing*

</div>

---

## 🌟 **Key Highlights**

- 🔐 **Enterprise Security**: AES-256-GCM encryption, memory zeroing, secure key management
- 🚀 **High Performance**: Up to 60 swaps/minute with <3s latency per trade
- 📊 **Professional Monitoring**: Prometheus metrics, Grafana dashboards, REST API
- 🔄 **Intelligent Routing**: Primary/fallback DEX switching with liquidity analysis
- 🛡️ **Fault Tolerance**: RPC failover, retry logic, circuit breakers
- 🐳 **Production Ready**: Docker containerization with health checks and monitoring stack

---

## 🚀 **Core Features**

### 💼 **Trading Engine**
- **Multi-Wallet Architecture**: Unlimited encrypted wallets with configurable trading types (buy-only, sell-only, dual)
- **Proportional Volume Distribution**: Intelligent trade splitting across wallets using advanced algorithms
- **Smart Scheduling**: Fixed cron expressions or randomized intervals (30s-5min configurable)
- **Parallel Execution**: Concurrent trade processing with rate limiting and queue management

### 🔗 **DEX Integration**
- **Primary/Fallback Routing**: Let's Bonk primary with Jupiter fallback for maximum liquidity
- **Liquidity Analysis**: Automatic DEX selection based on configurable liquidity thresholds
- **Slippage Protection**: Configurable slippage limits with automatic adjustment
- **Rate Limiting**: Built-in API rate limiting for external services

### 📈 **Monitoring & Analytics**
- **Real-time Metrics**: 15+ Prometheus metrics for comprehensive performance tracking
- **REST API Dashboard**: 10+ endpoints for health checks, statistics, and control
- **Live Balance Monitoring**: 15-second wallet balance updates with WebSocket notifications
- **Trade History**: Complete audit trail with transaction IDs and performance metrics

### 🔒 **Security & Reliability**
- **Military-Grade Encryption**: AES-256-GCM with PBKDF2 key derivation (100k iterations)
- **Memory Safety**: Automatic zeroing of sensitive data after use
- **Container Security**: Non-root execution, read-only filesystem, network isolation
- **Error Recovery**: Comprehensive error handling with automatic retries and circuit breakers

---

## 📋 **System Requirements**

### **Runtime Environment**
- **Node.js**: 20.0.0 or higher
- **TypeScript**: 5.3+ (for development)
- **Memory**: Minimum 512MB RAM (recommended 1GB+)
- **Storage**: 100MB+ for application, additional space for logs and cache

### **External Dependencies**
- **Solana RPC Access**: Helius, Alchemy, QuickNode, or custom endpoint
- **Network**: Stable internet connection with low latency to Solana mainnet
- **Wallets**: Pre-funded Solana wallets with encrypted keyfiles
- **Target Token**: Valid SPL token mint address for trading

### **Optional Components**
- **Docker**: For containerized deployment
- **Prometheus**: For metrics collection (included in Docker setup)
- **Grafana**: For visualization dashboards (included in Docker setup)

---

## 🛠️ **Installation & Setup**

### **Method 1: Quick Start (Recommended)**

```bash
# 1. Clone the repository
git clone https://github.com/your-org/solana-market-making-bot.git
cd solana-market-making-bot

# 2. Install dependencies
npm install

# 3. Set up configuration files
cp config.example.yaml config.yaml
cp .env.example .env

# 4. Generate encrypted wallet keyfiles
npm run generate-keyfile

# 5. Configure your settings
# Edit config.yaml and .env with your specific configuration

# 6. Build the project
npm run build

# 7. Run comprehensive tests
npm test

# 8. Start the bot
npm start
```

### **Method 2: Docker Deployment (Production)**

```bash
# 1. Clone and configure
git clone https://github.com/your-org/solana-market-making-bot.git
cd solana-market-making-bot

# 2. Set up configuration
cp config.example.yaml config.yaml
cp .env.example .env
# Edit configuration files

# 3. Create keystore directory and add encrypted wallets
mkdir -p keystore
# Add your encrypted wallet files to keystore/

# 4. Deploy with full monitoring stack
docker-compose up -d

# 5. Verify deployment
docker-compose logs -f solana-mm-bot

# 6. Access monitoring dashboards
# REST API: http://localhost:3000
# Prometheus: http://localhost:9091
# Grafana: http://localhost:3001 (admin/admin123)
```

### **Method 3: Development Setup**

```bash
# 1. Clone and install
git clone https://github.com/your-org/solana-market-making-bot.git
cd solana-market-making-bot
npm install

# 2. Set up development environment
cp config.example.yaml config.yaml
cp .env.example .env

# 3. Run in development mode with hot reload
npm run dev

# 4. Run tests in watch mode
npm run test:watch

# 5. Lint and format code
npm run lint:fix
```

---

## ⚙️ **Configuration Guide**

### **Environment Variables (.env)**

Create a `.env` file in the project root with the following configuration:

```bash
# ============================================================================
# SOLANA RPC CONFIGURATION
# ============================================================================
# Primary RPC endpoints (supports multiple for failover)
SOLANA_RPC_ENDPOINTS=["https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY","https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"]
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# ============================================================================
# DEX API CONFIGURATION
# ============================================================================
JUPITER_API_URL=https://quote-api.jup.ag/v6
LETS_BONK_API_URL=https://api.letsbonk.com

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================
# 32-byte encryption key for wallet keyfiles (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_32_byte_encryption_key_here_replace_this_value
# Target SPL token mint address for trading
TARGET_TOKEN_MINT=So11111111111111111111111111111111111111112

# ============================================================================
# TRADING PARAMETERS
# ============================================================================
# Minimum trade amount in SOL (0.001 = 1000 lamports)
MIN_TRADE_AMOUNT_SOL=0.001
# Maximum slippage in basis points (100 = 1%)
MAX_SLIPPAGE_BPS=100
# Minimum liquidity threshold in USD for DEX selection
LIQUIDITY_THRESHOLD=1000

# ============================================================================
# MONITORING & LOGGING
# ============================================================================
PROMETHEUS_PORT=9090
REST_API_PORT=3000
LOG_LEVEL=info  # Options: error, warn, info, debug

# ============================================================================
# ADVANCED SETTINGS (Optional)
# ============================================================================
# Maximum concurrent trades
MAX_CONCURRENT_TRADES=10
# Trade percentage of available balance
TRADE_PERCENTAGE=0.1
# Node environment
NODE_ENV=production
```

### **Main Configuration (config.yaml)**

The primary configuration file that controls all bot behavior:

```yaml
# ============================================================================
# SOLANA RPC CONFIGURATION
# ============================================================================
rpc:
  endpoints:
    - "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
    - "https://solana-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY"
    - "https://rpc.ankr.com/solana"  # Backup endpoint
  timeout: 30000  # 30 seconds
  retries: 2      # Number of retry attempts

# ============================================================================
# TARGET TOKEN CONFIGURATION
# ============================================================================
token:
  mint: "So11111111111111111111111111111111111111112"  # SOL mint (example)
  symbol: "SOL"
  decimals: 9

# ============================================================================
# TRADING SCHEDULE CONFIGURATION
# ============================================================================
scheduling:
  mode: "random"  # Options: "random" or "fixed"

  # Random interval configuration (recommended for natural trading patterns)
  randomInterval:
    min: 30     # Minimum seconds between trades
    max: 300    # Maximum seconds between trades (5 minutes)

  # Fixed schedule configuration (uncomment to use)
  # cron: "0 */5 * * * *"  # Every 5 minutes (cron expression)

# ============================================================================
# WALLET CONFIGURATION
# ============================================================================
wallets:
  keystoreDir: "./keystore"
  encryptionKey: "CHANGE_THIS_TO_YOUR_32_BYTE_ENCRYPTION_KEY"
  minTradeAmount: 0.001      # Minimum 0.001 SOL per trade
  maxSlippageBps: 100        # Maximum 1% slippage (100 basis points)

  # Volume configuration (optional - for advanced users)
  # buyVolumeSol: 1.0         # Total SOL volume for buy trades
  # sellVolumeToken: 1000     # Total token volume for sell trades
  # sellVolumeSolValue: 1.0   # SOL value equivalent for sell trades
  # buyMaxWallets: 10         # Maximum wallets for buy trades
  # sellMaxWallets: 10        # Maximum wallets for sell trades

# ============================================================================
# DEX INTEGRATION CONFIGURATION
# ============================================================================
dex:
  primary: "letsbonk"         # Primary DEX: "letsbonk" or "jupiter"
  fallback: "jupiter"         # Fallback DEX: "letsbonk" or "jupiter"
  liquidityThreshold: 1000    # Minimum liquidity in USD to use primary DEX

  letsBonk:
    apiUrl: "https://api.letsbonk.com"

  jupiter:
    apiUrl: "https://quote-api.jup.ag/v6"
    rateLimit: 10  # Requests per second

# ============================================================================
# MONITORING & OBSERVABILITY
# ============================================================================
monitoring:
  prometheus:
    enabled: true
    port: 9090

  rest:
    enabled: true
    port: 3000

  logging:
    level: "info"  # Options: "error", "warn", "info", "debug"
    file: "./logs/mm-bot.log"

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================
security:
  memoryZeroing: true
  keystoreEncryption: "aes-256-gcm"

# ============================================================================
# ADVANCED CONFIGURATION (Optional)
# ============================================================================
advanced:
  # Performance tuning
  maxConcurrentTrades: 10           # Maximum number of concurrent trades
  tradePercentage: 0.1              # Percentage of available balance to trade (10%)
  maxPercentagePerWallet: 0.3       # Maximum 30% of total volume per wallet
  balanceUpdateInterval: 15000      # Balance update interval in milliseconds (15 seconds)

  # Error handling
  maxRetries: 3                     # Maximum retry attempts for failed operations
  retryDelay: 1000                  # Delay between retries in milliseconds (1 second)

  # Circuit breaker settings
  circuitBreakerThreshold: 5        # Number of failures before circuit opens
  circuitBreakerTimeout: 60000      # Circuit breaker timeout in milliseconds (1 minute)
```

---

## 🔐 **Wallet Management & Security**

### **Creating Encrypted Keyfiles**

The bot uses military-grade AES-256-GCM encryption to secure wallet private keys. Follow these steps to set up your wallets:

#### **Method 1: Automated Keyfile Generation (Recommended)**

```bash
# Create keystore directory
mkdir -p keystore

# Generate a new encrypted wallet keyfile
npm run generate-keyfile

# Follow the interactive prompts:
# 1. Choose wallet type (buy-only, sell-only, dual)
# 2. Enter your encryption key (32 bytes)
# 3. Optionally import existing private key or generate new one

# Verify the generated keyfile
npm run verify-keyfile
```

#### **Method 2: Manual Keyfile Creation**

Create JSON files in the `keystore/` directory with this structure:

```json
{
  "publicKey": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "encryptedPrivateKey": "encrypted_base64_private_key_here",
  "salt": "random_salt_for_key_derivation",
  "iv": "initialization_vector_for_encryption",
  "type": "dual",
  "version": "1.0",
  "algorithm": "aes-256-gcm",
  "keyDerivation": {
    "algorithm": "pbkdf2",
    "iterations": 100000,
    "hash": "sha256"
  }
}
```

#### **Method 3: Import Existing Wallets**

```bash
# Use the keyfile generator to import existing wallets
npm run generate-keyfile

# Select "Import existing wallet"
# Provide your private key (base58 format)
# Choose wallet type and encryption settings
```

### **Wallet Types & Trading Strategies**

The bot supports three distinct wallet types for flexible trading strategies:

#### **🟢 Buy-Only Wallets**
- **Purpose**: Execute only buy trades (SOL → Token)
- **Requirements**: Must maintain SOL balance
- **Use Case**: Accumulation strategies, volume generation
- **Configuration**: `"type": "buy-only"`

```json
{
  "type": "buy-only",
  "publicKey": "BuyWallet1...",
  "encryptedPrivateKey": "...",
  // ... other fields
}
```

#### **🔴 Sell-Only Wallets**
- **Purpose**: Execute only sell trades (Token → SOL)
- **Requirements**: Must maintain target token balance
- **Use Case**: Distribution strategies, profit taking
- **Configuration**: `"type": "sell-only"`

```json
{
  "type": "sell-only",
  "publicKey": "SellWallet1...",
  "encryptedPrivateKey": "...",
  // ... other fields
}
```

#### **🟡 Dual-Purpose Wallets**
- **Purpose**: Execute both buy and sell trades
- **Requirements**: Maintain both SOL and token balances
- **Use Case**: Market making, balanced trading
- **Configuration**: `"type": "dual"`

```json
{
  "type": "dual",
  "publicKey": "DualWallet1...",
  "encryptedPrivateKey": "...",
  // ... other fields
}
```

### **Security Best Practices**

#### **🔐 Encryption Key Management**
```bash
# Generate a secure 32-byte encryption key
openssl rand -hex 32

# Store securely (never commit to version control)
echo "ENCRYPTION_KEY=your_generated_key_here" >> .env

# Use different keys for different environments
# Development: ENCRYPTION_KEY_DEV
# Production: ENCRYPTION_KEY_PROD
```

#### **🛡️ Wallet Security Checklist**
- ✅ Use unique encryption keys for each environment
- ✅ Store keyfiles in secure, backed-up locations
- ✅ Never commit encryption keys to version control
- ✅ Regularly rotate encryption keys (monthly recommended)
- ✅ Use hardware security modules (HSM) for production
- ✅ Implement proper access controls on keystore directory
- ✅ Monitor wallet balances and transactions regularly

#### **🔄 Key Rotation Process**
```bash
# 1. Generate new encryption key
NEW_KEY=$(openssl rand -hex 32)

# 2. Re-encrypt all keyfiles with new key
# (Use the keyfile generator with import function)

# 3. Update configuration
echo "ENCRYPTION_KEY=$NEW_KEY" > .env.new

# 4. Test with new configuration
npm run verify-keyfile

# 5. Deploy new configuration
mv .env.new .env
```

---

## 📊 **Monitoring & Analytics**

### **REST API Endpoints**

The bot provides a comprehensive REST API for monitoring, control, and analytics:

#### **Health & Status Endpoints**
```bash
# Basic health checks
GET /healthz                    # Simple health check (200 OK)
GET /health                     # Detailed health status
GET /api/health                 # Component-level health status

# System information
GET /api/system-stats           # System performance metrics
GET /api/wallet-status          # All wallet balances and status
GET /api/trading-stats          # Trading performance statistics
```

#### **Metrics & Analytics**
```bash
# Prometheus metrics (industry standard format)
GET /metrics                    # All metrics in Prometheus format

# Trading analytics
GET /api/trade-history          # Historical trade data
GET /api/session-history        # Trading session summaries
GET /api/performance-stats      # Performance analytics

# Real-time data
GET /api/live-balances          # Live wallet balance updates
GET /api/current-trades         # Active/pending trades
```

#### **Control & Management**
```bash
# Scheduler control
POST /api/scheduler/start       # Start the trading scheduler
POST /api/scheduler/stop        # Stop the trading scheduler
GET /api/scheduler/status       # Get scheduler status

# Manual trading
POST /api/trigger-trade         # Manually trigger a trade
POST /api/trigger-buy           # Manually trigger buy trades
POST /api/trigger-sell          # Manually trigger sell trades

# Configuration
GET /api/config                 # Get current configuration
POST /api/config/reload         # Reload configuration from file
```

### **Prometheus Metrics**

The bot exposes 15+ custom metrics for comprehensive monitoring:

#### **Trading Performance Metrics**
```prometheus
# Transaction counters
mm_tx_success_total{type="buy|sell", dex="jupiter|letsbonk"}     # Successful transactions
mm_tx_fail_total{type="buy|sell", dex="jupiter|letsbonk"}        # Failed transactions
mm_tx_total{type="buy|sell", dex="jupiter|letsbonk"}             # Total transactions

# Volume metrics
mm_volume_sol_total{type="buy|sell"}                             # Total SOL volume traded
mm_volume_token_total{type="buy|sell"}                           # Total token volume traded
mm_trade_count_total{type="buy|sell"}                            # Total number of trades
```

#### **Performance Metrics**
```prometheus
# Timing metrics (histograms)
mm_trade_execution_ms{type="buy|sell", dex="jupiter|letsbonk"}   # Trade execution time
mm_sched_delay_ms                                                # Scheduling delay
mm_rpc_response_ms{endpoint="primary|fallback"}                 # RPC response time
mm_dex_response_ms{dex="jupiter|letsbonk"}                       # DEX API response time

# Slippage tracking
mm_slippage_bps{type="buy|sell", dex="jupiter|letsbonk"}         # Actual slippage in basis points
mm_slippage_exceeded_total{type="buy|sell"}                     # Slippage exceeded events
```

#### **System Health Metrics**
```prometheus
# Wallet metrics
mm_wallet_sol{wallet="address", type="buy|sell|dual"}           # Per-wallet SOL balance
mm_wallet_token{wallet="address", type="buy|sell|dual"}         # Per-wallet token balance
mm_wallet_healthy{wallet="address"}                             # Wallet health status (1=healthy, 0=unhealthy)

# System metrics
mm_uptime_seconds                                                # Bot uptime in seconds
mm_memory_usage_bytes                                            # Memory usage
mm_cpu_usage_percent                                             # CPU usage percentage
```

### **Dashboard Access**

#### **Web Interfaces**
- **🌐 REST API Dashboard**: http://localhost:3000
  - Real-time trading statistics
  - Wallet balance monitoring
  - System health overview
  - Manual trade controls

- **📈 Prometheus Metrics**: http://localhost:9091 (Docker deployment)
  - Raw metrics data
  - Query interface
  - Alerting rules

- **📊 Grafana Dashboards**: http://localhost:3001 (Docker deployment)
  - Username: `admin`
  - Password: `admin123`
  - Pre-configured dashboards for trading analytics

#### **API Usage Examples**

```bash
# Check overall system health
curl -s http://localhost:3000/api/health | jq

# Get trading statistics
curl -s http://localhost:3000/api/trading-stats | jq

# Monitor wallet balances
curl -s http://localhost:3000/api/wallet-status | jq

# Manually trigger a buy trade
curl -X POST http://localhost:3000/api/trigger-buy \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.1, "wallets": 3}'

# Get Prometheus metrics
curl -s http://localhost:3000/metrics | grep mm_tx_success_total
```

---

## 🔧 **Development & Testing**

### **Development Environment Setup**

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/solana-market-making-bot.git
cd solana-market-making-bot
npm install

# 2. Set up development configuration
cp config.example.yaml config.dev.yaml
cp .env.example .env.dev

# 3. Install development tools
npm install -g typescript ts-node nodemon

# 4. Set up Git hooks (optional)
npm run prepare
```

### **Running Tests**

The project includes comprehensive test coverage with Jest:

```bash
# Run all tests
npm test

# Run tests with detailed coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch

# Run specific test files
npm test -- --testPathPattern=TradeOrchestrator

# Run tests with verbose output
npm test -- --verbose

# Generate coverage report in HTML format
npm run test:coverage -- --coverageReporters=html
open coverage/lcov-report/index.html
```

### **Code Quality & Linting**

```bash
# Lint TypeScript code
npm run lint

# Automatically fix linting issues
npm run lint:fix

# Check TypeScript compilation
npm run build

# Format code with Prettier (if configured)
npm run format

# Run full quality check
npm run lint && npm run build && npm test
```

### **Development Mode**

```bash
# Run in development mode with hot reload
npm run dev

# Run with specific configuration
npm run dev -- --config config.dev.yaml

# Run with debug logging
LOG_LEVEL=debug npm run dev

# Run with dry-run mode (no real trades)
DRY_RUN=true npm run dev
```

### **Debugging**

```bash
# Run with Node.js debugger
node --inspect-brk dist/index.js

# Debug with VS Code
# Add to .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Debug Bot",
  "program": "${workspaceFolder}/dist/index.js",
  "env": {
    "NODE_ENV": "development",
    "LOG_LEVEL": "debug"
  }
}

# Debug tests
npm test -- --inspect-brk
```

### **Performance Profiling**

```bash
# Profile memory usage
node --inspect --heap-prof dist/index.js

# Profile CPU usage
node --inspect --cpu-prof dist/index.js

# Monitor with clinic.js
npm install -g clinic
clinic doctor -- node dist/index.js
```

---

## 🚨 **Error Handling & Resilience**

The bot implements enterprise-grade error handling and resilience patterns:

### **Network & RPC Resilience**
- **🔄 Automatic Failover**: Seamless switching between multiple RPC endpoints
- **⏰ Exponential Backoff**: Intelligent retry logic with increasing delays
- **🛡️ Circuit Breakers**: Automatic protection against cascading failures
- **📊 Health Monitoring**: Continuous endpoint health assessment

```typescript
// Example RPC failover configuration
rpc: {
  endpoints: [
    "https://mainnet.helius-rpc.com/?api-key=PRIMARY",
    "https://solana-mainnet.g.alchemy.com/v2/BACKUP",
    "https://rpc.ankr.com/solana"  // Public fallback
  ],
  timeout: 30000,
  retries: 2
}
```

### **DEX Integration Resilience**
- **🔀 Primary/Fallback Routing**: Let's Bonk primary with Jupiter fallback
- **💧 Liquidity Analysis**: Automatic DEX selection based on liquidity thresholds
- **🎯 Slippage Protection**: Configurable limits with automatic adjustment
- **🔄 Rate Limiting**: Built-in protection against API rate limits

### **Trading Error Recovery**
- **💰 Insufficient Funds**: Graceful skipping with detailed logging
- **📈 Slippage Exceeded**: Automatic retry with increased tolerance
- **⚡ Transaction Failures**: Comprehensive retry logic with backoff
- **🔍 Balance Validation**: Pre-trade balance verification

### **System-Level Resilience**
- **🧠 Memory Management**: Automatic cleanup and garbage collection
- **📝 Structured Logging**: Comprehensive error tracking and analysis
- **🔔 Alert Integration**: Ready for external monitoring systems
- **🔄 Graceful Shutdown**: Clean resource cleanup on termination

---

## 🔒 **Security Architecture**

### **Cryptographic Security**
- **🔐 AES-256-GCM Encryption**: Military-grade encryption for private keys
- **🔑 PBKDF2 Key Derivation**: 100,000 iterations with unique salts
- **🧹 Memory Zeroing**: Sensitive data cleared from memory after use
- **🔄 Key Rotation**: Support for regular encryption key updates

### **Container Security**
- **👤 Non-root Execution**: Docker containers run as unprivileged user
- **📁 Read-only Filesystem**: Minimal write permissions
- **🌐 Network Isolation**: Outbound-only connections
- **🔍 Security Scanning**: Regular vulnerability assessments

### **Operational Security**
- **📊 Audit Logging**: Complete transaction and access logs
- **🔐 Secrets Management**: Environment-based secret injection
- **🛡️ Input Validation**: Comprehensive parameter validation
- **🚫 Privilege Separation**: Minimal required permissions

---

## 📈 **Performance Characteristics**

### **Throughput & Latency**
- **⚡ High Throughput**: Up to 60 swaps per minute
- **🚀 Low Latency**: <3 seconds end-to-end per swap
- **🎯 High Reliability**: ≥99% success rate with retries
- **💾 Resource Efficient**: <500MB RAM, <20% CPU usage

### **Scalability Metrics**
```
Concurrent Trades:     10-50 (configurable)
Wallet Support:        Unlimited
RPC Connections:       Multiple with failover
API Rate Limits:       Intelligent throttling
Memory Footprint:      <500MB typical
CPU Usage:            <20% on modern hardware
Network Bandwidth:     <1MB/hour typical
```

### **Performance Optimization**
- **🔄 Connection Pooling**: Efficient RPC connection management
- **📊 Batch Processing**: Optimized transaction batching
- **💾 Intelligent Caching**: Balance and metadata caching
- **⚡ Parallel Execution**: Concurrent trade processing

---

## 🐳 **Docker & Container Deployment**

### **Production-Ready Containerization**

The bot includes a complete Docker setup optimized for production deployment:

```yaml
# docker-compose.yml features:
services:
  solana-mm-bot:
    # Multi-stage build for minimal image size
    build:
      context: .
      dockerfile: Dockerfile

    # Security hardening
    user: "1001:1001"  # Non-root user
    read_only: true    # Read-only filesystem

    # Health monitoring
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

    # Resource limits
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

### **Monitoring Stack Integration**

```yaml
# Complete monitoring stack included:
prometheus:          # Metrics collection
  image: prom/prometheus:latest
  ports: ["9091:9090"]

grafana:            # Visualization dashboards
  image: grafana/grafana:latest
  ports: ["3001:3000"]
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin123

# Pre-configured dashboards for:
# - Trading performance metrics
# - System health monitoring
# - Wallet balance tracking
# - Error rate analysis
```

### **Container Health Checks**

The container includes comprehensive health monitoring:

- **🏥 HTTP Endpoint Monitoring**: Regular health check requests
- **🔍 Component Status Validation**: Individual service health verification
- **🔄 Automatic Restart**: Container restart on health check failures
- **📊 Metrics Integration**: Health status exposed via Prometheus metrics

---

## 🔄 **Operational Procedures**

### **Starting the Bot**

#### **Standard Deployment**
```bash
# Basic startup
npm start

# With custom configuration file
npm start -- --config custom-config.yaml

# With environment-specific settings
NODE_ENV=production npm start

# With debug logging
LOG_LEVEL=debug npm start

# Dry-run mode (no real trades)
DRY_RUN=true npm start
```

#### **Docker Deployment (Recommended for Production)**
```bash
# Start complete stack with monitoring
docker-compose up -d

# Start only the trading bot
docker-compose up -d solana-mm-bot

# View real-time logs
docker-compose logs -f solana-mm-bot

# Start with custom configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### **Advanced Startup Options**
```bash
# Start with specific wallet subset
WALLET_FILTER="buy-only" npm start

# Start with reduced trade frequency
TRADE_INTERVAL_MIN=300 npm start

# Start with custom RPC endpoint
SOLANA_RPC_URL="https://your-custom-rpc.com" npm start
```

### **Monitoring & Health Checks**

#### **Health Verification**
```bash
# Basic health check
curl http://localhost:3000/healthz

# Detailed health status
curl -s http://localhost:3000/api/health | jq

# Component-level health
curl -s http://localhost:3000/api/health | jq '.components'

# System performance metrics
curl -s http://localhost:3000/api/system-stats | jq
```

#### **Trading Performance Monitoring**
```bash
# Current trading statistics
curl -s http://localhost:3000/api/trading-stats | jq

# Wallet balance overview
curl -s http://localhost:3000/api/wallet-status | jq

# Recent trade history
curl -s http://localhost:3000/api/trade-history?limit=10 | jq

# Performance metrics (Prometheus format)
curl http://localhost:3000/metrics | grep mm_tx_success_total
```

#### **Real-time Monitoring**
```bash
# Watch trading activity in real-time
watch -n 5 'curl -s http://localhost:3000/api/trading-stats | jq ".summary"'

# Monitor wallet balances
watch -n 10 'curl -s http://localhost:3000/api/wallet-status | jq ".totalBalances"'

# Track error rates
watch -n 30 'curl -s http://localhost:3000/metrics | grep mm_tx_fail_total'
```

### **Control Operations**

#### **Scheduler Management**
```bash
# Stop trading scheduler
curl -X POST http://localhost:3000/api/scheduler/stop

# Start trading scheduler
curl -X POST http://localhost:3000/api/scheduler/start

# Check scheduler status
curl -s http://localhost:3000/api/scheduler/status | jq

# Trigger manual trade
curl -X POST http://localhost:3000/api/trigger-trade \
  -H "Content-Type: application/json" \
  -d '{"type": "buy", "amount": 0.1}'
```

### **Emergency Procedures**

#### **Graceful Shutdown**
```bash
# Docker deployment
docker-compose stop

# Direct process (sends SIGTERM)
pkill -TERM -f "node dist/index.js"

# Wait for graceful shutdown (up to 30 seconds)
timeout 30 docker-compose stop || docker-compose kill
```

#### **Emergency Stop (Force)**
```bash
# Force stop Docker containers
docker-compose kill

# Force stop process
pkill -KILL -f "node dist/index.js"

# Stop all related processes
pkill -f "solana-market-making-bot"
```

#### **Emergency Recovery**
```bash
# 1. Stop all processes
docker-compose down

# 2. Check system state
curl http://localhost:3000/api/health || echo "Bot stopped"

# 3. Verify wallet balances externally
# (Use Solana CLI or block explorer)

# 4. Restart with health checks
docker-compose up -d
sleep 30
curl http://localhost:3000/healthz
```

---

## 📝 **Logging & Observability**

### **Structured Logging**

The bot implements comprehensive structured logging with multiple levels and outputs:

#### **Log Levels & Content**
```typescript
// ERROR: Critical failures requiring immediate attention
{
  "level": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Trade execution failed",
  "error": "Insufficient SOL balance",
  "wallet": "9WzDXwBbmkg8...",
  "tradeId": "trade_123",
  "amount": 0.1
}

// WARN: Important events that may require attention
{
  "level": "warn",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "High slippage detected",
  "slippage": 150,  // basis points
  "threshold": 100,
  "dex": "jupiter"
}

// INFO: Normal operational events
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Trade completed successfully",
  "type": "buy",
  "amount": 0.1,
  "txId": "5KJp7...",
  "wallet": "9WzDXwBbmkg8..."
}

// DEBUG: Detailed diagnostic information
{
  "level": "debug",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "RPC request",
  "method": "getBalance",
  "endpoint": "https://api.mainnet-beta.solana.com",
  "duration": 150
}
```

#### **Log Categories**
- **🔄 Trade Execution**: Buy/sell operations, transaction details
- **💰 Balance Updates**: Wallet balance changes, monitoring events
- **🌐 Network Operations**: RPC calls, DEX API interactions
- **⚠️ Error Conditions**: Failures, retries, recovery attempts
- **📊 Performance Metrics**: Timing, throughput, resource usage
- **🔒 Security Events**: Authentication, encryption operations

### **Log Management**

#### **File Rotation**
```yaml
# Automatic log rotation configuration
logging:
  level: "info"
  file: "./logs/mm-bot.log"
  maxSize: "100MB"      # Rotate when file reaches 100MB
  maxFiles: 10          # Keep 10 historical files
  compress: true        # Compress rotated files
```

#### **Log Analysis Commands**
```bash
# View recent errors
tail -100 logs/mm-bot.log | grep '"level":"error"' | jq

# Monitor trade activity
tail -f logs/mm-bot.log | grep '"message":"Trade completed"' | jq

# Analyze performance
grep '"duration":' logs/mm-bot.log | jq '.duration' | sort -n

# Count error types
grep '"level":"error"' logs/mm-bot.log | jq -r '.error' | sort | uniq -c
```

---

## 🚀 **Advanced Configuration**

### **Trading Strategy Customization**

#### **Volume Distribution Algorithms**
```yaml
# Proportional distribution (default)
advanced:
  volumeDistribution: "proportional"

  # Custom distribution weights
  walletWeights:
    "wallet1": 0.3  # 30% of volume
    "wallet2": 0.5  # 50% of volume
    "wallet3": 0.2  # 20% of volume

# Random distribution
advanced:
  volumeDistribution: "random"
  randomSeed: 12345  # For reproducible randomness
```

#### **Risk Management**
```yaml
advanced:
  riskManagement:
    maxDailyVolume: 100.0        # Maximum SOL volume per day
    maxTradeSize: 5.0            # Maximum SOL per single trade
    maxSlippageRetries: 3        # Retries for high slippage
    cooldownPeriod: 300          # Seconds between failed trades

    # Circuit breaker settings
    circuitBreaker:
      errorThreshold: 10         # Errors before circuit opens
      timeWindow: 300           # Time window in seconds
      recoveryTime: 600         # Recovery time in seconds
```

### **Performance Tuning**

#### **Connection Optimization**
```yaml
rpc:
  connectionPool:
    maxConnections: 10
    keepAlive: true
    timeout: 30000

  retryPolicy:
    maxRetries: 3
    backoffMultiplier: 2
    maxBackoffMs: 10000
```

#### **Memory Management**
```yaml
advanced:
  memoryManagement:
    gcInterval: 300000          # Garbage collection interval (5 min)
    maxHeapSize: "1024m"        # Maximum heap size
    enableMemoryProfiling: false # Enable for debugging
```

---

## 🛠️ **Troubleshooting Guide**

### **Common Issues & Solutions**

#### **🚫 Bot Won't Start**
```bash
# Check Node.js version
node --version  # Should be 20.0.0+

# Verify dependencies
npm list --depth=0

# Check configuration
npm run verify-keyfile
node -e "console.log(require('./config.yaml'))"

# Test RPC connectivity
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

#### **💸 No Trades Executing**
```bash
# Check wallet balances
curl -s http://localhost:3000/api/wallet-status | jq '.wallets[] | {address: .address, sol: .solBalance, healthy: .healthy}'

# Verify scheduler status
curl -s http://localhost:3000/api/scheduler/status | jq

# Check for errors
tail -50 logs/mm-bot.log | grep '"level":"error"' | jq
```

#### **📈 High Error Rates**
```bash
# Analyze error patterns
grep '"level":"error"' logs/mm-bot.log | jq -r '.error' | sort | uniq -c | sort -nr

# Check RPC health
curl -s http://localhost:3000/api/system-stats | jq '.rpc'

# Monitor slippage
curl -s http://localhost:3000/metrics | grep mm_slippage_bps
```

#### **🐌 Performance Issues**
```bash
# Check system resources
docker stats solana-market-making-bot

# Monitor response times
curl -s http://localhost:3000/metrics | grep mm_trade_execution_ms

# Analyze bottlenecks
grep '"duration":' logs/mm-bot.log | jq '.duration' | sort -n | tail -10
```

### **Diagnostic Commands**

```bash
# Complete system health check
curl -s http://localhost:3000/api/health | jq

# Export configuration (sanitized)
curl -s http://localhost:3000/api/config | jq 'del(.wallets.encryptionKey)'

# Generate diagnostic report
curl -s http://localhost:3000/api/system-stats > diagnostic-$(date +%Y%m%d-%H%M%S).json
```

---

## 🤝 **Contributing**

We welcome contributions from the community! Here's how to get involved:

### **Development Workflow**

1. **🍴 Fork the Repository**
   ```bash
   git clone https://github.com/your-username/solana-market-making-bot.git
   cd solana-market-making-bot
   ```

2. **🌿 Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **💻 Make Your Changes**
   - Follow TypeScript best practices
   - Add comprehensive tests
   - Update documentation
   - Follow existing code style

4. **🧪 Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

5. **📝 Submit Pull Request**
   - Provide clear description
   - Include test coverage
   - Reference related issues

### **Contribution Guidelines**

- **Code Quality**: Maintain >80% test coverage
- **Documentation**: Update README and inline docs
- **Security**: Follow security best practices
- **Performance**: Consider performance implications
- **Compatibility**: Ensure backward compatibility

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Solana Market Making Bot Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## ⚠️ **Important Disclaimers**

### **🚨 Risk Warning**
- **Financial Risk**: Trading cryptocurrencies involves substantial risk of loss
- **Market Risk**: Prices can be extremely volatile and unpredictable
- **Technical Risk**: Software bugs or network issues may cause losses
- **Regulatory Risk**: Cryptocurrency regulations vary by jurisdiction

### **🔍 Due Diligence**
- **Testing Required**: Always test thoroughly on devnet before mainnet
- **Security Audit**: Consider professional security audits for production use
- **Compliance**: Ensure compliance with local laws and regulations
- **Insurance**: Consider appropriate insurance coverage

### **📋 Liability Limitation**
The authors and contributors of this software:
- Provide no warranties or guarantees
- Are not responsible for any financial losses
- Recommend professional advice before use
- Encourage responsible trading practices

---

## 🆘 **Support & Community**

### **Getting Help**

1. **📖 Documentation**: Check this README and inline documentation
2. **🔍 Search Issues**: Look for existing solutions in GitHub issues
3. **📝 Create Issue**: Open a detailed issue with:
   - System information
   - Configuration (sanitized)
   - Error logs
   - Steps to reproduce

### **Community Resources**

- **💬 Discussions**: GitHub Discussions for general questions
- **🐛 Bug Reports**: GitHub Issues for bug reports
- **💡 Feature Requests**: GitHub Issues with enhancement label
- **📧 Security Issues**: Email security@yourproject.com

### **Response Times**

- **🚨 Critical Security Issues**: 24 hours
- **🐛 Bug Reports**: 3-5 business days
- **💡 Feature Requests**: 1-2 weeks
- **❓ General Questions**: 5-7 business days

---

<div align="center">

## 🌟 **Built with ❤️ for the Solana Ecosystem**

**Professional-grade market making tools for the decentralized future**

[![GitHub Stars](https://img.shields.io/github/stars/your-org/solana-market-making-bot?style=social)](https://github.com/your-org/solana-market-making-bot)
[![Twitter Follow](https://img.shields.io/twitter/follow/yourproject?style=social)](https://twitter.com/yourproject)

---

*Made with 🚀 by developers, for developers*

</div>
