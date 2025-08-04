export interface Network {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  color: string;
}

export interface Transaction {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  success: boolean;
}

export interface TradeAnalysis {
  transactionHash: string;
  tokenIn: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  profit: {
    amount: string;
    percentage: number;
    usdValue: number;
  };
  gasSpent: {
    eth: string;
    usd: number;
  };
  netProfit: {
    eth: string;
    usd: number;
  };
}

export interface AddressAnalysis {
  address: string;
  totalTransactions: number;
  totalProfit: {
    eth: string;
    usd: number;
  };
  totalGasSpent: {
    eth: string;
    usd: number;
  };
  netProfit: {
    eth: string;
    usd: number;
  };
  trades: TradeAnalysis[];
  winRate: number;
}

export interface TraceResult {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  calls?: TraceResult[];
  logs?: TraceLog[];
  error?: string;
}

export interface TraceLog {
  data: string;
  topics: string[];
  contract: string;
}

export interface BlockTrace {
  number: number;
  blockHash: string;
  blockTimestamp: string;
  traces: TransactionTrace[];
}

export interface TransactionTrace {
  txHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  calls: TraceResult[];
  events: TraceLog[];
  success: boolean;
  error?: string;
}
export interface Network {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  color: string;
}
// --- Type Definitions ---
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface EnrichedAsset {
  token: TokenInfo;
  rawAmount: string;
  formattedAmount: string;
  isProfit?: boolean;
}

export interface TransactionMetadata {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionIndex: number;
  gasUsed: string;
  gasPrice: string;
  gasCostEth: string;
  from: string;
  to: string;
  value: string;
}

export interface ProtocolInteraction {
  address: string;
  protocol: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface GasAnalysis {
  totalGasUsed: number;
  gasPrice: string;
  gasCostEth: string;
  gasCostUsd?: string;
  gasEfficiency: 'high' | 'medium' | 'low';
}

export interface EnrichedFinancials {
  netProfitOrLoss: EnrichedAsset[];
  totalAssetsSent_Cost: EnrichedAsset[];
  totalAssetsReceived_Revenue: EnrichedAsset[];
}

export interface SandwichTransaction {
  hash: string;
  type: 'front-run' | 'victim' | 'back-run';
  blockNumber: number;
  transactionIndex: number;
  from: string;
  analysis?: any;
}

export interface SandwichPattern {
  frontRun: SandwichTransaction;
  victim: SandwichTransaction;
  backRun: SandwichTransaction;
  confidence: 'high' | 'medium' | 'low';
  priceImpact: PriceImpactAnalysis;
  victimLoss: EnrichedAsset[];
  attackerProfit: EnrichedAsset[];
}

export interface PriceImpactAnalysis {
  tokenPair: {
    tokenA: TokenInfo;
    tokenB: TokenInfo;
  };
  preBandwichPrice: string;
  postBandwichPrice: string;
  maxPriceImpact: string;
  victimSlippage: string;
  poolManipulation: number; // percentage
}

export interface MEVBotProfile {
  address: string;
  confidence: 'high' | 'medium' | 'low';
  patterns: {
    avgGasPrice: string;
    txFrequency: number;
    successRate: number;
    preferredProtocols: string[];
  };
}
export interface TokenFlow {
  token: string;
  direction: 'buy' | 'sell';
  amount: bigint;
  from: string;
  to: string;
}

export interface TransactionPattern {
  address: string;
  tokenFlows: TokenFlow[];
  gasPrice: bigint;
  blockNumber: number;
  transactionIndex: number;
}