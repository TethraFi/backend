/**
 * Relay Service for Gasless Transactions
 * 
 * Allows users to pay gas in USDC instead of ETH
 * Backend relays transactions and charges USDC from paymaster deposits
 */

import { ethers, Contract } from 'ethers';
import { Logger } from '../utils/Logger';
import { getChainConfig, type ChainType, type ChainConfig } from '../config/chains';

export class RelayService {
  private logger: Logger;
  private provider: ethers.JsonRpcProvider;
  private relayWallet: ethers.Wallet;
  private paymasterContract: Contract;

  // Flow chain provider and wallet (initialized on demand)
  private flowProvider?: ethers.JsonRpcProvider;
  private flowWallet?: ethers.Wallet;

  // Contract addresses (from .env) - Base chain
  private PAYMASTER_ADDRESS: string;
  private MARKET_EXECUTOR_ADDRESS: string;
  private LIMIT_EXECUTOR_ADDRESS: string;
  private POSITION_MANAGER_ADDRESS: string;
  private TREASURY_MANAGER_ADDRESS: string;
  
  constructor() {
    this.logger = new Logger('RelayService');
    
    // Initialize provider
    const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Initialize relay wallet (backend wallet that pays gas)
    const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;
    if (!RELAY_PRIVATE_KEY) {
      throw new Error('RELAY_PRIVATE_KEY not configured');
    }
    this.relayWallet = new ethers.Wallet(RELAY_PRIVATE_KEY, this.provider);
    
    // Contract addresses - Use BASE chain config as default
    const baseConfig = getChainConfig('base');
    this.PAYMASTER_ADDRESS = baseConfig.contracts.usdcPaymaster;
    this.MARKET_EXECUTOR_ADDRESS = baseConfig.contracts.marketExecutor;
    this.LIMIT_EXECUTOR_ADDRESS = baseConfig.contracts.limitExecutorV2;
    this.POSITION_MANAGER_ADDRESS = baseConfig.contracts.positionManager;
    this.TREASURY_MANAGER_ADDRESS = baseConfig.contracts.treasuryManager;
    
    if (!this.PAYMASTER_ADDRESS || !this.MARKET_EXECUTOR_ADDRESS || !this.LIMIT_EXECUTOR_ADDRESS || !this.POSITION_MANAGER_ADDRESS || !this.TREASURY_MANAGER_ADDRESS) {
      throw new Error('Contract addresses not configured in chains.ts');
    }
    
    // Initialize paymaster contract
    const paymasterABI = [
      'function validateGasPayment(address user, uint256 estimatedGas) view returns (bool)',
      'function processGasPayment(address user, uint256 gasUsed) returns (uint256)',
      'function userDeposits(address) view returns (uint256)',
      'function calculateUsdcCost(uint256 gasAmount) view returns (uint256)'
    ];
    
    this.paymasterContract = new Contract(
      this.PAYMASTER_ADDRESS,
      paymasterABI,
      this.relayWallet
    );
    
    this.logger.info('🔄 Relay Service initialized');
    this.logger.info(`   Relay Wallet: ${this.relayWallet.address}`);
  }

  /**
   * Get chain-specific configuration (provider, wallet, contracts)
   */
  private getChainConfig(chain: 'base' | 'flow'): {
    provider: ethers.JsonRpcProvider;
    wallet: ethers.Wallet;
    positionManagerAddress: string;
    chainConfig: ChainConfig;
  } {
    if (chain === 'flow') {
      // Initialize Flow provider and wallet if not already done
      if (!this.flowProvider) {
        const flowConfig = getChainConfig('flow');
        this.flowProvider = new ethers.JsonRpcProvider(flowConfig.rpcUrl);
        this.logger.info(`🌊 Flow provider initialized: ${flowConfig.rpcUrl}`);
      }

      if (!this.flowWallet) {
        const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;
        if (!RELAY_PRIVATE_KEY) {
          throw new Error('RELAY_PRIVATE_KEY not configured');
        }
        this.flowWallet = new ethers.Wallet(RELAY_PRIVATE_KEY, this.flowProvider);
        this.logger.info(`🌊 Flow relay wallet: ${this.flowWallet.address}`);
      }

      const flowConfig = getChainConfig('flow');
      return {
        provider: this.flowProvider,
        wallet: this.flowWallet,
        positionManagerAddress: flowConfig.contracts.positionManager,
        chainConfig: flowConfig,
      };
    }

    // Default: Base chain
    const baseConfig = getChainConfig('base');
    return {
      provider: this.provider,
      wallet: this.relayWallet,
      positionManagerAddress: this.POSITION_MANAGER_ADDRESS,
      chainConfig: baseConfig,
    };
  }

