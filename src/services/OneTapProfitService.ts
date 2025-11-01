import { ethers } from 'ethers';
import { Logger } from '../utils/Logger';
import { getChainConfig, type ChainType, type ChainConfig } from '../config/chains';
import {
  OneTapBet,
  OneTapBetStatus,
  PlaceOneTapBetRequest,
  PlaceOneTapBetKeeperRequest,
  GetOneTapBetsQuery,
  OneTapProfitStats,
  CalculateMultiplierRequest,
  CalculateMultiplierResponse,
} from '../types/oneTapProfit';

const OneTapProfitABI = [
  'function placeBetMeta(address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime, bytes userSignature) external returns (uint256)',
  'function placeBetByKeeper(address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime) external returns (uint256)',
  'function settleBet(uint256 betId, uint256 currentPrice, uint256 currentTime, bool won) external',
  'function getBet(uint256 betId) external view returns (uint256 id, address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime, uint256 multiplier, uint8 status, uint256 settledAt, uint256 settlePrice)',
  'function getUserBets(address user) external view returns (uint256[])',
  'function getActiveBetsCount() external view returns (uint256)',
  'function calculateMultiplier(uint256 entryPrice, uint256 targetPrice, uint256 entryTime, uint256 targetTime) public pure returns (uint256)',
  'function nextBetId() external view returns (uint256)',
  'event BetPlaced(uint256 indexed betId, address indexed trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 multiplier)',
  'event BetSettled(uint256 indexed betId, address indexed trader, uint8 status, uint256 payout, uint256 fee, uint256 settlePrice)',
];

/**
 * OneTapProfitService - Manages One Tap Profit bets
 * 
 * This service:
 * 1. Stores active bets in memory for monitoring
 * 2. Places bets on-chain via relayer
 * 3. Monitors price and time conditions
 * 4. Settles bets automatically
 */
export class OneTapProfitService {
  private readonly logger = new Logger('OneTapProfitService');
  private baseProvider: ethers.JsonRpcProvider;
  private flowProvider: ethers.JsonRpcProvider;
  private baseWallet: ethers.Wallet;
  private flowWallet: ethers.Wallet;

  // In-memory storage for active bets
  private bets: Map<string, OneTapBet> = new Map();
  private betsByTrader: Map<string, string[]> = new Map();

  constructor() {
    const relayPrivateKey = process.env.RELAY_PRIVATE_KEY;
    if (!relayPrivateKey) {
      throw new Error('RELAY_PRIVATE_KEY not set in environment');
    }

    // Initialize Base chain
    const baseConfig = getChainConfig('base');
    this.baseProvider = new ethers.JsonRpcProvider(baseConfig.rpcUrl);
    this.baseWallet = new ethers.Wallet(relayPrivateKey, this.baseProvider);

    // Initialize Flow chain
    const flowConfig = getChainConfig('flow');
    this.flowProvider = new ethers.JsonRpcProvider(flowConfig.rpcUrl);
    this.flowWallet = new ethers.Wallet(relayPrivateKey, this.flowProvider);

    this.logger.success(`✅ OneTapProfitService initialized (Multi-Chain)`);
    this.logger.info(`💰 Relayer: ${this.baseWallet.address}`);
    this.logger.info(`📝 Base Contract: ${baseConfig.contracts.oneTapProfit}`);
    this.logger.info(`📝 Flow Contract: ${flowConfig.contracts.oneTapProfit}`);
  }

