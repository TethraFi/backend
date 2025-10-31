/**
 * Multi-Chain Configuration
 *
 * Centralized configuration for all supported chains
 */

export type ChainType = 'base' | 'flow';

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contracts: {
    mockUSDC: string;
    tethraToken: string;
    riskManager: string;
    positionManager: string;
    treasuryManager: string;
    marketExecutor: string;
    limitExecutorV2: string;
    tapToTradeExecutor: string;
    oneTapProfit: string;
    tethraStaking: string;
    liquidityMining: string;
    usdcPaymaster: string;
    keeperWallet: string;
    priceSigner: string;
    protocolTreasury: string;
  };
}

// Base Sepolia Configuration
export const baseConfig: ChainConfig = {
  id: 84532,
  name: 'base',
  rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  contracts: {
    mockUSDC: process.env.BASE_USDC_ADDRESS || '0x157e68fBDD7D8294badeD37d876aEb7765986681',
    tethraToken: process.env.BASE_TETHRA_TOKEN_ADDRESS || '0xDA595B84708ff6aFd01CD9eB6EB961e0Ab8c21E4',
    riskManager: process.env.BASE_RISK_MANAGER_ADDRESS || '0x7bfa0022e57D73F1Fb78956844C2B3A1e7dbd7ae',
    positionManager: process.env.BASE_POSITION_MANAGER_ADDRESS || '0x03Fd49Dd2Cc23AdC08De0d4Fcb3b4EEe1c8F8d66',
    treasuryManager: process.env.BASE_TREASURY_MANAGER_ADDRESS || '0xCb5A11a2913763a01FA97CBDE67BCAB4Bf234D97',
    marketExecutor: process.env.BASE_MARKET_EXECUTOR_ADDRESS || '0x841f70066ba831650c4D97BD59cc001c890cf6b6',
    limitExecutorV2: process.env.BASE_LIMIT_EXECUTOR_ADDRESS || '0xd26CEE69B76bED0D086f6D1D75BB8fC0fE76f7Ed',
    tapToTradeExecutor: process.env.BASE_TAP_TO_TRADE_EXECUTOR_ADDRESS || '0x79Cb84cF317235EA5C61Cce662373D982853E8d8',
    oneTapProfit: process.env.BASE_ONE_TAP_PROFIT_ADDRESS || '0x5D4c52a7aD4Fb6B43C6B212Db1C1e0A7f9B0f73c',
    tethraStaking: process.env.BASE_TETHRA_STAKING_ADDRESS || '0xAFD29f8B59dC0F39F2Dc67F16c3DEBa30b6e5D5E',
    liquidityMining: process.env.BASE_LIQUIDITY_MINING_ADDRESS || '0x0d38A7e3f5e2Ee0B0dD44f1a86e64aADf17e30e9',
    usdcPaymaster: process.env.BASE_USDC_PAYMASTER_ADDRESS || '0xA2C44e70A0BDa6d061BF1a8e8bF3D5e5C44e5Bf3',
    keeperWallet: process.env.BASE_KEEPER_WALLET || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
    priceSigner: process.env.BASE_PRICE_SIGNER || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
    protocolTreasury: process.env.BASE_PROTOCOL_TREASURY || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
  },
};

// Flow EVM Testnet Configuration
export const flowConfig: ChainConfig = {
  id: 545,
  name: 'flow',
  rpcUrl: process.env.FLOW_RPC_URL || 'https://testnet.evm.nodes.onflow.org',
  explorerUrl: 'https://evm-testnet.flowscan.io',
  contracts: {
    mockUSDC: process.env.FLOW_USDC_ADDRESS || '0x69FFE0989234971eA2bc542c84c9861b0D8F9b17',
    tethraToken: process.env.FLOW_TETHRA_TOKEN_ADDRESS || '0x49c37C3b3a96028D2A1A1e678A302C1d727f3FEF',
    riskManager: process.env.FLOW_RISK_MANAGER_ADDRESS || '0x94FbB9C6C854599c7562c282eADa4889115CCd8E',
    positionManager: process.env.FLOW_POSITION_MANAGER_ADDRESS || '0x50951f3AE8e622E007A174e7AE08f25659bCe4B0',
    treasuryManager: process.env.FLOW_TREASURY_MANAGER_ADDRESS || '0xa1c84C31165282C05450b2a86f80999dD263b071',
    marketExecutor: process.env.FLOW_MARKET_EXECUTOR_ADDRESS || '0xCb5A11a2913763a01FA97CBDE67BCAB4Bf234D97',
    limitExecutorV2: process.env.FLOW_LIMIT_EXECUTOR_ADDRESS || '0x3c4AadE89D4af90666b859DaFB7DDB61C4E58C60',
    tapToTradeExecutor: process.env.FLOW_TAP_TO_TRADE_EXECUTOR_ADDRESS || '0x2f994B6Ffbe5f943cb1F1932b1CF41d81780A091',
    oneTapProfit: process.env.FLOW_ONE_TAP_PROFIT_ADDRESS || '0xE47b99032f7a7Efef1917A7CAA81455A3C552d17',
    tethraStaking: process.env.FLOW_TETHRA_STAKING_ADDRESS || '0xe2BF339Beb501f0C5263170189b6960AC416F1f3',
    liquidityMining: process.env.FLOW_LIQUIDITY_MINING_ADDRESS || '0x6D91332E27a5BddCe9486ad4e9cA3C319947a302',
    usdcPaymaster: process.env.FLOW_USDC_PAYMASTER_ADDRESS || '0xF515Fd4fAf79E263d6E38c77A6be7165d3F746Df',
    keeperWallet: process.env.FLOW_KEEPER_WALLET || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
    priceSigner: process.env.FLOW_PRICE_SIGNER || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
    protocolTreasury: process.env.FLOW_PROTOCOL_TREASURY || '0x722550Bb8Ec6416522AfE9EAf446F0DE3262f701',
  },
};

// Chain registry
const chains: Record<string, ChainConfig> = {
  base: baseConfig,
  flow: flowConfig,
};

/**
 * Get chain configuration by chain identifier
 */
export function getChainConfig(chain: string): ChainConfig {
  const config = chains[chain.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown chain: ${chain}. Supported chains: ${Object.keys(chains).join(', ')}`);
  }
  return config;
}

/**
 * Get all supported chains
 */
export function getAllChains(): ChainConfig[] {
  return Object.values(chains);
}

/**
 * Check if chain is supported
 */
export function isChainSupported(chain: string): boolean {
  return chain.toLowerCase() in chains;
}