  /**
   * Check if user can pay for gas via paymaster
   */
  async canUserPayGas(userAddress: string, estimatedGas: bigint): Promise<boolean> {
    try {
      const canPay = await this.paymasterContract.validateGasPayment(
        userAddress,
        estimatedGas
      );
      return canPay;
    } catch (error) {
      this.logger.error('Error checking gas payment:', error);
      return false;
    }
  }
  
  /**
   * Get user's USDC deposit balance in paymaster
   */
  async getUserDeposit(userAddress: string): Promise<bigint> {
    try {
      const deposit = await this.paymasterContract.userDeposits(userAddress);
      return deposit;
    } catch (error) {
      this.logger.error('Error getting user deposit:', error);
      return 0n;
    }
  }
  
  /**
   * Calculate USDC cost for estimated gas
  */
  async calculateGasCost(estimatedGas: bigint): Promise<bigint> {
    try {
      const usdcCost = await this.paymasterContract.calculateUsdcCost(estimatedGas);
      return usdcCost;
    } catch (error) {
      this.logger.warn('⚠️  Paymaster unavailable, using fallback gas calculation');
      // FALLBACK: Rough estimate for Base Sepolia
      // Assume: 0.001 Gwei gas price, 1 ETH = 3000 USDC
      // Gas cost in ETH = estimatedGas * gasPrice
      // Gas cost in USDC = Gas cost in ETH * ETH price
      
      // Base Sepolia typical gas price: ~0.001 Gwei = 1000000 wei
      const gasPriceWei = 1000000n; // 0.001 Gwei
      const gasCostWei = estimatedGas * gasPriceWei;
      
      // Convert Wei to ETH (1 ETH = 10^18 Wei)
      // Then ETH to USDC (assume 3000 USDC per ETH)
      // Then to USDC base units (6 decimals)
      // Formula: (gasCostWei * 3000 * 10^6) / 10^18
      //        = (gasCostWei * 3000) / 10^12
      const usdcCost = (gasCostWei * 3000n) / 1000000000000n;
      
      // Minimum 0.01 USDC to cover small transactions
      const minCost = 10000n; // 0.01 USDC (6 decimals)
      return usdcCost > minCost ? usdcCost : minCost;
    }
  }
  