  /**
   * Get chain-specific configuration
   */
  private getChainConfig(chain: ChainType = 'base') {
    const chainConfig = getChainConfig(chain);
    const provider = chain === 'flow' ? this.flowProvider : this.baseProvider;
    const wallet = chain === 'flow' ? this.flowWallet : this.baseWallet;
    const contractAddress = chainConfig.contracts.oneTapProfit;

    const contract = new ethers.Contract(contractAddress, OneTapProfitABI, wallet);

    return { provider, wallet, contract, contractAddress, chainConfig };
  }
  
  
  /**
   * Place a bet via keeper (fully gasless for user) - Multi-Chain Support
   * Backend validates session key off-chain, keeper executes without on-chain signature verification
   */
  async placeBetByKeeper(request: PlaceOneTapBetKeeperRequest, chain: ChainType = 'base'): Promise<{ betId: string; txHash: string; }> {
    try {
      // Get chain-specific config
      const { contract, chainConfig } = this.getChainConfig(chain);

      const GRID_Y_DOLLARS = 0.05; // Same as backend monitor
      const targetPriceNum = parseFloat(request.targetPrice);
      const gridBottomPrice = targetPriceNum - (GRID_Y_DOLLARS / 2);
      const gridTopPrice = targetPriceNum + (GRID_Y_DOLLARS / 2);

      // Convert UTC timestamps to GMT+7 for logging
      const toGMT7 = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        date.setHours(date.getHours() + 7); // Add 7 hours for GMT+7
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' GMT+7';
      };

      this.logger.info(`🎯 Placing One Tap Profit bet on ${chain} via KEEPER for ${request.trader}`);
      this.logger.info(`   Symbol: ${request.symbol}`);
      this.logger.info(`   Entry Price: $${parseFloat(request.entryPrice).toFixed(2)} at ${toGMT7(request.entryTime)}`);
      this.logger.info(`   Grid Price Range: $${gridBottomPrice.toFixed(2)} - $${gridTopPrice.toFixed(2)} (center: $${targetPriceNum.toFixed(2)})`);
      this.logger.info(`   Time Window: ${toGMT7(request.entryTime)} → ${toGMT7(request.targetTime)}`);

      // Fix floating point precision
      const betAmountFixed = parseFloat(request.betAmount).toFixed(6);
      const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);
      const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);

      const betAmount = ethers.parseUnits(betAmountFixed, 6);
      const targetPrice = ethers.parseUnits(targetPriceFixed, 8);
      const entryPrice = ethers.parseUnits(entryPriceFixed, 8);

      // Place bet on-chain via keeper using chain-specific contract
      const tx = await contract.placeBetByKeeper(
        request.trader,
        request.symbol,
        betAmount,
        targetPrice,
        request.targetTime,
        entryPrice,
        request.entryTime
      );

      this.logger.info(`⏳ Waiting for keeper transaction on ${chain}: ${tx.hash}`);
      const receipt = await tx.wait();

      // Extract on-chain betId from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'BetPlaced';
        } catch {
          return false;
        }
      });

      const parsedEvent = contract.interface.parseLog(event);
      const onChainBetId = parsedEvent?.args?.betId?.toString();
      
      // Calculate multiplier
      const multiplierResult = await this.calculateMultiplier({
        entryPrice: request.entryPrice,
        targetPrice: request.targetPrice,
        entryTime: request.entryTime,
        targetTime: request.targetTime,
      }, chain);
      
      // Store in memory for monitoring
      const bet: OneTapBet = {
        betId: onChainBetId,
        trader: request.trader.toLowerCase(),
        symbol: request.symbol,
        betAmount: request.betAmount,
        targetPrice: request.targetPrice,
        targetTime: request.targetTime,
        entryPrice: request.entryPrice,
        entryTime: request.entryTime,
        multiplier: multiplierResult.multiplier,
        status: OneTapBetStatus.ACTIVE,
        chain: chain,
        createdAt: Date.now(),
      };

      // Use composite key: chain-betId to avoid conflicts between chains
      const compositeKey = `${chain}-${onChainBetId}`;
      this.bets.set(compositeKey, bet);

      const traderBets = this.betsByTrader.get(bet.trader) || [];
      traderBets.push(compositeKey);
      this.betsByTrader.set(bet.trader, traderBets);

      this.logger.success(`✅ Bet placed on-chain via KEEPER! BetId: ${onChainBetId}, TxHash: ${tx.hash}`);

      return { betId: onChainBetId, txHash: tx.hash };
    } catch (error: any) {
      this.logger.error('Failed to place bet via keeper:', error);
      throw new Error(`Failed to place bet: ${error.message}`);
    }
  }
  
  /**
   * Place a bet - Execute on-chain IMMEDIATELY (legacy method with user signature)
   * User pays USDC now, backend settles later when conditions met
   * Defaults to Base chain for backward compatibility
   */
  async placeBet(request: PlaceOneTapBetRequest, chain: ChainType = 'base'): Promise<{ betId: string; txHash: string; }> {
    try {
      // Get chain-specific config
      const { contract, chainConfig } = this.getChainConfig(chain);

      const GRID_Y_DOLLARS = 0.05; // Same as backend monitor
      const targetPriceNum = parseFloat(request.targetPrice);
      const gridBottomPrice = targetPriceNum - (GRID_Y_DOLLARS / 2);
      const gridTopPrice = targetPriceNum + (GRID_Y_DOLLARS / 2);

      // Convert UTC timestamps to GMT+7 for logging
      const toGMT7 = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        date.setHours(date.getHours() + 7); // Add 7 hours for GMT+7
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' GMT+7';
      };

      this.logger.info(`🎯 Placing One Tap Profit bet on ${chain} for ${request.trader}`);
      this.logger.info(`   Symbol: ${request.symbol}`);
      this.logger.info(`   Entry Price: $${parseFloat(request.entryPrice).toFixed(2)} at ${toGMT7(request.entryTime)}`);
      this.logger.info(`   Grid Price Range: $${gridBottomPrice.toFixed(2)} - $${gridTopPrice.toFixed(2)} (center: $${targetPriceNum.toFixed(2)})`);
      this.logger.info(`   Time Window: ${toGMT7(request.entryTime)} → ${toGMT7(request.targetTime)}`);

      // Fix floating point precision
      const betAmountFixed = parseFloat(request.betAmount).toFixed(6);
      const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);
      const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);

      const betAmount = ethers.parseUnits(betAmountFixed, 6);
      const targetPrice = ethers.parseUnits(targetPriceFixed, 8);
      const entryPrice = ethers.parseUnits(entryPriceFixed, 8);

      // Place bet on-chain via relayer using chain-specific contract
      const tx = await contract.placeBetMeta(
        request.trader,
        request.symbol,
        betAmount,
        targetPrice,
        request.targetTime,
        entryPrice,
        request.entryTime,
        request.userSignature
      );

      this.logger.info(`⏳ Waiting for transaction on ${chain}: ${tx.hash}`);
      const receipt = await tx.wait();

      // Extract on-chain betId from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'BetPlaced';
        } catch {
          return false;
        }
      });

      const parsedEvent = contract.interface.parseLog(event);
      const onChainBetId = parsedEvent?.args?.betId?.toString();
      
      // Calculate multiplier
      const multiplierResult = await this.calculateMultiplier({
        entryPrice: request.entryPrice,
        targetPrice: request.targetPrice,
        entryTime: request.entryTime,
        targetTime: request.targetTime,
      }, chain);

      // Store in memory for monitoring
      const bet: OneTapBet = {
        betId: onChainBetId,
        trader: request.trader.toLowerCase(),
        symbol: request.symbol,
        betAmount: request.betAmount,
        targetPrice: request.targetPrice,
        targetTime: request.targetTime,
        entryPrice: request.entryPrice,
        entryTime: request.entryTime,
        multiplier: multiplierResult.multiplier,
        status: OneTapBetStatus.ACTIVE,
        chain: chain,
        createdAt: Date.now(),
      };

      // Use composite key: chain-betId to avoid conflicts between chains
      const compositeKey = `${chain}-${onChainBetId}`;
      this.bets.set(compositeKey, bet);

      const traderBets = this.betsByTrader.get(bet.trader) || [];
      traderBets.push(compositeKey);
      this.betsByTrader.set(bet.trader, traderBets);
      
      this.logger.success(`✅ Bet placed on-chain! BetId: ${onChainBetId}, TxHash: ${tx.hash}`);
      
      return { betId: onChainBetId, txHash: tx.hash };
    } catch (error: any) {
      this.logger.error('Failed to place bet:', error);
      throw new Error(`Failed to place bet: ${error.message}`);
    }
  }
  
  /**
   * Sync bet from blockchain to local storage
   */
  async syncBetFromChain(betId: string, chain: ChainType = 'base'): Promise<OneTapBet> {
    try {
      // Get chain-specific config
      const { contract } = this.getChainConfig(chain);

      const betData = await contract.getBet(betId);
      
      const bet: OneTapBet = {
        betId: betData.id.toString(),
        trader: betData.trader.toLowerCase(),
        symbol: betData.symbol,
        betAmount: ethers.formatUnits(betData.betAmount, 6),
        targetPrice: ethers.formatUnits(betData.targetPrice, 8),
        targetTime: Number(betData.targetTime),
        entryPrice: ethers.formatUnits(betData.entryPrice, 8),
        entryTime: Number(betData.entryTime),
        multiplier: Number(betData.multiplier),
        status: this.mapStatus(Number(betData.status)),
        settledAt: betData.settledAt > 0 ? Number(betData.settledAt) : undefined,
        settlePrice: betData.settlePrice > 0 ? ethers.formatUnits(betData.settlePrice, 8) : undefined,
        chain: chain,
        createdAt: Date.now(),
      };

      // Use composite key: chain-betId
      const compositeKey = `${chain}-${betId}`;

      // Store in memory
      this.bets.set(compositeKey, bet);

      // Index by trader
      const traderBets = this.betsByTrader.get(bet.trader) || [];
      if (!traderBets.includes(compositeKey)) {
        traderBets.push(compositeKey);
        this.betsByTrader.set(bet.trader, traderBets);
      }
      
      return bet;
    } catch (error: any) {
      this.logger.error(`Failed to sync bet ${betId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get bet by ID (from memory or fetch from chain)
   * If betId is composite (chain-id), extract chain. Otherwise search all chains.
   */
  async getBet(betId: string): Promise<OneTapBet | null> {
    // Check if betId is composite key (chain-id format)
    if (betId.includes('-')) {
      const cachedBet = this.bets.get(betId);
      if (cachedBet) {
        return cachedBet;
      }
      // Extract chain and id
      const [chain, id] = betId.split('-');
      try {
        return await this.syncBetFromChain(id, chain as ChainType);
      } catch (error) {
        this.logger.error(`Failed to get bet ${betId}:`, error);
        return null;
      }
    }

    // Check memory with composite keys (search all chains)
    const baseKey = `base-${betId}`;
    const flowKey = `flow-${betId}`;

    const baseBet = this.bets.get(baseKey);
    if (baseBet) return baseBet;

    const flowBet = this.bets.get(flowKey);
    if (flowBet) return flowBet;

    // Try fetching from both chains
    try {
      return await this.syncBetFromChain(betId, 'base');
    } catch {
      try {
        return await this.syncBetFromChain(betId, 'flow');
      } catch (error) {
        this.logger.error(`Failed to get bet ${betId}:`, error);
        return null;
      }
    }
  }
  
  /**
   * Query bets with filters
   */
  async queryBets(query: GetOneTapBetsQuery): Promise<OneTapBet[]> {
    let bets = Array.from(this.bets.values());

    // Filter by trader
    if (query.trader) {
      const trader = query.trader.toLowerCase();
      const compositeKeys = this.betsByTrader.get(trader) || [];
      // betsByTrader now contains composite keys, so filter by checking if composite key exists
      bets = bets.filter(b => {
        const compositeKey = `${b.chain || 'base'}-${b.betId}`;
        return compositeKeys.includes(compositeKey);
      });
    }

    // Filter by symbol
    if (query.symbol) {
      bets = bets.filter(b => b.symbol === query.symbol);
    }

    // Filter by status
    if (query.status) {
      bets = bets.filter(b => b.status === query.status);
    }

    // Filter by chain
    if (query.chain) {
      bets = bets.filter(b => b.chain === query.chain);
    }

    return bets.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * Get all active bets (for monitoring)
   */
  getActiveBets(): OneTapBet[] {
    return Array.from(this.bets.values())
      .filter(b => b.status === OneTapBetStatus.ACTIVE)
      .sort((a, b) => a.targetTime - b.targetTime);
  }
  
  /**
   * Calculate multiplier (calls smart contract)
   * Uses Base chain by default as it's a pure calculation (same logic on both chains)
   */
  async calculateMultiplier(request: CalculateMultiplierRequest, chain: ChainType = 'base'): Promise<CalculateMultiplierResponse> {
    try {
      // Get chain-specific config
      const { contract } = this.getChainConfig(chain);

      // Fix floating point precision issues
      const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);
      const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);

      const entryPrice = ethers.parseUnits(entryPriceFixed, 8);
      const targetPrice = ethers.parseUnits(targetPriceFixed, 8);

      const multiplier = await contract.calculateMultiplier(
        entryPrice,
        targetPrice,
        request.entryTime,
        request.targetTime
      );
      
      // Calculate price distance
      const entryNum = parseFloat(request.entryPrice);
      const targetNum = parseFloat(request.targetPrice);
      const priceDistance = ((Math.abs(targetNum - entryNum) / entryNum) * 100).toFixed(2);
      
      // Calculate time distance
      const timeDistance = request.targetTime - request.entryTime;
      
      return {
        multiplier: Number(multiplier),
        priceDistance: `${priceDistance}%`,
        timeDistance,
      };
    } catch (error: any) {
      this.logger.error('Failed to calculate multiplier:', error);
      throw new Error(`Failed to calculate multiplier: ${error.message}`);
    }
  }
  
  /**
   * Get statistics
   */
  getStats(): OneTapProfitStats {
    const bets = Array.from(this.bets.values());
    
    return {
      totalBets: bets.length,
      activeBets: bets.filter(b => b.status === OneTapBetStatus.ACTIVE).length,
      wonBets: bets.filter(b => b.status === OneTapBetStatus.WON).length,
      lostBets: bets.filter(b => b.status === OneTapBetStatus.LOST).length,
      totalVolume: bets.reduce((sum, b) => sum + parseFloat(b.betAmount), 0).toFixed(6),
      totalPayout: '0', // TODO: Calculate from won bets
    };
  }
  
  /**
   * Get contract address for specified chain
   */
  getContractAddress(chain: ChainType = 'base'): string {
    const { contractAddress } = this.getChainConfig(chain);
    return contractAddress;
  }
  
  /**
   * Settle bet on-chain (bet already placed, just settle)
   * Called by monitor when WIN/LOSE conditions are met
   */
  async settleBet(betId: string, currentPrice: string, currentTime: number, won: boolean, chain: ChainType = 'base'): Promise<void> {
    try {
      // Get chain-specific config
      const { contract } = this.getChainConfig(chain);

      // Get composite key
      const compositeKey = `${chain}-${betId}`;

      // Get bet from memory using composite key
      const bet = this.bets.get(compositeKey);
      if (!bet) {
        this.logger.warn(`Bet ${compositeKey} not found in memory, trying to fetch from chain...`);
        // Try to sync from chain first
        const syncedBet = await this.syncBetFromChain(betId, chain);
        if (!syncedBet) {
          throw new Error(`Bet ${compositeKey} not found`);
        }
      }

      this.logger.info(`🔄 Settling bet ${betId} on ${chain}... (${won ? 'WON' : 'LOST'})`);
      
      // Check relayer wallet balance before settlement
      const { wallet, contractAddress } = this.getChainConfig(chain);
      try {
        const balance = await wallet.provider.getBalance(wallet.address);
        const balanceInEth = ethers.formatEther(balance);
        this.logger.info(`💰 Relayer balance on ${chain}: ${balanceInEth} ETH/FLOW`);
        
        if (balance === 0n) {
          throw new Error(`Relayer wallet has ZERO balance on ${chain}! Cannot send transaction.`);
        }
        
        if (parseFloat(balanceInEth) < 0.001) {
          this.logger.warn(`⚠️ Low relayer balance on ${chain}: ${balanceInEth} ETH/FLOW`);
        }
      } catch (balanceError: any) {
        this.logger.error(`Failed to check relayer balance on ${chain}:`, balanceError.message);
      }

      // Optimistically update status in memory BEFORE on-chain settlement for faster UI updates
      const betToUpdate = this.bets.get(compositeKey);
      const previousStatus = betToUpdate?.status;
      if (betToUpdate) {
        betToUpdate.status = won ? OneTapBetStatus.WON : OneTapBetStatus.LOST;
      }

      // Fix floating point precision - round to 8 decimals
      const currentPriceFixed = parseFloat(currentPrice).toFixed(8);
      const priceInUnits = ethers.parseUnits(currentPriceFixed, 8);

      try {
        this.logger.info(`📤 Sending settleBet transaction to ${contractAddress}...`);
        this.logger.info(`   Parameters: betId=${betId}, price=${currentPriceFixed}, time=${currentTime}, won=${won}`);
        
        // Settle bet on-chain
        const tx = await contract.settleBet(
          betId,
          priceInUnits,
          currentTime,
          won
        );

        this.logger.info(`⏳ Waiting for settlement: ${tx.hash}`);
        await tx.wait();

        this.logger.success(`✅ Bet ${betId} settled on ${chain}! TxHash: ${tx.hash}`);

        // Add tx hash to bet after successful settlement
        if (betToUpdate) {
          (betToUpdate as any).settleTxHash = tx.hash;
        }
      } catch (error) {
        // Rollback status on error
        if (betToUpdate && previousStatus) {
          betToUpdate.status = previousStatus;
        }
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`Failed to settle bet ${betId} on ${chain}:`, error);
      throw error;
    }
  }
  
  /**
   * Map on-chain status to enum
   */
  private mapStatus(status: number): OneTapBetStatus {
    switch (status) {
      case 0: return OneTapBetStatus.ACTIVE;
      case 1: return OneTapBetStatus.WON;
      case 2: return OneTapBetStatus.LOST;
      case 3: return OneTapBetStatus.CANCELLED;
      default: return OneTapBetStatus.ACTIVE;
    }
  }
}
