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
