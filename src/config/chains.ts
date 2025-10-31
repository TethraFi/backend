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
    mockUSDC: process.env.BASE_USDC_ADDRESS || '0x9d660c5d4BFE4b7fcC76f327b22ABF7773DD48c1',
    tethraToken: process.env.BASE_TETHRA_TOKEN_ADDRESS || '0x6f1330f207Ab5e2a52c550AF308bA28e3c517311',
    riskManager: process.env.BASE_RISK_MANAGER_ADDRESS || '0x08A23503CC221C3B520D2E9bA2aB93E3546d798F',
    positionManager: process.env.BASE_POSITION_MANAGER_ADDRESS || '0x8eA6059Bd95a9f0A47Ce361130ffB007415519aF',
    treasuryManager: process.env.BASE_TREASURY_MANAGER_ADDRESS || '0x157e68fBDD7D8294badeD37d876aEb7765986681',
    marketExecutor: process.env.BASE_MARKET_EXECUTOR_ADDRESS || '0xA1badd2cea74931d668B7aB99015ede28735B3EF',
    limitExecutorV2: process.env.BASE_LIMIT_EXECUTOR_ADDRESS || '0x8c297677FEA6F0beDC0D1fa139aa2bc23eE6234a',
    tapToTradeExecutor: process.env.BASE_TAP_TO_TRADE_EXECUTOR_ADDRESS || '0x79Cb84cF317235EA5C61Cce662373D982853E8d8',
    oneTapProfit: process.env.BASE_ONE_TAP_PROFIT_ADDRESS || '0x5D4c52a7aD4Fb6B43C6B212Db1C1e0A7f9B0f73c',
    tethraStaking: process.env.BASE_TETHRA_STAKING_ADDRESS || '0x69FFE0989234971eA2bc542c84c9861b0D8F9b17',
    liquidityMining: process.env.BASE_LIQUIDITY_MINING_ADDRESS || '0x76dc221f50ca56A1E8445508CA9ecc0aD57d0B11',
    usdcPaymaster: process.env.BASE_USDC_PAYMASTER_ADDRESS || '0x94FbB9C6C854599c7562c282eADa4889115CCd8E',
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
    positionManager: process.env.FLOW_POSITION_MANAGER_ADDRESS || '0x29Bc61d98d9BD0298C010D59A5C2e5a2CB5D8958',
    treasuryManager: process.env.FLOW_TREASURY_MANAGER_ADDRESS || '0xa1c84C31165282C05450b2a86f80999dD263b071',
    marketExecutor: process.env.FLOW_MARKET_EXECUTOR_ADDRESS || '0xCb5A11a2913763a01FA97CBDE67BCAB4Bf234D97',
    limitExecutorV2: process.env.FLOW_LIMIT_EXECUTOR_ADDRESS || '0x9782F89bDB822059FeaC76425b10f81A1E2d5d3f',
    tapToTradeExecutor: process.env.FLOW_TAP_TO_TRADE_EXECUTOR_ADDRESS || '0xD59551d80BDfe94662ACed1d27b5b12792711072',
    oneTapProfit: process.env.FLOW_ONE_TAP_PROFIT_ADDRESS || '0x42C53C1769779277B74bD89b3e6994E88d33E285',
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
