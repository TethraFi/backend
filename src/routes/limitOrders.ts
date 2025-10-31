import { Router, Request, Response } from 'express';
import { LimitOrderService, KeeperLimitOpenOrderRequest } from '../services/LimitOrderService';
import { Logger } from '../utils/Logger';
import { ChainType, getChainConfig } from '../config/chains';

const logger = new Logger('LimitOrderRoute');

export function createLimitOrderRoute(limitOrderService: LimitOrderService) {
  const router = Router();

  router.post('/create', async (req: Request, res: Response) => {
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
      takeProfit,
      stopLoss,
      chain, // NEW: chain parameter
      metadata,
    } = req.body ?? {};

    if (!trader || typeof trader !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid trader address',
        timestamp: Date.now(),
      });
    }

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid symbol',
        timestamp: Date.now(),
      });
    }

    if (typeof isLong !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid isLong flag',
        timestamp: Date.now(),
      });
    }

    const numericFields = {
      collateral,
      leverage,
      triggerPrice,
      nonce,
      expiresAt,
    };

    for (const [key, value] of Object.entries(numericFields)) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
        return res.status(400).json({
          success: false,
          error: `Invalid ${key} value`,
          timestamp: Date.now(),
        });
      }
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature',
        timestamp: Date.now(),
      });
    }

    // Validate chain parameter
    const selectedChain: ChainType = chain === 'flow' ? 'flow' : 'base'; // Default to base
    if (chain && chain !== 'base' && chain !== 'flow') {
      return res.status(400).json({
        success: false,
        error: 'Invalid chain parameter. Must be "base" or "flow"',
        timestamp: Date.now(),
      });
    }

    const payload: KeeperLimitOpenOrderRequest = {
      trader,
      symbol,
      isLong,
      collateral: String(collateral),
      leverage: String(leverage),
      triggerPrice: String(triggerPrice),
      nonce: String(nonce),
      expiresAt: String(expiresAt),
      signature,
      takeProfit: takeProfit ? String(takeProfit) : undefined,
      stopLoss: stopLoss ? String(stopLoss) : undefined,
      chain: selectedChain, // Add chain to payload
      metadata,
    };

    try {
      const result = await limitOrderService.createLimitOpenOrder(payload);

      // Get correct explorer URL based on chain
      const chainConfig = getChainConfig(selectedChain);
      const explorerUrl = `${chainConfig.explorerUrl}/tx/${result.txHash}`;

      res.json({
        success: true,
        data: {
          ...result,
          explorerUrl,
          chain: selectedChain, // Return chain info
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to create limit order', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create limit order',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
