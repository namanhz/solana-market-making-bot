# 🤖 **Solana Trading Bot - Complete Operations Guide**

## 📋 **Table of Contents**
- [Quick Start](#-quick-start)
- [System Architecture](#-system-architecture)
- [Configuration](#-configuration)
- [Operations](#-operations)
- [Monitoring](#-monitoring)
- [Troubleshooting](#-troubleshooting)
- [Maintenance](#-maintenance)
- [Emergency Procedures](#-emergency-procedures)
- [Best Practices](#-best-practices)

---

## 🚀 **Quick Start**

### **Prerequisites**
- Python 3.8+
- Required files: `solana_wallets.json`, `token.txt`, `.env`, `config.yaml`
- Minimum 0.01 SOL per wallet for trading

### **Installation**
```bash
# Install dependencies
pip install -r requirements.txt

# Verify installation
python -m src.utils.config_validator
```

### **First Run**
```bash
# Test in dry-run mode
python -m src.main --dry-run --duration 300

# Start live trading
python -m src.main
```

### **Access Dashboard**
Open http://localhost:8080 for real-time monitoring

---

## 🏗️ **System Architecture**

### **Core Components**
```
📁 src/
├── core/                 # Core infrastructure
│   ├── config.py        # Configuration management
│   ├── wallet.py        # Wallet management (100 wallets)
│   ├── token_manager.py # Token management (2544 tokens)
│   ├── rpc_client.py    # Solana RPC client
│   ├── jupiter_client.py # Jupiter API integration
│   ├── swap_executor.py # Trade execution engine
│   ├── state_manager.py # State persistence
│   └── cache_integration.py # Cache system
├── trading/             # Trading logic
│   ├── scheduler.py     # Main trading scheduler
│   ├── buy_phase.py     # Buy operation logic
│   ├── sell_phase.py    # Sell operation logic
│   ├── randomization.py # Randomization engine
│   └── balance_manager.py # Balance management
├── monitoring/          # Monitoring & analytics
│   ├── metrics.py       # Metrics collection
│   ├── dashboard.py     # Web dashboard
│   └── reports.py       # Reporting system
└── utils/               # Utilities
    ├── logger.py        # Logging system
    └── cache_recovery.py # Cache recovery tools
```

### **Data Flow**
```
Wallets (100) → Token Selection (2544) → Jupiter API → Solana RPC → Trade Execution
     ↓              ↓                        ↓            ↓             ↓
Cache System ← Metrics Collection ← Performance Tracking ← State Management
```

---

## ⚙️ **Configuration**

### **Environment Variables (.env)**
```bash
# Trading Settings
TRADING_ENABLED=true
DRY_RUN_MODE=false
MIN_SOL_BALANCE=0.01
SWAP_PERCENTAGE=0.10

# API Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
JUPITER_BASE_URL=https://quote-api.jup.ag/v6

# System Settings
LOG_LEVEL=INFO
DASHBOARD_PORT=8080
CACHE_ENABLED=true
```

### **Main Configuration (config.yaml)**
```yaml
trading:
  enabled: true
  dry_run: false
  min_sol_balance: 0.01
  swap_percentage: 0.10
  buy_interval_min: 2700    # 45 minutes
  buy_interval_max: 4500    # 75 minutes
  sell_delay_min: 900       # 15 minutes
  sell_delay_max: 1200      # 20 minutes
  sell_percentage_min: 0.9901
  sell_percentage_max: 0.9999
  slippage_bps: 100

apis:
  solana_rpc_url: "https://api.mainnet-beta.solana.com"
  jupiter_base_url: "https://quote-api.jup.ag/v6"
  rate_limit_rps: 10

logging:
  level: "INFO"
  file: "logs/trading.log"
  max_size_mb: 100
  backup_count: 5

monitoring:
  dashboard_enabled: true
  dashboard_port: 8080
  metrics_retention_hours: 24

cache:
  enabled: true
  directory: "cache"
  auto_save_interval: 30
  backup_retention: 10
```

### **Wallet Configuration (solana_wallets.json)**
```json
[
  {
    "index": 1,
    "address": "wallet_address_here",
    "private_key": "base58_private_key_here"
  }
]
```

### **Token List (token.txt)**
```
So11111111111111111111111111111111111111112
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

---

## 🎛️ **Operations**

### **Starting the Bot**
```bash
# Standard start
python -m src.main

# With custom configuration
python -m src.main --config custom_config.yaml

# Dry-run mode (no real trades)
python -m src.main --dry-run

# Time-limited run
python -m src.main --duration 3600  # 1 hour

# Custom wallet/token files
python -m src.main --wallets custom_wallets.json --tokens custom_tokens.txt
```

### **Stopping the Bot**
```bash
# Graceful shutdown (recommended)
Ctrl+C

# Force stop (if needed)
pkill -f "python -m src.main"
```

### **Cache Management**
```bash
# Analyze cache state
python cache_manager.py analyze

# Interactive recovery
python cache_manager.py recover --interactive

# Validate integrity
python cache_manager.py validate

# Export report
python cache_manager.py export --output report.json

# Clear cache (emergency only)
python cache_manager.py clear --force
```

---

## 📊 **Monitoring**

### **Web Dashboard**
- **URL**: http://localhost:8080
- **Features**: Real-time metrics, wallet status, system health
- **Updates**: Every 5 seconds via WebSocket

### **Dashboard Sections**
- **📊 Trading Statistics**: Success rates, trade counts, wallet activity
- **🏥 System Health**: Circuit breakers, uptime, error rates
- **⚡ Performance**: Response times, throughput, resource usage
- **❌ Error Tracking**: RPC errors, Jupiter issues, network problems

### **API Endpoints**
```bash
# Get all metrics
curl http://localhost:8080/api/metrics

# System health
curl http://localhost:8080/api/health

# Trading statistics
curl http://localhost:8080/api/trading-stats

# Circuit breaker status
curl http://localhost:8080/api/circuits
```

### **Key Metrics to Monitor**
```
Trading Performance:
✅ Success Rate: >90%
✅ Avg Trade Duration: <5 seconds
✅ Active Wallets: 80-90%
✅ Daily Trades: ~24 per wallet

System Performance:
✅ RPC Response: <200ms
✅ Jupiter Response: <500ms
✅ Memory Usage: <500MB
✅ CPU Usage: <20%

Error Rates:
✅ Network Errors: <5%
✅ RPC Errors: <3%
✅ Jupiter Errors: <2%
✅ Validation Errors: <1%
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Bot Won't Start**
```bash
# Check Python version
python --version  # Should be 3.8+

# Verify files exist
ls -la solana_wallets.json token.txt .env config.yaml

# Install dependencies
pip install -r requirements.txt

# Validate configuration
python -m src.utils.config_validator
```

#### **No Trades Executing**
```bash
# Check if dry-run mode is enabled
grep -i "dry_run" .env config.yaml

# Verify trading is enabled
grep -i "trading_enabled" .env config.yaml

# Check wallet balances
python -c "
import asyncio
from src.core.wallet import WalletManager
from src.core.rpc_client import RateLimitedRPCClient

async def check():
    rpc = RateLimitedRPCClient('https://api.mainnet-beta.solana.com')
    await rpc.connect()
    wm = WalletManager(rpc, 'solana_wallets.json')
    await wm.load_wallets()
    summary = await wm.get_balance_summary()
    print(f'Healthy wallets: {summary[\"healthy_wallets\"]}')
    print(f'Total SOL: {summary[\"total_sol_balance\"]}')

asyncio.run(check())
"
```

#### **High Error Rates**
```bash
# Test RPC connectivity
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Test Jupiter API
curl "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000"

# Check circuit breakers
python cache_manager.py analyze
```

#### **Performance Issues**
```bash
# Monitor resources
htop
free -h

# Check logs for slow operations
grep "slow" logs/trading.log

# Reduce concurrent operations in config.yaml:
# max_concurrent_operations: 5  # Default: 10
```

#### **Cache Issues**
```bash
# Analyze cache
python cache_manager.py analyze

# Validate integrity
python cache_manager.py validate

# Perform recovery
python cache_manager.py recover --reset-errors --reschedule
```

---

## 🔧 **Maintenance**

### **Daily Tasks**
```bash
# 1. Health check
python cache_manager.py analyze

# 2. Review performance
curl http://localhost:8080/api/trading-stats | jq

# 3. Check logs
tail -100 logs/trading.log | grep -E "(ERROR|WARNING)"

# 4. Monitor disk space
df -h && du -sh cache/ logs/
```

### **Weekly Tasks**
```bash
# 1. Generate report
python cache_manager.py export --output weekly_$(date +%Y%m%d).json

# 2. Clean old logs
find logs/ -name "*.log.*" -mtime +7 -delete

# 3. Clean old backups
find cache/backups/ -name "*.gz" -mtime +30 -delete

# 4. Review token list
# Update token.txt if needed
```

### **Monthly Tasks**
```bash
# 1. Full backup
tar -czf backup_$(date +%Y%m%d).tar.gz \
  solana_wallets.json token.txt .env config.yaml cache/ logs/

# 2. Update dependencies
pip list --outdated

# 3. Performance review
# Analyze monthly performance trends

# 4. Security audit
# Review access logs and security measures
```

---

## 🚨 **Emergency Procedures**

### **Emergency Stop**
```bash
# Graceful shutdown
pkill -SIGTERM -f "python -m src.main"

# Force stop (if unresponsive)
pkill -SIGKILL -f "python -m src.main"

# Verify stopped
ps aux | grep "src.main"
```

### **Emergency Recovery**
```bash
# 1. Assess situation
python cache_manager.py analyze

# 2. Validate data
python cache_manager.py validate

# 3. Perform recovery
python cache_manager.py recover --reset-errors --reschedule --refresh-balances

# 4. Test restart
python -m src.main --dry-run --duration 60

# 5. Resume operations
python -m src.main
```

### **Data Recovery**
```bash
# Restore from backup
tar -xzf backup_YYYYMMDD.tar.gz

# Restore specific cache
cp cache/backups/state_backup_*.json.gz ./
gunzip state_backup_*.json.gz

# Validate restored data
python cache_manager.py validate
```

---

## 🎯 **Best Practices**

### **Operational Excellence**
1. **🔍 Monitor Continuously** - Use dashboard and set up alerts
2. **📝 Maintain Logs** - Regular rotation and analysis
3. **💾 Backup Regularly** - Automated and manual backups
4. **🧪 Test Recovery** - Periodic recovery drills
5. **⚙️ Update Carefully** - Test changes in dry-run mode
6. **📋 Document Issues** - Maintain incident log
7. **📈 Optimize Gradually** - Make incremental improvements
8. **📡 Stay Informed** - Monitor Solana network status

### **Security Practices**
1. **🔐 Protect Keys** - Secure wallet file access
2. **👁️ Monitor Access** - Log administrative actions
3. **🔄 Update Dependencies** - Regular security updates
4. **🛡️ Limit Exposure** - Minimum required permissions
5. **🔍 Audit Regularly** - Periodic security reviews

### **Performance Optimization**
1. **📊 Monitor Metrics** - Track KPIs continuously
2. **⚙️ Tune Parameters** - Optimize based on data
3. **📈 Scale Gradually** - Increase load incrementally
4. **💾 Cache Effectively** - Leverage caching systems
5. **🔍 Profile Regularly** - Identify bottlenecks early

---

## 📞 **Quick Reference**

### **Important Files**
```
.env                    # Environment configuration
config.yaml            # Main configuration
solana_wallets.json     # Wallet definitions
token.txt              # Token list (2544 tokens)
logs/trading.log       # Main log file
cache/                 # State persistence
```

### **Key Commands**
```bash
# Start bot
python -m src.main

# Cache management
python cache_manager.py [analyze|recover|validate|export|clear]

# Health check
curl http://localhost:8080/api/health

# View dashboard
open http://localhost:8080
```

### **Emergency Contacts**
- **System Logs**: `logs/trading.log`
- **Error Logs**: `logs/error.log`
- **Cache Status**: `python cache_manager.py analyze`
- **Dashboard**: http://localhost:8080

---

**🎉 Your Solana Trading Bot is ready for professional operation with comprehensive monitoring, maintenance, and recovery capabilities! 🎉**
