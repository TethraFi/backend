# Tethra DEX - Backend API

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey)

Backend service for Tethra DEX supporting **Flow EVM Testnet** and **Base Sepolia**, providing:
- 📊 **Real-time Price Feeds** from Pyth Network Oracle
- ✍️ **Price Signing** for on-chain verification
- 🚀 **Relay Service** for gasless transactions
- 🤖 **Automated Order Execution** (Limit orders, TP/SL)
- 📊 **Position Monitoring** with auto-liquidation
- 🎲 **One Tap Profit** betting settlement
- 🌐 **Multi-Chain Support** for Flow & Base

## 🌟 Key Features

### Price Oracle & Signing
- ✅ **Pyth Network Integration** - Cryptographically verified price feeds
- ✅ **Multi-Asset Support** - 12 assets (BTC, ETH, SOL, AVAX, NEAR, BNB, XRP, AAVE, ARB, DOGE, LINK, MATIC)
- ✅ **Price Signing** - ECDSA signatures for on-chain verification
- ✅ **WebSocket Broadcasting** - Real-time price updates every 5 seconds
- ✅ **Binance Fallback** - Automatic fallback if Pyth unavailable

### Trading Automation
- ✅ **Limit Order Keeper** - Auto-executes limit orders when price triggers
- ✅ **Grid Trading Bot** - Manages grid trading sessions
- ✅ **TP/SL Monitor** - Auto-executes take-profit and stop-loss orders
- ✅ **Tap-to-Trade Executor** - Fast backend-only order execution
- ✅ **Position Monitor** - Auto-liquidates undercollateralized positions
- ✅ **One Tap Profit Settlement** - Automatic bet settlement

### Infrastructure
- ✅ **Relay Service** - Gasless transactions with USDC gas payment
- ✅ **RESTful API** - Comprehensive endpoints for all features
- ✅ **WebSocket Server** - Real-time updates for prices and positions
- ✅ **TypeScript** - Type-safe development with full type coverage

## 🌐 Supported Networks

This backend supports both chains with deployed smart contracts:

### Flow EVM Testnet
- **RPC URL**: `https://testnet.evm.nodes.onflow.org`
- **Chain ID**: 545
- All contract addresses available in `.env`

### Base Sepolia
- **RPC URL**: `https://sepolia.base.org`
- **Chain ID**: 84532
- All contract addresses available in `.env`

## 📦 Deployed Smart Contracts

### Flow EVM Testnet Addresses

```env
# Tokens
FLOW_USDC_ADDRESS=0x2c6887Fa522B551992974b68ffB1660f6d2F8340
FLOW_TETHRA_TOKEN_ADDRESS=0xff9EEdD3Ca844794fb9934D4Fa56dE5Ca89c6fbA

# Core Trading
FLOW_RISK_MANAGER_ADDRESS=0xc04B2294D30D6e077B1736d84A11DFe6f68e9745
FLOW_POSITION_MANAGER_ADDRESS=0x29Bc61d98d9BD0298C010D59A5C2e5a2CB5D8958
FLOW_TREASURY_MANAGER_ADDRESS=0xADbb3D9eE68d701e61bA49DDe3fa85e4864c00e9
FLOW_MARKET_EXECUTOR_ADDRESS=0x5f6fe2dee3A77F255057A4210958784B60A9C66D

# Advanced Trading
FLOW_LIMIT_EXECUTOR_ADDRESS=0x9782F89bDB822059FeaC76425b10f81A1E2d5d3f
FLOW_TAP_TO_TRADE_EXECUTOR_ADDRESS=0xD59551d80BDfe94662ACed1d27b5b12792711072
FLOW_ONE_TAP_PROFIT_ADDRESS=0x42C53C1769779277B74bD89b3e6994E88d33E285

# Staking & Incentives
FLOW_TETHRA_STAKING_ADDRESS=0x3c30c160406fd840A571B65fD475A91F960B730E
FLOW_LIQUIDITY_MINING_ADDRESS=0xE9de7BF710B98D465BB90a92599F40431b0D3Bf8

# Infrastructure
FLOW_USDC_PAYMASTER_ADDRESS=0x3aB9B3DD9D96F063902A8FE12Ed1401e26c5D533
```