  /**
   * Relay a transaction (pay gas with backend wallet, charge user USDC)
   * NOTE: For meta-transactions, data should already be encoded with user signature
   */
  async relayTransaction(
    to: string,
    data: string,
    userAddress: string,
    value: bigint = 0n,
    chain: 'base' | 'flow' = 'base'
  ): Promise<{ txHash: string; gasUsed: bigint; usdcCharged: bigint; positionId?: number }> {
    try {
      this.logger.info(`🔄 Relaying meta-transaction for ${userAddress} on ${chain} chain`);
      this.logger.info(`   Relayer: ${this.relayWallet.address}`);
      this.logger.info(`   Target: ${to}`);

      // Get chain-specific provider and wallet
      const { provider, wallet, positionManagerAddress } = this.getChainConfig(chain);

      // Estimate gas (from relayer address)
      const gasEstimate = await provider.estimateGas({
        from: wallet.address,
        to,
        data,
        value
      });
      
      this.logger.info(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      
      // Check if user can pay
      const canPay = await this.canUserPayGas(userAddress, gasEstimate);
      if (!canPay) {
        throw new Error('User has insufficient USDC deposit for gas');
      }
      
      // Calculate USDC cost
      const usdcCost = await this.calculateGasCost(gasEstimate);
      this.logger.info(`💵 USDC cost for user: ${usdcCost.toString()}`);

      // Send transaction (relayer pays gas in ETH) - use chain-specific wallet
      const tx = await wallet.sendTransaction({
        to,
        data,
        value,
        gasLimit: gasEstimate * 120n / 100n // 20% buffer
      });

      this.logger.info(`📤 Meta-transaction sent on ${chain}: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      this.logger.info(`✅ Meta-transaction confirmed on ${chain}: ${receipt.hash}`);
      this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
      this.logger.info(`   Gas price: ${receipt.gasPrice?.toString() || 'N/A'}`);

      // Try to extract positionId from PositionOpened event
      let positionId: number | undefined;
      try {
        // PositionOpened event signature - positionId and trader are indexed
        const positionOpenedTopic = ethers.id('PositionOpened(uint256,address,string,bool,uint256,uint256,uint256,uint256)');
        this.logger.info(`🔍 Looking for PositionOpened event...`);
        this.logger.info(`   Expected topic: ${positionOpenedTopic}`);
        this.logger.info(`   Total logs: ${receipt.logs.length}`);

        for (const log of receipt.logs) {
          this.logger.info(`   Log from: ${log.address}, topic[0]: ${log.topics[0]}`);
          // Check if log is from PositionManager contract (use chain-specific address)
          if (log.address.toLowerCase() === positionManagerAddress.toLowerCase() && 
              log.topics[0] === positionOpenedTopic) {
            if (log.topics.length > 1) {
              // Parse position ID from indexed parameter (topic[1])
              positionId = parseInt(log.topics[1], 16);
              this.logger.info(`🎯 Extracted position ID from event: ${positionId}`);
              break;
            } else {
              this.logger.warn('⚠️ Found PositionOpened event but no indexed positionId');
            }
          }
        }
        
        if (!positionId) {
          this.logger.warn('⚠️ No PositionOpened event found in receipt');
        }
      } catch (err) {
        this.logger.warn('⚠️ Could not extract position ID from receipt:', err);
      }
      
      // Charge user USDC via paymaster
      // TODO: Implement full paymaster integration with proper nonce management
      // For now, skip charging to avoid nonce collision
      const gasUsed = receipt.gasUsed;
      // const gasCost = gasUsed * (receipt.gasPrice || 0n);
      
      // this.logger.info(`💰 Charging user ${userAddress} for gas...`);
      // const chargeTx = await this.paymasterContract.processGasPayment(
      //   userAddress,
      //   gasCost
      // );
      // 
      // await chargeTx.wait();
      // 
      // this.logger.success(`✅ Charged user ${usdcCost.toString()} USDC for gas`);
      
      this.logger.info(`💰 Gas cost: ${usdcCost.toString()} USDC (not charged - paymaster disabled for now)`);
      
      return {
        txHash: receipt.hash,
        gasUsed,
        usdcCharged: usdcCost,
        positionId
      };
      
    } catch (error) {
      this.logger.error('Error relaying meta-transaction:', error);
      throw error;
    }
  }
  
  /**
   * HACKATHON MODE: Close position gaslessly (relayer pays gas)
   * Now supports multi-chain!
   */
  async closePositionGasless(
    userAddress: string,
    positionId: string,
    symbol: string,
    chain: 'base' | 'flow' = 'base'
  ): Promise<{ txHash: string }> {
    try {
      this.logger.info(`🔥 GASLESS CLOSE: Position ${positionId} for ${userAddress} on ${chain} chain`);

      // Get chain-specific configuration
      const { provider, wallet, positionManagerAddress } = this.getChainConfig(chain);
      const chainConfig = getChainConfig(chain);
      const treasuryManagerAddress = chainConfig.contracts.treasuryManager;

      // Get price from local backend API
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      const priceResponse = await fetch(`${backendUrl}/api/price/signed/${symbol}`);
      if (!priceResponse.ok) {
        throw new Error(`Failed to get price for ${symbol}`);
      }
      const priceData: any = await priceResponse.json();
      const signedPrice = priceData.data;

      this.logger.info(`   🔥 CALLING POSITIONMANAGER DIRECTLY (with fee split!)`);

      // First, get position details to calculate settlement
      const positionIface = new ethers.Interface([
        'function getPosition(uint256) view returns (tuple(uint256 id, address trader, string symbol, bool isLong, uint256 collateral, uint256 size, uint256 leverage, uint256 entryPrice, uint256 openTimestamp, uint8 status))',
        'function calculatePnL(uint256, uint256) view returns (int256)'
      ]);

      const positionContract = new Contract(
        positionManagerAddress,
        positionIface,
        provider
      );
      
      const positionData = await positionContract.getPosition(BigInt(positionId));
      const position = {
        id: positionData[0],
        trader: positionData[1],
        symbol: positionData[2],
        isLong: positionData[3],
        collateral: positionData[4],
        size: positionData[5],
        leverage: positionData[6],
        entryPrice: positionData[7],
        openTimestamp: positionData[8],
        status: positionData[9]
      };
      const pnl = await positionContract.calculatePnL(BigInt(positionId), BigInt(signedPrice.price));
      
      this.logger.info(`   📊 Position details:`);
      this.logger.info(`   - Collateral: ${position.collateral.toString()}`);
      this.logger.info(`   - Size: ${position.size.toString()}`);
      this.logger.info(`   - Leverage: ${position.leverage.toString()}`);
      this.logger.info(`   - PnL: ${pnl.toString()}`);
      
      // Call PositionManager.closePosition DIRECTLY
      const closeIface = new ethers.Interface([
        'function closePosition(uint256 positionId, uint256 exitPrice)'
      ]);
      
      const closeData = closeIface.encodeFunctionData('closePosition', [
        BigInt(positionId),
        BigInt(signedPrice.price)
      ]);
      
      const tx = await wallet.sendTransaction({
        to: positionManagerAddress,
        data: closeData,
        gasLimit: 500000n
      });
      
      this.logger.info(`📤 Close TX sent: ${tx.hash}`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }
      
      this.logger.success(`✅ Position ${positionId} CLOSED! TX: ${receipt.hash}`);
      
      // Wait 2 seconds for nonce to update
      this.logger.info('⏳ Waiting for nonce to update...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Calculate settlement with fee split
      // Fee is 0.05% of COLLATERAL (not size!)
      const TRADING_FEE_BPS = 5n; // 0.05%
      const tradingFee = (position.collateral * TRADING_FEE_BPS) / 10000n;
      
      // Split fee: 20% to relayer (0.01% of collateral), 80% to treasury (0.04% of collateral)
      const relayerFee = (tradingFee * 2000n) / 10000n; // 20% of total fee = 0.01% of collateral
      const treasuryFee = tradingFee - relayerFee; // 80% of total fee = 0.04% of collateral
      
      this.logger.info(`💰 Fee breakdown (from collateral):`);
      this.logger.info(`   Collateral: ${(Number(position.collateral) / 1e6).toFixed(6)} USDC`);
      this.logger.info(`   Total fee: ${(Number(tradingFee) / 1e6).toFixed(6)} USDC (0.05% of collateral)`);
      this.logger.info(`   Relayer fee: ${(Number(relayerFee) / 1e6).toFixed(6)} USDC (0.01% of collateral)`);
      this.logger.info(`   Treasury fee: ${(Number(treasuryFee) / 1e6).toFixed(6)} USDC (0.04% of collateral)`);
      
      // Calculate refund amount
      let refundAmount: bigint;
      
      if (pnl >= 0) {
        // Profit: collateral + PnL - total fee
        refundAmount = position.collateral + BigInt(pnl) - tradingFee;
      } else {
        // Loss: collateral - abs(PnL) - total fee
        const absLoss = BigInt(-pnl);
        if (position.collateral > absLoss + tradingFee) {
          refundAmount = position.collateral - absLoss - tradingFee;
        } else {
          refundAmount = 0n; // Total loss
        }
      }
      
      this.logger.info(`💰 Settlement:`);
      this.logger.info(`   Refund to trader: ${refundAmount.toString()}`);
      
      // Execute settlement transactions
      const treasuryIface = new ethers.Interface([
        'function refundCollateral(address to, uint256 amount)',
        'function collectFee(address from, uint256 amount)'
      ]);
      
      const nonce = await provider.getTransactionCount(wallet.address, 'pending');

      // 1. Collect treasury fee
      if (treasuryFee > 0n) {
        const feeData = treasuryIface.encodeFunctionData('collectFee', [
          position.trader,
          treasuryFee
        ]);

        const feeTx = await wallet.sendTransaction({
          to: treasuryManagerAddress,
          data: feeData,
          gasLimit: 200000n,
          nonce: nonce
        });
        
        this.logger.info(`📤 Treasury fee TX: ${feeTx.hash}`);
        await feeTx.wait();
        this.logger.success(`✅ Treasury fee collected: ${treasuryFee.toString()}`);
      }
      
      // 2. Transfer relayer fee to relayer wallet
      if (relayerFee > 0n) {
        const usdcIface = new ethers.Interface([
          'function transfer(address to, uint256 amount)'
        ]);

        const relayerFeeData = usdcIface.encodeFunctionData('transfer', [
          wallet.address,
          relayerFee
        ]);

        const relayerFeeTx = await wallet.sendTransaction({
          to: treasuryManagerAddress,
          data: treasuryIface.encodeFunctionData('refundCollateral', [
            wallet.address,
            relayerFee
          ]),
          gasLimit: 200000n,
          nonce: nonce + 1
        });
        
        this.logger.info(`📤 Relayer fee TX: ${relayerFeeTx.hash}`);
        await relayerFeeTx.wait();
        this.logger.success(`✅ Relayer fee paid: ${relayerFee.toString()}`);
      }
      
      // 3. Refund to trader
      if (refundAmount > 0n) {
        const refundData = treasuryIface.encodeFunctionData('refundCollateral', [
          position.trader,
          refundAmount
        ]);

        const refundTx = await wallet.sendTransaction({
          to: treasuryManagerAddress,
          data: refundData,
          gasLimit: 200000n,
          nonce: nonce + 2
        });
        
        this.logger.info(`📤 Refund TX: ${refundTx.hash}`);
        await refundTx.wait();
        this.logger.success(`✅ Refunded ${refundAmount.toString()} to trader!`);
      }
      
      return {
        txHash: receipt.hash
      };
      
    } catch (error) {
      this.logger.error('Error closing position gasless:', error);
      throw error;
    }
  }
  
  /**
   * GASLESS CANCEL ORDER - Keeper pays gas (Multi-Chain Support)
   */
  async cancelOrderGasless(
    userAddress: string,
    orderId: string,
    userSignature: string,
    chain: 'base' | 'flow' = 'base'
  ): Promise<{ txHash: string }> {
    try {
      this.logger.info(`❌ GASLESS CANCEL: Order ${orderId} for ${userAddress} on ${chain}`);

      // Get chain-specific config
      const { provider, wallet, chainConfig } = this.getChainConfig(chain);
      const limitExecutorAddress = chainConfig.contracts.limitExecutorV2;

      // Get user's current nonce from the correct chain
      const limitExecutorContract = new Contract(
        limitExecutorAddress,
        ['function getUserCurrentNonce(address) view returns (uint256)'],
        provider
      );

      const userNonce = await limitExecutorContract.getUserCurrentNonce(userAddress);
      this.logger.info(`   User nonce on ${chain}: ${userNonce.toString()}`);

      // Call LimitExecutor.cancelOrderGasless
      const iface = new ethers.Interface([
        'function cancelOrderGasless(address trader, uint256 orderId, uint256 nonce, bytes calldata userSignature)'
      ]);

      const data = iface.encodeFunctionData('cancelOrderGasless', [
        userAddress,
        BigInt(orderId),
        userNonce,
        userSignature
      ]);

      this.logger.info(`   🔥 Calling cancelOrderGasless on ${chain} (keeper pays gas)`);

      const tx = await wallet.sendTransaction({
        to: limitExecutorAddress,
        data: data,
        gasLimit: 200000n
      });

      this.logger.info(`📤 Cancel TX sent on ${chain}: ${tx.hash}`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      this.logger.success(`✅ Order ${orderId} CANCELLED on ${chain}! TX: ${receipt.hash}`);

      return {
        txHash: receipt.hash
      };

    } catch (error) {
      this.logger.error(`Error cancelling order gasless on ${chain}:`, error);
      throw error;
    }
  }

  /**
   * Check relay wallet balance
   */
  async getRelayBalance(): Promise<{ eth: bigint; ethFormatted: string }> {
    const balance = await this.provider.getBalance(this.relayWallet.address);
    return {
      eth: balance,
      ethFormatted: ethers.formatEther(balance)
    };
  }
}
