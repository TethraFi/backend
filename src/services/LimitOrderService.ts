import { ethers, Contract } from 'ethers';
import { Logger } from '../utils/Logger';
import LimitExecutorV2Artifact from '../abis/LimitExecutorV2.json';
import { ChainType, getChainConfig } from '../config/chains';

export interface KeeperLimitOpenOrderRequest {
  trader: string;
  symbol: string;
  isLong: boolean;
  collateral: string; // base units (USDC 6 decimals)
  leverage: string; // integer string
  triggerPrice: string; // base units (8 decimals)
  nonce: string;
  expiresAt: string;
  signature: string;
  takeProfit?: string; // optional TP price (8 decimals)
  stopLoss?: string; // optional SL price (8 decimals)
  chain?: ChainType; // Optional: defaults to 'base'
  metadata?: {
    collateralUsd?: string;
    triggerPriceUsd?: string;
  };
}

export interface KeeperLimitOrderResponse {
  orderId: string;
  txHash: string;
}

export class LimitOrderService {
  private readonly logger = new Logger('LimitOrderService');
  private readonly baseProvider: ethers.JsonRpcProvider;
  private readonly flowProvider: ethers.JsonRpcProvider;
  private readonly baseWallet: ethers.Wallet;
  private readonly flowWallet: ethers.Wallet;
  // Store TP/SL preferences for pending limit orders
  private orderTPSLMap: Map<string, { takeProfit?: bigint; stopLoss?: bigint }> = new Map();

  constructor() {
    const keeperPrivateKey = process.env.RELAY_PRIVATE_KEY;
    if (!keeperPrivateKey) {
      throw new Error('RELAY_PRIVATE_KEY not configured');
    }

    // Initialize Base chain
    const baseConfig = getChainConfig('base');
    this.baseProvider = new ethers.JsonRpcProvider(baseConfig.rpcUrl);
    this.baseWallet = new ethers.Wallet(keeperPrivateKey, this.baseProvider);

    // Initialize Flow chain
    const flowConfig = getChainConfig('flow');
    this.flowProvider = new ethers.JsonRpcProvider(flowConfig.rpcUrl);
    this.flowWallet = new ethers.Wallet(keeperPrivateKey, this.flowProvider);

    this.logger.info('🔄 LimitOrderService initialized (Multi-Chain)');
    this.logger.info(`   Keeper wallet: ${this.baseWallet.address}`);
    this.logger.info(`   Base LimitExecutorV2: ${baseConfig.contracts.limitExecutorV2}`);
    this.logger.info(`   Flow LimitExecutorV2: ${flowConfig.contracts.limitExecutorV2}`);
  }

  /**
   * Get chain-specific configuration
   */
  private getChainConfig(chain: ChainType = 'base') {
    const chainConfig = getChainConfig(chain);
    const provider = chain === 'flow' ? this.flowProvider : this.baseProvider;
    const wallet = chain === 'flow' ? this.flowWallet : this.baseWallet;
    const limitExecutorAddress = chainConfig.contracts.limitExecutorV2;

    const limitExecutor = new Contract(
      limitExecutorAddress,
      (LimitExecutorV2Artifact as { abi: any }).abi,
      wallet
    );

    return { provider, wallet, limitExecutor, limitExecutorAddress, chainConfig };
  }

  private normalizeBigNumberish(value: string, label: string): bigint {
    try {
      return BigInt(value);
    } catch (error) {
      throw new Error(`Invalid ${label} value: ${value}`);
    }
  }

  async getNextOrderId(chain: ChainType = 'base'): Promise<bigint> {
    const { limitExecutor } = this.getChainConfig(chain);
    const nextId = await limitExecutor.nextOrderId();
    return BigInt(nextId);
  }

  async createLimitOpenOrder(request: KeeperLimitOpenOrderRequest): Promise<KeeperLimitOrderResponse> {
    const {
      trader,
      symbol,
      isLong,
      collateral,
      leverage,
      triggerPrice,
      nonce,
      expiresAt,
      signature,
      chain = 'base', // Default to base chain
      metadata,
    } = request;

    this.logger.info(`📝 Received limit order request`, {
      trader,
      symbol,
      isLong,
      leverage,
      collateral,
      triggerPrice,
      nonce,
      expiresAt,
      chain,
      metadata,
    });

    // Get chain-specific configuration
    const { limitExecutor, chainConfig } = this.getChainConfig(chain);

    const collateralBig = this.normalizeBigNumberish(collateral, 'collateral');
    const leverageBig = this.normalizeBigNumberish(leverage, 'leverage');
    const triggerPriceBig = this.normalizeBigNumberish(triggerPrice, 'triggerPrice');
    const nonceBig = this.normalizeBigNumberish(nonce, 'nonce');
    const expiresAtBig = this.normalizeBigNumberish(expiresAt, 'expiresAt');

    if (!signature || !signature.startsWith('0x')) {
      throw new Error('Invalid signature');
    }

    const nextOrderId = await this.getNextOrderId(chain);
    this.logger.info(`➡️  Next order id on ${chain}: ${nextOrderId.toString()}`);

    // Store TP/SL preferences if provided (use chain-specific key)
    if (request.takeProfit || request.stopLoss) {
      const tpslData: { takeProfit?: bigint; stopLoss?: bigint } = {};
      if (request.takeProfit) {
        tpslData.takeProfit = this.normalizeBigNumberish(request.takeProfit, 'takeProfit');
      }
      if (request.stopLoss) {
        tpslData.stopLoss = this.normalizeBigNumberish(request.stopLoss, 'stopLoss');
      }
      // Store with chain prefix to avoid ID collision between chains
      this.orderTPSLMap.set(`${chain}-${nextOrderId.toString()}`, tpslData);
      this.logger.info(`💾 Stored TP/SL for order ${nextOrderId} on ${chain}:`, {
        takeProfit: request.takeProfit,
        stopLoss: request.stopLoss,
      });
    }

    const tx = await limitExecutor.createLimitOpenOrder(
      trader,
      symbol,
      isLong,
      collateralBig,
      leverageBig,
      triggerPriceBig,
      nonceBig,
      expiresAtBig,
      signature
    );

    this.logger.info(`📤 Submitted createLimitOpenOrder tx on ${chain}: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    this.logger.success(`✅ Limit order created on ${chain}`, {
      orderId: nextOrderId.toString(),
      txHash: tx.hash,
      explorer: `${chainConfig.explorerUrl}/tx/${tx.hash}`,
    });

    return {
      orderId: nextOrderId.toString(),
      txHash: tx.hash,
    };
  }

  /**
   * Get stored TP/SL for a limit order
   */
  getOrderTPSL(orderId: string, chain: ChainType = 'base'): { takeProfit?: bigint; stopLoss?: bigint } | undefined {
    return this.orderTPSLMap.get(`${chain}-${orderId}`);
  }

  /**
   * Remove TP/SL data after order is executed or cancelled
   */
  clearOrderTPSL(orderId: string, chain: ChainType = 'base'): void {
    this.orderTPSLMap.delete(`${chain}-${orderId}`);
  }
}