### Base Sepolia Addresses

```env
# Tokens
BASE_USDC_ADDRESS=0x9d660c5d4BFE4b7fcC76f327b22ABF7773DD48c1
BASE_TETHRA_TOKEN_ADDRESS=0x6f1330f207Ab5e2a52c550AF308bA28e3c517311

# Core Trading
BASE_RISK_MANAGER_ADDRESS=0x08A23503CC221C3B520D2E9bA2aB93E3546d798F
BASE_POSITION_MANAGER_ADDRESS=0x8eA6059Bd95a9f0A47Ce361130ffB007415519aF
BASE_TREASURY_MANAGER_ADDRESS=0x157e68fBDD7D8294badeD37d876aEb7765986681
BASE_MARKET_EXECUTOR_ADDRESS=0xA1badd2cea74931d668B7aB99015ede28735B3EF

# Advanced Trading
BASE_LIMIT_EXECUTOR_ADDRESS=0x8c297677FEA6F0beDC0D1fa139aa2bc23eE6234a
BASE_TAP_TO_TRADE_EXECUTOR_ADDRESS=0x79Cb84cF317235EA5C61Cce662373D982853E8d8
BASE_ONE_TAP_PROFIT_ADDRESS=0x5D4c52a7aD4Fb6B43C6B212Db1C1e0A7f9B0f73c

# Staking & Incentives
BASE_TETHRA_STAKING_ADDRESS=0x69FFE0989234971eA2bc542c84c9861b0D8F9b17
BASE_LIQUIDITY_MINING_ADDRESS=0x76dc221f50ca56A1E8445508CA9ecc0aD57d0B11

# Infrastructure
BASE_USDC_PAYMASTER_ADDRESS=0x94FbB9C6C854599c7562c282eADa4889115CCd8E
```

## 📋 Prerequisites

- Node.js >= 18.x
- npm or yarn

## 🚀 Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Setup environment variables:**
```bash
cp .env.example .env
```

Edit `.env` sesuai kebutuhan:
```env
PORT=3001
NODE_ENV=development
DEBUG=true
```

## 💻 Development

```bash
npm run dev
```

Server akan running di `http://localhost:3001`

## 🏗️ Build & Production

```bash
# Build TypeScript to JavaScript
npm run build

# Run production
npm start
```

## 📡 API Endpoints

### REST API

#### Get All Prices
```bash
GET http://localhost:3001/api/price/all
```

Response:
```json
{
  "success": true,
  "data": {
    "BTC": {
      "symbol": "BTC",
      "price": 97234.56,
      "confidence": 45.32,
      "expo": -8,
      "timestamp": 1704567890123,
      "source": "pyth",
      "publishTime": 1704567890
    },
    "ETH": { ... },
    ...
  },
  "count": 12,
  "timestamp": 1704567890123
}
```

#### Get Single Asset Price
```bash
GET http://localhost:3001/api/price/current/BTC
```

Response:
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "price": 97234.56,
    "confidence": 45.32,
    "expo": -8,
    "timestamp": 1704567890123,
    "source": "pyth"
  },
  "timestamp": 1704567890123
}
```

#### Health Check
```bash
GET http://localhost:3001/health
```

Response:
```json
{
  "success": true,
  "service": "Tethra DEX Backend",
  "uptime": 123.456,
  "priceService": {
    "status": "connected",
    "lastUpdate": 1704567890123,
    "assetsMonitored": 12
  },
  "timestamp": 1704567890123
}
```

### WebSocket

Connect to: `ws://localhost:3001/ws/price`

