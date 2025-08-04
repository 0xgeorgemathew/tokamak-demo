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

export const DEFAULT_NETWORK = SUPPORTED_NETWORKS[ 0 ]; // Ethereum


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
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const NATIVE_ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// Protocol detection constants
export const KNOWN_PROTOCOLS = {
  // --- DEXes & Aggregators ---
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router 2',
  '0x3fc91a3afd70395e496cb845d6726cfcc43de7d3': 'Uniswap Universal Router',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'SushiSwap Trident Router',
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'Balancer V2 Vault',
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41': 'CoW Protocol (CowSwap)',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch v5 Router',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch v4 Router',
  '0xdef171fe48cf0115b1d80b88dc8eab59176fee57': 'ParaSwap Augustus V5',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0x615f265506e8486241a8fa483a669e7123910b96': 'KyberSwap Elastic Router',

  // --- Curve Finance ---
  '0x90e00ace148ca3b23ac1bc8c240c2a7ddd9e0852': 'Curve Registry',
  '0xd51a44d3fae010294c616388b506acda1bfaae46': 'Curve stETH-ETH Pool',
  '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7': 'Curve 3pool (DAI/USDC/USDT)',
  '0xdc24316b9ae028f1497c275eb9192a3ea0f67022': 'Curve cvxETH-ETH Pool',

  // --- Lending & Borrowing ---
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave V2 Lending Pool',
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3 Pool',
  '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'Compound Comptroller',
  '0xccf4429db6322d5c611ee964527d42e5d685dd6a': 'Compound III Comet',


  // --- Other Infrastructure ---
  '0x00000000006c3852cbef3e08e8df289169ede581': 'OpenSea Seaport 1.1',
  '0x11111112542d85b3ef69ae05771c2dccff4faa26': '1inch Flashloan Aggregator',
  '0x40a871dd23de08c117d7e35b0d5aa9c22e442568': 'Banana Gun: Router',
} as const;

export const MEV_BOT_PATTERNS = {
  // --- Well-Known MEV Bots / Searchers ---
  '0xa5a13f62ce1113838e0d9b4559b8caf5f76463c0': 'MEV Bot (Jaredfromsubway.eth)',
  '0x00000000003b3cc22af3ae1eac0440bcee416b40': 'MEV Bot (Generic)',
  '0x55555558d89e3a3885b5652a9d82b26a62f8373b': 'MEV Bot (Multi-strategy)',
  '0x271960a542b0e9e18b87010e976722df1492e854': 'MEV Bot (Arbitrage)',
  '0x0000000000000d6a469742a35639169f4543b59f': 'MEV Bot (Flashbots Searcher)',
  '0xba11010101010101010101010101010101010101': 'Balancer Exploiter 1 (for reference)',
  '0xbadc0debadc0debadc0debadc0debadc0debadc0de': 'MEV Bot (vanity address)',

  // --- Your Original List (Still relevant) ---
  '0x5050e08626c499411b5d0e0b5af0e83d3fd82edf': 'MEV Bot',
  '0x56178a0d5f301baf6cf3e17126ea71bd1e4e1ca1': 'Sandwich Bot',
  '0x000000000035b5e5ad9019092c665357240f594e': 'MEV Searcher',
  '0x0000000099cb7fc48a935bceb9f05bbae54e8987': 'Flashloan Bot',
  '0x74de5d4fcbf63e00296fd95d33236b9794016631': 'Arbitrage Bot',

  // --- Additional Patterns ---
  '0x93a34a2e5572f88302061645e5d153835f8d998c': 'MEV Bot (SushiSwap & Uniswap)',
  '0xda9dfa130df4de4673b89022ee50ff26f6ea73cf': 'MEV Bot (Beaver Build)',
} as const;

// Enhanced MEV bot detection patterns
export const MEV_BOT_HEURISTICS = {
  highGasPriceThreshold: 50, // Gwei
  frequentTxThreshold: 10, // txs per hour
  successRateThreshold: 0.7, // 70% success rate
  gasEfficiencyThreshold: 150000, // gas per transaction
  commonContractPatterns: [
    '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch
    '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45', // Uniswap V3
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2
  ],
} as const;

export const Logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  debug: (message: string, data?: any) => console.log(`[DEBUG] ${message}`, data || ''),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  separator: () => console.log('\n' + '='.repeat(50) + '\n'),
};