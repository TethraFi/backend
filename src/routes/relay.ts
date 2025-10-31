import { Router, Request, Response } from 'express';
import { RelayService } from '../services/RelayService';
import { Logger } from '../utils/Logger';
import { getChainConfig } from '../config/chains';

const logger = new Logger('RelayRoute');

export function createRelayRoute(relayService: RelayService): Router {
  const router = Router();

  /**
   * Get user's paymaster deposit balance
   * GET /api/relay/balance/:address
   */
  router.get('/balance/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address format',
          timestamp: Date.now()
        });
      }

      const deposit = await relayService.getUserDeposit(address);
      
      res.json({
        success: true,
        data: {
          address,
          deposit: deposit.toString(),
          depositFormatted: (Number(deposit) / 1e6).toFixed(2) + ' USDC'
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting balance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get balance',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Calculate gas cost in USDC
   * POST /api/relay/calculate-cost
   * Body: { estimatedGas: string }
   */
  router.post('/calculate-cost', async (req: Request, res: Response) => {
    try {
      const { estimatedGas } = req.body;
      
      if (!estimatedGas) {
        return res.status(400).json({
          success: false,
          error: 'estimatedGas is required',
          timestamp: Date.now()
        });
      }

      const gasBigInt = BigInt(estimatedGas);
      const usdcCost = await relayService.calculateGasCost(gasBigInt);
      
      res.json({
        success: true,
        data: {
          estimatedGas: estimatedGas,
          usdcCost: usdcCost.toString(),
          usdcCostFormatted: (Number(usdcCost) / 1e6).toFixed(4) + ' USDC'
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error calculating cost:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate cost',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Relay a transaction (gasless)
   * POST /api/relay/transaction
   * Body: {
   *   to: string,
   *   data: string,
   *   userAddress: string,
   *   value?: string
   * }
   */
  router.post('/transaction', async (req: Request, res: Response) => {
    try {
      const { to, data, userAddress, value, chain } = req.body;

      // Validation
      if (!to || !data || !userAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['to', 'data', 'userAddress'],
          timestamp: Date.now()
        });
      }

      // Validate chain parameter
      const selectedChain = chain || 'base'; // Default to base for backward compatibility
      if (selectedChain !== 'base' && selectedChain !== 'flow') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chain parameter. Must be "base" or "flow"',
          timestamp: Date.now()
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "to" address format',
          timestamp: Date.now()
        });
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "userAddress" format',
          timestamp: Date.now()
        });
      }

      if (!/^0x[a-fA-F0-9]+$/.test(data)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid "data" format (must be hex string)',
          timestamp: Date.now()
        });
      }

      logger.info(`📨 Relay request from ${userAddress} to ${to} on ${selectedChain} chain`);

      // Relay the transaction
      const valueBigInt = value ? BigInt(value) : 0n;
      const result = await relayService.relayTransaction(
        to,
        data,
        userAddress,
        valueBigInt,
        selectedChain
      );

      logger.success(`✅ Transaction relayed on ${selectedChain}: ${result.txHash}`);

      // Get correct explorer URL based on chain
      const explorerUrl = selectedChain === 'flow'
        ? `https://evm-testnet.flowscan.io/tx/${result.txHash}`
        : `https://sepolia.basescan.org/tx/${result.txHash}`;

      res.json({
        success: true,
        data: {
          txHash: result.txHash,
          gasUsed: result.gasUsed.toString(),
          usdcCharged: result.usdcCharged.toString(),
          usdcChargedFormatted: (Number(result.usdcCharged) / 1e6).toFixed(4) + ' USDC',
          explorerUrl,
          positionId: result.positionId, // Position ID if extracted from event
          chain: selectedChain
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error relaying transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to relay transaction',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Check if user can afford gas
   * POST /api/relay/can-afford
   * Body: { userAddress: string, estimatedGas: string }
   */
  router.post('/can-afford', async (req: Request, res: Response) => {
    try {
      const { userAddress, estimatedGas } = req.body;
      
      if (!userAddress || !estimatedGas) {
        return res.status(400).json({
          success: false,
          error: 'userAddress and estimatedGas are required',
          timestamp: Date.now()
        });
      }

      const gasBigInt = BigInt(estimatedGas);
      const canPay = await relayService.canUserPayGas(userAddress, gasBigInt);
      const deposit = await relayService.getUserDeposit(userAddress);
      const required = await relayService.calculateGasCost(gasBigInt);
      
      res.json({
        success: true,
        data: {
          canAfford: canPay,
          userDeposit: deposit.toString(),
          requiredUsdc: required.toString(),
          depositFormatted: (Number(deposit) / 1e6).toFixed(2) + ' USDC',
          requiredFormatted: (Number(required) / 1e6).toFixed(4) + ' USDC'
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error checking affordability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check affordability',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * GASLESS CANCEL ORDER - HACKATHON MODE 🚀 (Multi-Chain)
   * POST /api/relay/cancel-order
   * Body: { userAddress: string, orderId: string, signature: string, chain?: string }
   */
  router.post('/cancel-order', async (req: Request, res: Response) => {
    try {
      const { userAddress, orderId, signature, chain } = req.body;

      if (!userAddress || !orderId || !signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['userAddress', 'orderId', 'signature'],
          timestamp: Date.now()
        });
      }

      // Validate and default chain
      const selectedChain = chain === 'flow' ? 'flow' : 'base';
      if (chain && chain !== 'base' && chain !== 'flow') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chain parameter. Must be "base" or "flow"',
          timestamp: Date.now()
        });
      }

      logger.info(`❌ GASLESS CANCEL: Order ${orderId} for user ${userAddress} on ${selectedChain}`);

      // Call RelayService to cancel order gaslessly with chain parameter
      const result = await relayService.cancelOrderGasless(
        userAddress,
        orderId,
        signature,
        selectedChain
      );

      logger.success(`✅ Order ${orderId} cancelled on ${selectedChain}! TX: ${result.txHash}`);

      // Get correct explorer URL based on chain
      const chainConfig = getChainConfig(selectedChain);
      const explorerUrl = `${chainConfig.explorerUrl}/tx/${result.txHash}`;

      res.json({
        success: true,
        data: {
          txHash: result.txHash,
          orderId: orderId,
          chain: selectedChain,
          explorerUrl
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error cancelling order gasless:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * GASLESS CLOSE POSITION - HACKATHON MODE 🚀
   * POST /api/relay/close-position
   * Body: { userAddress: string, positionId: string, symbol: string, chain?: string }
   */
  router.post('/close-position', async (req: Request, res: Response) => {
    try {
      const { userAddress, positionId, symbol, chain } = req.body;

      if (!userAddress || !positionId || !symbol) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['userAddress', 'positionId', 'symbol'],
          timestamp: Date.now()
        });
      }

      // Validate chain parameter
      const selectedChain = chain || 'base'; // Default to base for backward compatibility
      if (selectedChain !== 'base' && selectedChain !== 'flow') {
        return res.status(400).json({
          success: false,
          error: 'Invalid chain parameter. Must be "base" or "flow"',
          timestamp: Date.now()
        });
      }

      logger.info(`🔥 GASLESS CLOSE: Position ${positionId} for user ${userAddress} on ${selectedChain} chain`);

      // Relayer closes position directly (fuck security, this is hackathon!)
      const result = await relayService.closePositionGasless(
        userAddress,
        positionId,
        symbol,
        selectedChain
      );

      logger.success(`✅ Position ${positionId} closed on ${selectedChain}! TX: ${result.txHash}`);

      // Get correct explorer URL based on chain
      const explorerUrl = selectedChain === 'flow'
        ? `https://evm-testnet.flowscan.io/tx/${result.txHash}`
        : `https://sepolia.basescan.org/tx/${result.txHash}`;

      res.json({
        success: true,
        data: {
          txHash: result.txHash,
          positionId: positionId,
          explorerUrl,
          chain: selectedChain
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error closing position gasless:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to close position',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Get relay service status
   * GET /api/relay/status
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const balance = await relayService.getRelayBalance();
      
      res.json({
        success: true,
        data: {
          relayWalletBalance: balance.ethFormatted + ' ETH',
          status: parseFloat(balance.ethFormatted) > 0.01 ? 'healthy' : 'low_balance',
          warning: parseFloat(balance.ethFormatted) < 0.01 ? 'Relay wallet needs ETH refill' : null
        },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error getting status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  return router;
}