**Message Format:**
```json
{
  "type": "price_update",
  "data": {
    "BTC": {
      "symbol": "BTC",
      "price": 97234.56,
      "confidence": 45.32,
      "timestamp": 1704567890123,
      "source": "pyth"
    },
    "ETH": { ... }
  },
  "timestamp": 1704567890123
}
```

## 🔗 Integration dengan Frontend

### WebSocket Client Example (JavaScript/TypeScript)

```typescript
const ws = new WebSocket('ws://localhost:3001/ws/price');

ws.onopen = () => {
  console.log('Connected to Pyth price feed');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'price_update') {
    const prices = message.data;
    
    // Update your UI with Pyth Oracle prices
    console.log('BTC Price from Pyth:', prices.BTC.price);
    console.log('Confidence:', prices.BTC.confidence);
    
    // Display as yellow line on TradingView chart
    updateChartWithOraclePrice(prices.BTC.price);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from price feed');
};
```

### REST API Example (fetch)

```typescript
async function getPythPrices() {
  try {
    const response = await fetch('http://localhost:3001/api/price/all');
    const result = await response.json();
    
    if (result.success) {
      const prices = result.data;
      console.log('All prices from Pyth:', prices);
      return prices;
    }
  } catch (error) {
    console.error('Failed to fetch prices:', error);
  }
}
```

## 📊 Supported Assets

| Symbol | Pyth Price ID | Binance Symbol |
|--------|---------------|----------------|
| BTC    | 0xe62df6... | BTCUSDT |
| ETH    | 0xff61491... | ETHUSDT |
| SOL    | 0xef0d8b6... | SOLUSDT |
| AVAX   | 0x93da335... | AVAXUSDT |
| NEAR   | 0xc415de8... | NEARUSDT |
| BNB    | 0x2f95862... | BNBUSDT |
| XRP    | 0xec5d399... | XRPUSDT |
| AAVE   | 0x2b9ab1e... | AAVEUSDT |
| ARB    | 0x3fa4252... | ARBUSDT |
| DOGE   | 0xdcef50d... | DOGEUSDT |
| LINK   | 0x8ac0c70... | LINKUSDT |
| MATIC  | 0x5de33a9... | MATICUSDT |

## 🛠️ Architecture

```
┌─────────────────────────────────────────┐
│         Pyth Network Oracle             │
│     (Hermes API - hermes.pyth.network)  │
└────────────────┬────────────────────────┘
                 │ Price Feeds (5s interval)
                 ▼
┌─────────────────────────────────────────┐
│      Tethra DEX Backend Service         │
│  ┌───────────────────────────────────┐  │
│  │   PythPriceService                │  │
│  │   - Fetch all assets prices       │  │
│  │   - Fallback to Binance           │  │
│  │   - Real-time updates             │  │
│  └───────────────────────────────────┘  │
│                                          │
│  ┌──────────┐      ┌──────────────┐    │
│  │ REST API │      │  WebSocket   │    │
│  └──────────┘      └──────────────┘    │
└────────────┬─────────────┬──────────────┘
             │             │
             ▼             ▼
┌────────────────────────────────────────┐
│         Frontend Application            │
│  - TradingView Chart                   │
│  - Yellow line for Oracle price        │
│  - Real-time price updates             │
└────────────────────────────────────────┘
```

## 🖥️ Production Deployment (VPS)

### Prerequisites
- Ubuntu/Debian VPS (recommended: 2GB RAM minimum)
- Node.js 18+ installed
- Domain name (optional, for HTTPS)
- Firewall configured

### Step 1: Setup VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (reverse proxy)
sudo apt install -y nginx
```

### Step 2: Deploy Backend

```bash
# Clone repository
cd /var/www
sudo git clone <your-repo-url> tethra-dex
cd tethra-dex/tethra-be

# Install dependencies
npm install

# Build TypeScript
npm run build

