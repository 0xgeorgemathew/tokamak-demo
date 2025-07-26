import { Network } from "./types";

export const SUPPORTED_NETWORKS: Network[] = [
  {
    id: 1,
    name: "Ethereum",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/1",
    blockExplorer: "https://etherscan.io",
    color: "#627EEA",
  },
  {
    id: 42161,
    name: "Arbitrum",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/42161",
    blockExplorer: "https://arbiscan.io",
    color: "#28A0F0",
  },
  {
    id: 43114,
    name: "Avalanche",
    symbol: "AVAX",
    rpcUrl: "https://api.1inch.dev/web3/43114",
    blockExplorer: "https://snowtrace.io",
    color: "#E84142",
  },
  {
    id: 56,
    name: "BNB Chain",
    symbol: "BNB",
    rpcUrl: "https://api.1inch.dev/web3/56",
    blockExplorer: "https://bscscan.com",
    color: "#F3BA2F",
  },
  {
    id: 100,
    name: "Gnosis",
    symbol: "xDAI",
    rpcUrl: "https://api.1inch.dev/web3/100",
    blockExplorer: "https://gnosisscan.io",
    color: "#00D4AA",
  },
  {
    id: 146,
    name: "Sonic",
    symbol: "S",
    rpcUrl: "https://api.1inch.dev/web3/146",
    blockExplorer: "https://sonicscan.org",
    color: "#FF6B00",
  },
  {
    id: 10,
    name: "Optimism",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/10",
    blockExplorer: "https://optimistic.etherscan.io",
    color: "#FF0420",
  },
  {
    id: 137,
    name: "Polygon",
    symbol: "MATIC",
    rpcUrl: "https://api.1inch.dev/web3/137",
    blockExplorer: "https://polygonscan.com",
    color: "#8247E5",
  },
  {
    id: 324,
    name: "zkSync Era",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/324",
    blockExplorer: "https://explorer.zksync.io",
    color: "#8C8DFC",
  },
  {
    id: 8453,
    name: "Base",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/8453",
    blockExplorer: "https://basescan.org",
    color: "#0052FF",
  },
  {
    id: 59144,
    name: "Linea",
    symbol: "ETH",
    rpcUrl: "https://api.1inch.dev/web3/59144",
    blockExplorer: "https://lineascan.build",
    color: "#61DFFF",
  },
];

export const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0]; // Ethereum

export const API_ENDPOINTS = {
  TRACES: "/api/1inch/traces",
  WEB3: "/api/1inch/web3",
  BLOCK_TRACE: (chain: number, blockNumber: number) =>
    `/api/1inch/traces?chain=${chain}&blockNumber=${blockNumber}`,
  TX_TRACE: (chain: number, blockNumber: number, txHash: string) =>
    `/api/1inch/traces?chain=${chain}&blockNumber=${blockNumber}&txHash=${txHash}`,
};

export const REGEX_PATTERNS = {
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  BLOCK_NUMBER: /^\d+$/,
};

export const THEME_COLORS = {
  plasma: {
    primary: "#00FFFF", // Cyan
    secondary: "#FF00FF", // Magenta
    accent: "#00FF00", // Green
    warning: "#FFFF00", // Yellow
    danger: "#FF0000", // Red
  },
  glass: {
    backdrop: "rgba(255, 255, 255, 0.1)",
    border: "rgba(255, 255, 255, 0.2)",
    shadow: "rgba(0, 0, 0, 0.3)",
  },
};