# Setup environment variables
sudo nano .env
# Copy all values from .env.example and configure
```

### Step 3: Configure Environment

Edit `.env` file with production values:

```bash
# Server
PORT=3001
NODE_ENV=production
DEBUG=false

# Smart Contracts (from deployment)
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
MARKET_EXECUTOR_ADDRESS=0x...
POSITION_MANAGER_ADDRESS=0x...
TREASURY_MANAGER_ADDRESS=0x...
# ... (copy all contract addresses)

# Wallets (IMPORTANT: Keep private keys secure!)
PRICE_SIGNER_PRIVATE_KEY=0x...
RELAY_PRIVATE_KEY=0x...
LIMIT_ORDER_KEEPER_PRIVATE_KEY=0x...
```

### Step 4: Run with PM2

```bash
# Start backend with PM2
pm2 start npm --name "tethra-backend" -- start

# Save PM2 config
pm2 save

# Enable PM2 startup on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Check status
pm2 status
pm2 logs tethra-backend
```

### Step 5: Configure Nginx (Reverse Proxy)

Create Nginx config:

```bash
sudo nano /etc/nginx/sites-available/tethra-backend
```

Add configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com; # or use IP address

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/tethra-backend /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 6: Setup SSL (HTTPS) - Optional but Recommended

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

### Step 7: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Check status
sudo ufw status
```

### Step 8: Monitor & Maintain

```bash
# View logs
pm2 logs tethra-backend
pm2 logs tethra-backend --lines 100

# Restart service
pm2 restart tethra-backend

# Stop service
pm2 stop tethra-backend

# Monitor resources
pm2 monit

# Update code
cd /var/www/tethra-dex/tethra-be
sudo git pull
npm install
npm run build
pm2 restart tethra-backend
```

### Important Production Notes

⚠️ **Security Best Practices:**
1. **Private Keys**: NEVER commit `.env` to Git. Store securely
2. **Relay Wallet**: Fund with Base Sepolia ETH for gas fees
3. **Firewall**: Only expose ports 22, 80, 443
4. **SSL**: Always use HTTPS in production
5. **Monitoring**: Setup uptime monitoring (UptimeRobot, etc.)

💰 **Wallet Funding:**
- Relay wallet needs Base Sepolia ETH (~0.1 ETH recommended)
- Price signer wallet doesn't need ETH (signing only)
- Keeper wallet needs Base Sepolia ETH for order execution

🔄 **Auto-Restart on Crash:**
PM2 automatically restarts the service if it crashes. Check logs:
```bash
pm2 logs tethra-backend --err
```

### Troubleshooting VPS Deployment

**Issue: Port 3001 already in use**
```bash
sudo lsof -ti:3001 | xargs sudo kill -9
pm2 restart tethra-backend
```

**Issue: Nginx 502 Bad Gateway**
```bash
# Check if backend is running
pm2 status

# Check backend logs
pm2 logs tethra-backend

# Restart Nginx
sudo systemctl restart nginx
```

**Issue: Out of Memory**
```bash
# Increase Node.js memory limit
pm2 start npm --name "tethra-backend" --max-memory-restart 500M -- start
```

**Issue: WebSocket connection fails**
- Check firewall allows connections
- Verify Nginx WebSocket config
- Check frontend connects to correct wss:// URL (not ws://)

## 🎯 Frontend Integration

### Environment Variables for Frontend

Update `Tethra-Front-End/.env`:

```bash
# Development
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Production
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
```

## 📝 Notes

- **Pyth Oracle** menyediakan harga yang cryptographically verified
- Price update interval: **5 detik** (lebih cepat dari TradingView free plan)
- Confidence interval menunjukkan akurasi harga
- Fallback ke Binance jika Pyth tidak available

## 🔧 Troubleshooting

### Port already in use
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### WebSocket connection failed
- Check firewall settings
- Make sure backend is running
- Verify correct URL and port

## 📄 License

MIT

## 👥 Team

Tethra DEX Development Team

# tethra-be