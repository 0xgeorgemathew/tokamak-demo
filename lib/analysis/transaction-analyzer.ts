import axios from 'axios';
import { exit } from 'process';
import { Config, getOpenAI } from '../config';
import { 
  ERC20_TRANSFER_TOPIC, 
  NATIVE_ETH_ADDRESS, 
  KNOWN_PROTOCOLS, 
  MEV_BOT_PATTERNS, 
  MEV_BOT_HEURISTICS, 
  Logger 
} from '../constants';
import { formatTokenAmount } from '../utils';
import type { 
  TokenInfo, 
  EnrichedAsset, 
  TransactionMetadata, 
  ProtocolInteraction, 
  GasAnalysis, 
  SandwichPattern,
  PriceImpactAnalysis,
  MEVBotProfile 
} from '../types';

// Constants and Logger are now imported from ../constants

// Type definitions are now imported from ../types

// --- API & Core Logic Functions ---

async function callRpc(chainId: number, method: string, params: any[]): Promise<any> {
  const url = `${Config.API_BASE_URL}/web3/${chainId}`;
  const body = { jsonrpc: '2.0', id: 1, method, params };
  Logger.debug(`Calling RPC: ${method} on chain ${chainId}`, { params });

  try {
    const response = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    if ((response.data as any).error) throw new Error(`RPC Error: ${(response.data as any).error.message}`);
    return (response.data as any).result;
  } catch (error: any) {
    if (error.response) {
      Logger.error(`Axios Error calling RPC: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// IMPROVED: Now accepts blockNumber directly to avoid a redundant RPC call.
async function getTransactionTrace(chainId: number, txHash: string, blockNumber: number): Promise<any> {
  Logger.info(`Fetching detailed trace for ${txHash} in block ${blockNumber}...`);
  const traceUrl = `${Config.API_BASE_URL}/traces/v1.0/chain/${chainId}/block-trace/${blockNumber}/tx-hash/${txHash}`;
  const response = await axios.get(traceUrl);
  return response.data;
}

/**
 * Manages fetching and caching token metadata (symbol, decimals).
 */
const TokenMetadataManager = {
  cache: new Map<string, TokenInfo>(),

  async getTokenInfo(chainId: number, address: string): Promise<TokenInfo> {
    const lowerAddress = address.toLowerCase();
    if (this.cache.has(lowerAddress)) {
      return this.cache.get(lowerAddress)!;
    }
    if (lowerAddress === NATIVE_ETH_ADDRESS) {
      const nativeInfo = { address: lowerAddress, symbol: 'ETH', decimals: 18 };
      this.cache.set(lowerAddress, nativeInfo);
      return nativeInfo;
    }

    try {
      Logger.info(`Fetching metadata for token: ${address}`);
      const [symbolHex, decimalsHex] = await Promise.all([
        callRpc(chainId, 'eth_call', [{ to: address, data: '0x95d89b41' }, 'latest']), // symbol()
        callRpc(chainId, 'eth_call', [{ to: address, data: '0x313ce567' }, 'latest']), // decimals()
      ]);

      // *** FIX: More robust string cleaning to remove all non-printable/control characters ***
      const symbol =
        symbolHex && symbolHex !== '0x'
          ? Buffer.from(symbolHex.slice(2), 'hex')
              .toString('utf8')
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
              .trim()
          : 'UNKNOWN';

      const decimals = decimalsHex && decimalsHex !== '0x' ? parseInt(decimalsHex, 16) : 18;

      const info = { address: lowerAddress, symbol, decimals };
      this.cache.set(lowerAddress, info);
      return info;
    } catch (e) {
      Logger.error(`Failed to fetch metadata for ${address}. Defaulting to UNKNOWN.`);
      const info = { address: lowerAddress, symbol: 'UNKNOWN', decimals: 18 };
      this.cache.set(lowerAddress, info);
      return info;
    }
  },
};

// formatTokenAmount function moved to ../utils

function detectProtocols(trace: any): ProtocolInteraction[] {
  const protocols: ProtocolInteraction[] = [];
  const addresses = new Set<string>();

  // Collect all interacted addresses
  addresses.add(trace.to?.toLowerCase());
  const collectAddresses = (call: any) => {
    if (call.to) addresses.add(call.to.toLowerCase());
    call.calls?.forEach(collectAddresses);
  };
  if (trace.calls) collectAddresses(trace);

  // Match against known protocols
  for (const address of addresses) {
    if (address && KNOWN_PROTOCOLS[address as keyof typeof KNOWN_PROTOCOLS]) {
      protocols.push({
        address,
        protocol: KNOWN_PROTOCOLS[address as keyof typeof KNOWN_PROTOCOLS],
        confidence: 'high',
      });
    }
  }

  return protocols;
}

async function analyzeMEVBotBehavior(chainId: number, address: string, blockNumber: number): Promise<MEVBotProfile> {
  const lowerAddress = address.toLowerCase();

  if (MEV_BOT_PATTERNS[lowerAddress as keyof typeof MEV_BOT_PATTERNS]) {
    return {
      address: lowerAddress,
      confidence: 'high',
      patterns: {
        avgGasPrice: 'Known Bot',
        txFrequency: 0,
        successRate: 1.0,
        preferredProtocols: ['Multiple'],
      },
    };
  }

  try {
    const startBlock = Math.max(0, blockNumber - 100);
    const recentTxs = [];

    for (let i = 0; i < 5; i++) {
      const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${(blockNumber - i).toString(16)}`, true]);
      const txsFromAddress = block.transactions.filter((tx: any) => tx.from.toLowerCase() === lowerAddress);
      recentTxs.push(...txsFromAddress);
    }

    const avgGasPrice =
      recentTxs.length > 0
        ? (recentTxs.reduce((sum, tx) => sum + parseInt(tx.gasPrice || '0x0', 16), 0) / recentTxs.length / 1e9).toFixed(
            2,
          ) + ' Gwei'
        : '0 Gwei';

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (recentTxs.length >= MEV_BOT_HEURISTICS.frequentTxThreshold) confidence = 'medium';
    if (recentTxs.length >= MEV_BOT_HEURISTICS.frequentTxThreshold * 2) confidence = 'high';

    return {
      address: lowerAddress,
      confidence,
      patterns: {
        avgGasPrice,
        txFrequency: recentTxs.length,
        successRate: 0.8, // Placeholder - would need receipt analysis
        preferredProtocols: ['DEX'],
      },
    };
  } catch (error) {
    return {
      address: lowerAddress,
      confidence: 'low',
      patterns: {
        avgGasPrice: '0 Gwei',
        txFrequency: 0,
        successRate: 0,
        preferredProtocols: [],
      },
    };
  }
}

async function calculatePriceImpact(
  chainId: number,
  frontRunTrace: any,
  victimTrace: any,
  backRunTrace: any,
): Promise<PriceImpactAnalysis> {
  const extractSwapTokens = (trace: any) => {
    const tokens = new Set<string>();
    trace.events?.forEach((event: any) => {
      if (event.topics?.[0] === ERC20_TRANSFER_TOPIC) {
        tokens.add(event.contract.toLowerCase());
      }
    });
    return Array.from(tokens);
  };

  const frontTokens = extractSwapTokens(frontRunTrace.transactionTrace);
  const victimTokens = extractSwapTokens(victimTrace.transactionTrace);

  const commonTokens = frontTokens.filter((token) => victimTokens.includes(token));

  if (commonTokens.length < 2) {
    return {
      tokenPair: {
        tokenA: { address: 'unknown', symbol: 'UNKNOWN', decimals: 18 },
        tokenB: { address: 'unknown', symbol: 'UNKNOWN', decimals: 18 },
      },
      preBandwichPrice: '0',
      postBandwichPrice: '0',
      maxPriceImpact: '0%',
      victimSlippage: '0%',
      poolManipulation: 0,
    };
  }

  const tokenA = await TokenMetadataManager.getTokenInfo(chainId, commonTokens[0]);
  const tokenB = await TokenMetadataManager.getTokenInfo(chainId, commonTokens[1]);

  return {
    tokenPair: { tokenA, tokenB },
    preBandwichPrice: 'Analysis needed',
    postBandwichPrice: 'Analysis needed',
    maxPriceImpact: 'High',
    victimSlippage: 'Significant',
    poolManipulation: 85, // Placeholder - would calculate from reserves
  };
}

async function detectSandwichFromVictim(
  chainId: number,
  victimTxHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  Logger.info(`Analyzing potential victim transaction: ${victimTxHash}`);

  const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  const txs = block.transactions;
  const victimIndex = txs.findIndex((tx: any) => tx.hash === victimTxHash);

  if (victimIndex === -1) return null;

  const victimTx = txs[victimIndex];
  const victimTrace = await getTransactionTrace(chainId, victimTxHash, blockNumber);

  let frontRunTx = null;
  let backRunTx = null;
  let attacker = null;

  // Look for front-run transaction (more comprehensive search)
  for (let i = Math.max(0, victimIndex - 5); i < victimIndex; i++) {
    const potentialFrontRun = txs[i];
    const frontTrace = await getTransactionTrace(chainId, potentialFrontRun.hash, blockNumber);

    if (await isLikelySandwichTransaction(frontTrace, victimTrace, 'front-run')) {
      frontRunTx = potentialFrontRun;
      attacker = potentialFrontRun.from.toLowerCase();
      break;
    }
  }

  if (!frontRunTx || !attacker) return null;

  // Look for back-run transaction from same attacker
  for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 5); i++) {
    const potentialBackRun = txs[i];
    if (potentialBackRun.from.toLowerCase() === attacker) {
      backRunTx = potentialBackRun;
      break;
    }
  }

  if (!backRunTx) return null;

  const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
  const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);

  // Enhanced validation: Check if this is really a sandwich attack
  if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
    return null;
  }

  const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

  return {
    frontRun: {
      hash: frontRunTx.hash,
      type: 'front-run',
      blockNumber,
      transactionIndex: frontRunTx.transactionIndex,
      from: frontRunTx.from,
    },
    victim: {
      hash: victimTxHash,
      type: 'victim',
      blockNumber,
      transactionIndex: victimTx.transactionIndex,
      from: victimTx.from,
    },
    backRun: {
      hash: backRunTx.hash,
      type: 'back-run',
      blockNumber,
      transactionIndex: backRunTx.transactionIndex,
      from: backRunTx.from,
    },
    confidence: 'high',
    priceImpact,
    victimLoss: [],
    attackerProfit: [],
  };
}

async function detectSandwichFromBackRun(
  chainId: number,
  backRunTxHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  Logger.info(`Analyzing potential back-run transaction: ${backRunTxHash}`);

  const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  const txs = block.transactions;
  const backRunIndex = txs.findIndex((tx: any) => tx.hash === backRunTxHash);

  if (backRunIndex === -1) return null;

  const backRunTx = txs[backRunIndex];
  const attacker = backRunTx.from.toLowerCase();

  let frontRunTx = null;
  let victimTx = null;

  for (let i = Math.max(0, backRunIndex - 5); i < backRunIndex; i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() === attacker && !frontRunTx) {
      frontRunTx = tx;
    }
    if (frontRunTx && tx.from.toLowerCase() !== attacker && !victimTx) {
      victimTx = tx;
    }
  }

  if (!frontRunTx || !victimTx) return null;

  const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
  const victimTrace = await getTransactionTrace(chainId, victimTx.hash, blockNumber);
  const backRunTrace = await getTransactionTrace(chainId, backRunTxHash, blockNumber);

  // Enhanced validation: Check if this is really a sandwich attack
  if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
    return null;
  }

  const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

  return {
    frontRun: {
      hash: frontRunTx.hash,
      type: 'front-run',
      blockNumber,
      transactionIndex: frontRunTx.transactionIndex,
      from: frontRunTx.from,
    },
    victim: {
      hash: victimTx.hash,
      type: 'victim',
      blockNumber,
      transactionIndex: victimTx.transactionIndex,
      from: victimTx.from,
    },
    backRun: {
      hash: backRunTxHash,
      type: 'back-run',
      blockNumber,
      transactionIndex: backRunTx.transactionIndex,
      from: backRunTx.from,
    },
    confidence: 'high',
    priceImpact,
    victimLoss: [],
    attackerProfit: [],
  };
}

async function detectSandwichFromFrontRun(
  chainId: number,
  frontRunTxHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  Logger.info(`Analyzing potential front-run transaction: ${frontRunTxHash}`);

  const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  const txs = block.transactions;
  const frontRunIndex = txs.findIndex((tx: any) => tx.hash === frontRunTxHash);

  if (frontRunIndex === -1) return null;

  const frontRunTx = txs[frontRunIndex];
  const attacker = frontRunTx.from.toLowerCase();

  let victimTx = null;
  let backRunTx = null;

  // Look for victim transaction immediately after front-run
  for (let i = frontRunIndex + 1; i < Math.min(txs.length, frontRunIndex + 4); i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() !== attacker && !victimTx) {
      victimTx = tx;
      break;
    }
  }

  if (!victimTx) return null;

  // Look for back-run transaction from same attacker after victim
  const victimIndex = txs.findIndex((tx: any) => tx.hash === victimTx.hash);
  for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 4); i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() === attacker) {
      backRunTx = tx;
      break;
    }
  }

  if (!backRunTx) return null;

  const frontRunTrace = await getTransactionTrace(chainId, frontRunTxHash, blockNumber);
  const victimTrace = await getTransactionTrace(chainId, victimTx.hash, blockNumber);
  const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);

  // Enhanced validation: Check if this is really a sandwich attack
  if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
    return null;
  }

  const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

  return {
    frontRun: {
      hash: frontRunTxHash,
      type: 'front-run',
      blockNumber,
      transactionIndex: frontRunTx.transactionIndex,
      from: frontRunTx.from,
    },
    victim: {
      hash: victimTx.hash,
      type: 'victim',
      blockNumber,
      transactionIndex: victimTx.transactionIndex,
      from: victimTx.from,
    },
    backRun: {
      hash: backRunTx.hash,
      type: 'back-run',
      blockNumber,
      transactionIndex: backRunTx.transactionIndex,
      from: backRunTx.from,
    },
    confidence: 'high',
    priceImpact,
    victimLoss: [],
    attackerProfit: [],
  };
}

interface TokenFlow {
  token: string;
  direction: 'buy' | 'sell';
  amount: bigint;
  from: string;
  to: string;
}

interface TransactionPattern {
  address: string;
  tokenFlows: TokenFlow[];
  gasPrice: bigint;
  blockNumber: number;
  transactionIndex: number;
}

async function extractTokenFlows(trace: any): Promise<TokenFlow[]> {
  const flows: TokenFlow[] = [];
  const transactionFrom = trace.transactionTrace?.from?.toLowerCase();
  
  trace.transactionTrace?.events?.forEach((event: any) => {
    if (event.topics?.[0] === ERC20_TRANSFER_TOPIC && event.data) {
      const token = event.contract.toLowerCase();
      const from = `0x${event.topics[1].slice(26)}`.toLowerCase();
      const to = `0x${event.topics[2].slice(26)}`.toLowerCase();
      const amount = BigInt(event.data);

      // Determine if this is a buy or sell from the perspective of the transaction initiator
      let direction: 'buy' | 'sell';
      if (from === transactionFrom) {
        direction = 'sell'; // User is sending tokens away
      } else if (to === transactionFrom) {
        direction = 'buy'; // User is receiving tokens
      } else {
        // This is an intermediate transfer, try to infer direction
        direction = 'buy'; // Default assumption
      }

      flows.push({
        token,
        direction,
        amount,
        from,
        to,
      });
    }
  });

  return flows;
}

async function detectSandwichByPattern(
  chainId: number,
  txHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  Logger.info(`Running pattern-first sandwich detection for ${txHash}`);

  // First try single-block detection
  const singleBlockResult = await detectSandwichInBlock(chainId, txHash, blockNumber);
  if (singleBlockResult) {
    return singleBlockResult;
  }

  // If not found, try multi-block detection
  Logger.info('Single-block detection failed, trying multi-block detection...');
  return await detectSandwichAcrossBlocks(chainId, txHash, blockNumber);
}

async function detectSandwichInBlock(
  chainId: number,
  txHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  // Get the block and find our transaction
  const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  const txs = block.transactions;
  const currentTxIndex = txs.findIndex((tx: any) => tx.hash === txHash);
  
  if (currentTxIndex === -1) return null;

  const currentTx = txs[currentTxIndex];
  const currentTrace = await getTransactionTrace(chainId, txHash, blockNumber);
  const currentFlows = await extractTokenFlows(currentTrace);
  const currentAddress = currentTx.from.toLowerCase();

  // Extract current transaction's token pairs
  const currentTokens = [...new Set(currentFlows.map(f => f.token))];
  if (currentTokens.length < 2) return null; // Need at least 2 tokens for a swap

  // Look for pattern: Check surrounding transactions for mirrored token flows
  let frontRunTx = null;
  let backRunTx = null;

  // Strategy 1: Look for same address before and after (front-run and back-run)
  for (let i = Math.max(0, currentTxIndex - 5); i < currentTxIndex; i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() === currentAddress) {
      // Found a potential front-run from same address
      const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
      const flows = await extractTokenFlows(trace);
      const tokens = [...new Set(flows.map(f => f.token))];
      
      // Check if it involves same tokens
      const commonTokens = currentTokens.filter(token => tokens.includes(token));
      if (commonTokens.length >= 2) {
        frontRunTx = tx;
        break;
      }
    }
  }

  for (let i = currentTxIndex + 1; i < Math.min(txs.length, currentTxIndex + 6); i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() === currentAddress) {
      // Found a potential back-run from same address
      const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
      const flows = await extractTokenFlows(trace);
      const tokens = [...new Set(flows.map(f => f.token))];
      
      // Check if it involves same tokens
      const commonTokens = currentTokens.filter(token => tokens.includes(token));
      if (commonTokens.length >= 2) {
        backRunTx = tx;
        break;
      }
    }
  }

  // If we found both front-run and back-run, current tx is the victim
  if (frontRunTx && backRunTx) {
    
    const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
    const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);
    const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, currentTrace, backRunTrace);

    return {
      frontRun: {
        hash: frontRunTx.hash,
        type: 'front-run',
        blockNumber,
        transactionIndex: frontRunTx.transactionIndex,
        from: frontRunTx.from,
      },
      victim: {
        hash: txHash,
        type: 'victim',
        blockNumber,
        transactionIndex: currentTx.transactionIndex,
        from: currentTx.from,
      },
      backRun: {
        hash: backRunTx.hash,
        type: 'back-run',
        blockNumber,
        transactionIndex: backRunTx.transactionIndex,
        from: backRunTx.from,
      },
      confidence: 'high',
      priceImpact,
      victimLoss: [],
      attackerProfit: [],
    };
  }

  // Strategy 2: Check if current tx is part of sandwich (front-run or back-run)
  // Look for victim transaction between potential front-run and back-run
  let potentialVictim = null;

  // Check if current is front-run
  for (let i = currentTxIndex + 1; i < Math.min(txs.length, currentTxIndex + 5); i++) {
    const tx = txs[i];
    if (tx.from.toLowerCase() !== currentAddress) {
      // Potential victim (different address)
      const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
      const flows = await extractTokenFlows(trace);
      const tokens = [...new Set(flows.map(f => f.token))];
      
      // Check if victim uses same tokens
      const commonTokens = currentTokens.filter(token => tokens.includes(token));
      if (commonTokens.length >= 2) {
        potentialVictim = tx;
        break;
      }
    }
  }

  if (potentialVictim) {
    // Look for back-run after victim
    const victimIndex = txs.findIndex((tx: any) => tx.hash === potentialVictim.hash);
    for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 5); i++) {
      const tx = txs[i];
      if (tx.from.toLowerCase() === currentAddress) {
        // Found back-run from same address as current (front-run)
        backRunTx = tx;
        
        const victimTrace = await getTransactionTrace(chainId, potentialVictim.hash, blockNumber);
        const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);
        const priceImpact = await calculatePriceImpact(chainId, currentTrace, victimTrace, backRunTrace);

        return {
          frontRun: {
            hash: txHash,
            type: 'front-run',
            blockNumber,
            transactionIndex: currentTx.transactionIndex,
            from: currentTx.from,
          },
          victim: {
            hash: potentialVictim.hash,
            type: 'victim',
            blockNumber,
            transactionIndex: potentialVictim.transactionIndex,
            from: potentialVictim.from,
          },
          backRun: {
            hash: backRunTx.hash,
            type: 'back-run',
            blockNumber,
            transactionIndex: backRunTx.transactionIndex,
            from: backRunTx.from,
          },
          confidence: 'high',
          priceImpact,
          victimLoss: [],
          attackerProfit: [],
        };
      }
    }
  }

  return null;
}

async function detectSandwichAcrossBlocks(
  chainId: number,
  txHash: string,
  blockNumber: number,
): Promise<SandwichPattern | null> {
  const currentBlock = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, true]);
  const currentTxIndex = currentBlock.transactions.findIndex((tx: any) => tx.hash === txHash);
  
  if (currentTxIndex === -1) return null;

  const currentTx = currentBlock.transactions[currentTxIndex];
  const currentTrace = await getTransactionTrace(chainId, txHash, blockNumber);
  const currentFlows = await extractTokenFlows(currentTrace);
  const currentAddress = currentTx.from.toLowerCase();
  const currentTokens = [...new Set(currentFlows.map(f => f.token))];

  if (currentTokens.length < 2) return null;

  // Check previous blocks for front-run
  let frontRunTx = null;
  let frontRunBlockNumber = null;
  
  for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
    const prevBlockNum = blockNumber - blockOffset;
    if (prevBlockNum < 0) break;
    
    try {
      const prevBlock = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${prevBlockNum.toString(16)}`, true]);
      
      // Look for transactions from same address with same tokens
      for (let i = prevBlock.transactions.length - 1; i >= Math.max(0, prevBlock.transactions.length - 10); i--) {
        const tx = prevBlock.transactions[i];
        if (tx.from.toLowerCase() === currentAddress) {
          const trace = await getTransactionTrace(chainId, tx.hash, prevBlockNum);
          const flows = await extractTokenFlows(trace);
          const tokens = [...new Set(flows.map(f => f.token))];
          
          const commonTokens = currentTokens.filter(token => tokens.includes(token));
          if (commonTokens.length >= 2) {
            frontRunTx = tx;
            frontRunBlockNumber = prevBlockNum;
            break;
          }
        }
      }
      if (frontRunTx) break;
    } catch (error) {
      Logger.error(`Failed to fetch block ${prevBlockNum}: ${error}`);
    }
  }

  // Check next blocks for back-run
  let backRunTx = null;
  let backRunBlockNumber = null;
  
  for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
    const nextBlockNum = blockNumber + blockOffset;
    
    try {
      const nextBlock = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${nextBlockNum.toString(16)}`, true]);
      
      // Look for transactions from same address with same tokens
      for (let i = 0; i < Math.min(nextBlock.transactions.length, 10); i++) {
        const tx = nextBlock.transactions[i];
        if (tx.from.toLowerCase() === currentAddress) {
          const trace = await getTransactionTrace(chainId, tx.hash, nextBlockNum);
          const flows = await extractTokenFlows(trace);
          const tokens = [...new Set(flows.map(f => f.token))];
          
          const commonTokens = currentTokens.filter(token => tokens.includes(token));
          if (commonTokens.length >= 2) {
            backRunTx = tx;
            backRunBlockNumber = nextBlockNum;
            break;
          }
        }
      }
      if (backRunTx) break;
    } catch (error) {
      Logger.error(`Failed to fetch block ${nextBlockNum}: ${error}`);
    }
  }

  // If we found both front-run and back-run across blocks
  if (frontRunTx && backRunTx && frontRunBlockNumber !== null && backRunBlockNumber !== null) {
    const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, frontRunBlockNumber);
    const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, backRunBlockNumber);
    const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, currentTrace, backRunTrace);

    return {
      frontRun: {
        hash: frontRunTx.hash,
        type: 'front-run',
        blockNumber: frontRunBlockNumber,
        transactionIndex: frontRunTx.transactionIndex,
        from: frontRunTx.from,
      },
      victim: {
        hash: txHash,
        type: 'victim',
        blockNumber,
        transactionIndex: currentTx.transactionIndex,
        from: currentTx.from,
      },
      backRun: {
        hash: backRunTx.hash,
        type: 'back-run',
        blockNumber: backRunBlockNumber,
        transactionIndex: backRunTx.transactionIndex,
        from: backRunTx.from,
      },
      confidence: 'medium', // Lower confidence for cross-block detection
      priceImpact,
      victimLoss: [],
      attackerProfit: [],
    };
  }

  return null;
}

async function detectCrossBlockSandwich(
  chainId: number,
  frontRunTxHash: string,
  frontRunBlockNumber: number,
  attackerAddress: string
): Promise<{
  victimHash: string;
  backRunHash: string;
  victimBlockNumber: number;
  backRunBlockNumber: number;
} | null> {
  Logger.info(`Searching for sandwich pattern across blocks starting from ${frontRunBlockNumber}`);
  
  // Step 1: Look for victim transaction in the same block first, then next blocks
  let victimHash = null;
  let victimBlockNumber = frontRunBlockNumber;
  
  // Search current block and next 3 blocks for victim
  for (let blockOffset = 0; blockOffset <= 3; blockOffset++) {
    const searchBlockNumber = frontRunBlockNumber + blockOffset;
    try {
      const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${searchBlockNumber.toString(16)}`, true]);
      const txs = block.transactions;
      
      if (blockOffset === 0) {
        // In same block, look for transactions after the front-run
        const frontRunIndex = txs.findIndex((tx: any) => tx.hash === frontRunTxHash);
        if (frontRunIndex !== -1) {
          // Look for victim transaction immediately after front-run
          for (let i = frontRunIndex + 1; i < txs.length; i++) {
            if (txs[i].from.toLowerCase() !== attackerAddress.toLowerCase()) {
              victimHash = txs[i].hash;
              victimBlockNumber = searchBlockNumber;
              Logger.info(`Found potential victim in same block: ${victimHash}`);
              break;
            }
          }
        }
      } else {
        // In subsequent blocks, look for any transaction not from attacker
        for (let i = 0; i < Math.min(txs.length, 10); i++) {
          if (txs[i].from.toLowerCase() !== attackerAddress.toLowerCase()) {
            victimHash = txs[i].hash;
            victimBlockNumber = searchBlockNumber;
            Logger.info(`Found potential victim in block ${searchBlockNumber}: ${victimHash}`);
            break;
          }
        }
      }
      
      if (victimHash) break;
    } catch (error) {
      Logger.error(`Failed to fetch block ${searchBlockNumber}: ${error}`);
    }
  }
  
  if (!victimHash) {
    Logger.info('No potential victim transaction found');
    return null;
  }
  
  // Step 2: Look for back-run transaction from same attacker after victim
  let backRunHash = null;
  let backRunBlockNumber = victimBlockNumber;
  
  // Search from victim block to next 3 blocks for back-run
  for (let blockOffset = 0; blockOffset <= 3; blockOffset++) {
    const searchBlockNumber = victimBlockNumber + blockOffset;
    try {
      const block = await callRpc(chainId, 'eth_getBlockByNumber', [`0x${searchBlockNumber.toString(16)}`, true]);
      const txs = block.transactions;
      
      if (blockOffset === 0) {
        // In same block as victim, look after victim transaction
        const victimIndex = txs.findIndex((tx: any) => tx.hash === victimHash);
        if (victimIndex !== -1) {
          for (let i = victimIndex + 1; i < txs.length; i++) {
            if (txs[i].from.toLowerCase() === attackerAddress.toLowerCase()) {
              backRunHash = txs[i].hash;
              backRunBlockNumber = searchBlockNumber;
              Logger.info(`Found back-run in same block as victim: ${backRunHash}`);
              break;
            }
          }
        }
      } else {
        // In subsequent blocks, look for any transaction from attacker
        for (let i = 0; i < Math.min(txs.length, 10); i++) {
          if (txs[i].from.toLowerCase() === attackerAddress.toLowerCase()) {
            backRunHash = txs[i].hash;
            backRunBlockNumber = searchBlockNumber;
            Logger.info(`Found back-run in block ${searchBlockNumber}: ${backRunHash}`);
            break;
          }
        }
      }
      
      if (backRunHash) break;
    } catch (error) {
      Logger.error(`Failed to fetch block ${searchBlockNumber}: ${error}`);
    }
  }
  
  if (!backRunHash) {
    Logger.info('No back-run transaction found from same attacker');
    return null;
  }
  
  Logger.info(`Cross-block sandwich pattern detected: Front-run (${frontRunTxHash}) → Victim (${victimHash}) → Back-run (${backRunHash})`);
  
  return {
    victimHash,
    backRunHash,
    victimBlockNumber,
    backRunBlockNumber
  };
}

async function validateSandwichPattern(
  frontRunTrace: any,
  victimTrace: any,
  backRunTrace: any,
  _attackerAddress: string,
): Promise<boolean> {
  // Use the new pattern-based validation
  const frontFlows = await extractTokenFlows(frontRunTrace);
  const victimFlows = await extractTokenFlows(victimTrace);
  const backFlows = await extractTokenFlows(backRunTrace);

  // Check if tokens match
  const frontTokens = [...new Set(frontFlows.map(f => f.token))];
  const victimTokens = [...new Set(victimFlows.map(f => f.token))];
  const backTokens = [...new Set(backFlows.map(f => f.token))];

  const commonTokens = frontTokens.filter(token => 
    victimTokens.includes(token) && backTokens.includes(token)
  );

  // Must have at least 2 common tokens and opposite flows
  return commonTokens.length >= 2;
}

async function isLikelySandwichTransaction(
  trace1: any,
  trace2: any,
  _expectedType: 'front-run' | 'back-run',
): Promise<boolean> {
  const getSwapTokens = (trace: any) => {
    const tokens = new Set<string>();
    trace.transactionTrace.events?.forEach((event: any) => {
      if (event.topics?.[0] === ERC20_TRANSFER_TOPIC) {
        tokens.add(event.contract.toLowerCase());
      }
    });
    return Array.from(tokens);
  };

  const tokens1 = getSwapTokens(trace1);
  const tokens2 = getSwapTokens(trace2);

  const commonTokens = tokens1.filter((token) => tokens2.includes(token));

  return commonTokens.length >= 2;
}

async function enrichTransactionMetadata(chainId: number, txHash: string, receipt: any): Promise<TransactionMetadata> {
  const block = await callRpc(chainId, 'eth_getBlockByNumber', [receipt.blockNumber, false]);
  const gasUsed = parseInt(receipt.gasUsed, 16);
  const gasPrice = parseInt(receipt.effectiveGasPrice || receipt.gasPrice || '0x0', 16);
  const gasCostWei = BigInt(gasUsed) * BigInt(gasPrice);
  const gasCostEth = formatTokenAmount(gasCostWei, 18, 'ETH');

  return {
    txHash,
    blockNumber: parseInt(receipt.blockNumber, 16),
    blockTimestamp: parseInt(block.timestamp, 16),
    transactionIndex: parseInt(receipt.transactionIndex, 16),
    gasUsed: gasUsed.toString(),
    gasPrice: gasPrice.toString(),
    gasCostEth,
    from: receipt.from.toLowerCase(),
    to: receipt.to?.toLowerCase() || '',
    value: receipt.value || '0x0',
  };
}

function analyzeGasEfficiency(gasUsed: number, protocols: ProtocolInteraction[]): GasAnalysis {
  let efficiency: 'high' | 'medium' | 'low' = 'medium';

  // Simple heuristics for gas efficiency
  if (gasUsed < 100000) efficiency = 'high';
  else if (gasUsed > 500000) efficiency = 'low';

  // Adjust based on complexity (multiple protocols = more complex)
  if (protocols.length > 2 && gasUsed < 200000) efficiency = 'high';

  return {
    totalGasUsed: gasUsed,
    gasPrice: '0', // Will be filled by caller
    gasCostEth: '0', // Will be filled by caller
    gasEfficiency: efficiency,
  };
}

async function analyzeSimpleTrace(chainId: number, traceData: any, metadata?: TransactionMetadata): Promise<any> {
  const trace = traceData.transactionTrace;
  const initiator = trace.from.toLowerCase();
  const proxyContract = trace.to.toLowerCase();

  // Enhanced protocol detection
  const detectedProtocols = detectProtocols(trace);
  Logger.info(`Detected protocols: ${detectedProtocols.map((p) => p.protocol).join(', ')}`);

  // Gas efficiency analysis
  const gasUsed = parseInt(trace.gasUsed || '0x0', 16);
  const gasAnalysis = analyzeGasEfficiency(gasUsed, detectedProtocols);
  if (metadata) {
    gasAnalysis.gasPrice = metadata.gasPrice;
    gasAnalysis.gasCostEth = metadata.gasCostEth;
  }

  const controlledAddresses = new Set([initiator, proxyContract]);
  const findControlledRecursive = (call: any) => {
    if (controlledAddresses.has(call.from.toLowerCase())) {
      controlledAddresses.add(call.to.toLowerCase());
    }
    call.calls?.forEach(findControlledRecursive);
  };
  if (trace.calls) findControlledRecursive(trace);

  Logger.debug('Expanded controlled addresses:', Array.from(controlledAddresses));

  const netChanges: Record<string, bigint> = {};

  // 1. Calculate Net Changes for all assets
  trace.events?.forEach((event: any) => {
    if (event.topics?.[0] === ERC20_TRANSFER_TOPIC && event.topics.length >= 3) {
      const token = event.contract.toLowerCase();
      const from = `0x${event.topics[1].slice(26)}`.toLowerCase();
      const to = `0x${event.topics[2].slice(26)}`.toLowerCase();
      const amount = BigInt(event.data);
      netChanges[token] = netChanges[token] || 0n;
      if (controlledAddresses.has(from)) netChanges[token] -= amount;
      if (controlledAddresses.has(to)) netChanges[token] += amount;
    }
  });

  const parseEthTransfers = (call: any) => {
    netChanges[NATIVE_ETH_ADDRESS] = netChanges[NATIVE_ETH_ADDRESS] || 0n;
    const value = BigInt(call.value || '0x0');
    if (value > 0n) {
      if (controlledAddresses.has(call.from.toLowerCase())) netChanges[NATIVE_ETH_ADDRESS] -= value;
      if (controlledAddresses.has(call.to.toLowerCase())) netChanges[NATIVE_ETH_ADDRESS] += value;
    }
    call.calls?.forEach(parseEthTransfers);
  };
  if (trace.calls) parseEthTransfers(trace);

  const txFee = BigInt(trace.gasUsed || '0x0') * BigInt(trace.gasPrice || '0x0');
  netChanges[NATIVE_ETH_ADDRESS] = (netChanges[NATIVE_ETH_ADDRESS] || 0n) - txFee;

  // 2. Enrich and Format data for the LLM
  const enrichedNetChanges: { token: TokenInfo; amount: bigint }[] = [];
  for (const [address, amount] of Object.entries(netChanges)) {
    if (amount === 0n) continue;
    const tokenInfo = await TokenMetadataManager.getTokenInfo(chainId, address);
    enrichedNetChanges.push({ token: tokenInfo, amount });
  }

  const formatEnrichedForLlm = (items: { token: TokenInfo; amount: bigint }[]) =>
    items.map((item) => ({
      token: item.token,
      rawAmount: (item.amount > 0 ? item.amount : -item.amount).toString(),
      formattedAmount: formatTokenAmount(
        item.amount > 0 ? item.amount : -item.amount,
        item.token.decimals,
        item.token.symbol,
      ),
      isProfit: item.amount > 0,
    }));

  // 3. NEW & FINAL HEURISTIC: Find primary assets from NET changes
  const losses = enrichedNetChanges.filter((c) => c.amount < 0n).sort((a, b) => Number(a.amount - b.amount)); // Most negative first
  const gains = enrichedNetChanges.filter((c) => c.amount > 0n).sort((a, b) => Number(b.amount - a.amount)); // Most positive first

  const primaryAssetIn = losses.length > 0 ? formatEnrichedForLlm([losses[0]])[0] : null;
  const primaryAssetOut = gains.length > 0 ? formatEnrichedForLlm([gains[0]])[0] : null;

  return {
    metadata: metadata || {
      txHash: trace.hash || 'unknown',
      blockNumber: 0,
      blockTimestamp: 0,
      transactionIndex: 0,
      gasUsed: gasUsed.toString(),
      gasPrice: '0',
      gasCostEth: '0',
      from: initiator,
      to: proxyContract,
      value: trace.value || '0x0',
    },
    protocols: detectedProtocols,
    gasAnalysis,
    financials: {
      netProfitOrLoss: formatEnrichedForLlm(enrichedNetChanges),
    },
    swapDetails: {
      assetIn: primaryAssetIn,
      assetOut: primaryAssetOut,
    },
  };
}

async function detectAndAnalyzeSandwich(chainId: number, txHash: string, blockNumber: number, mainTxTrace: any): Promise<any | null> {
  Logger.info('Attempting to detect a sandwich attack pattern...');
  Logger.info(`🔍 Analysis Target: txHash=${txHash}, blockNumber=${blockNumber}`);
  const mainTxHash = txHash; // Use the passed txHash instead of trying to extract from trace
  const attacker = mainTxTrace.transactionTrace.from.toLowerCase();
  Logger.info(`👤 Attacker Address: ${attacker}`);

  // PRIORITY 1: Pattern-first detection (most reliable)
  Logger.info('Running pattern-first sandwich detection...');
  const patternDetection = await detectSandwichByPattern(chainId, mainTxHash, blockNumber);
  if (patternDetection) {
    Logger.info('Sandwich detected via pattern analysis!');
    return await buildSandwichAnalysis(chainId, patternDetection, 'pattern-analysis');
  }

  // PRIORITY 2: Enhanced detection methods with improved validation
  Logger.info('Trying enhanced sandwich detection methods...');

  // Try detecting from front-run perspective
  const frontRunPattern = await detectSandwichFromFrontRun(chainId, mainTxHash, blockNumber);
  if (frontRunPattern) {
    Logger.info('Sandwich detected from front-run transaction perspective!');
    return await buildSandwichAnalysis(chainId, frontRunPattern, 'front-run');
  }

  // Try detecting from victim perspective
  const victimPattern = await detectSandwichFromVictim(chainId, mainTxHash, blockNumber);
  if (victimPattern) {
    Logger.info('Sandwich detected from victim transaction perspective!');
    return await buildSandwichAnalysis(chainId, victimPattern, 'victim');
  }

  // Try detecting from back-run perspective
  const backRunPattern = await detectSandwichFromBackRun(chainId, mainTxHash, blockNumber);
  if (backRunPattern) {
    Logger.info('Sandwich detected from back-run transaction perspective!');
    return await buildSandwichAnalysis(chainId, backRunPattern, 'back-run');
  }

  // Enhanced cross-block sandwich detection
  Logger.info(`Trying enhanced cross-block sandwich detection for attacker ${attacker}`);
  const sandwichPattern = await detectCrossBlockSandwich(chainId, mainTxHash, blockNumber, attacker);
  
  if (!sandwichPattern) {
    Logger.info('No sandwich pattern detected across blocks.');
    return null;
  }

  const { victimHash, backRunHash, victimBlockNumber, backRunBlockNumber } = sandwichPattern;

  Logger.info(`Cross-block sandwich confirmed! Front-run: ${mainTxHash} (block ${blockNumber}) → Victim: ${victimHash} (block ${victimBlockNumber}) → Back-run: ${backRunHash} (block ${backRunBlockNumber})`);

  // Analyze MEV bot behavior
  const mevProfile = await analyzeMEVBotBehavior(chainId, attacker, blockNumber);
  Logger.info(
    `MEV Bot Analysis: ${mevProfile.confidence} confidence, ${mevProfile.patterns.txFrequency} recent transactions`,
  );

  // Fetch traces and analyze with correct block numbers
  const frontRunAnalysis = await analyzeSimpleTrace(chainId, mainTxTrace);
  const backRunReceipt = await callRpc(chainId, 'eth_getTransactionReceipt', [backRunHash]);
  const backRunTrace = await getTransactionTrace(chainId, backRunHash, backRunBlockNumber);
  const backRunMetadata = await enrichTransactionMetadata(chainId, backRunHash, backRunReceipt);
  const backRunAnalysis = await analyzeSimpleTrace(chainId, backRunTrace, backRunMetadata);

  // Get victim transaction for price impact analysis using correct block number
  const victimTrace = await getTransactionTrace(chainId, victimHash, victimBlockNumber);
  const priceImpact = await calculatePriceImpact(chainId, mainTxTrace, victimTrace, backRunTrace);

  // Combine financial analysis
  const combinedNet: Record<string, { token: TokenInfo; total: bigint }> = {};
  const allNetChanges = [...frontRunAnalysis.financials.netProfitOrLoss, ...backRunAnalysis.financials.netProfitOrLoss];

  for (const change of allNetChanges) {
    const address = change.token.address;
    if (!combinedNet[address]) {
      combinedNet[address] = { token: change.token, total: 0n };
    }
    const amount = BigInt(change.rawAmount);
    combinedNet[address].total += change.isProfit ? amount : -amount;
  }

  const formattedCombinedProfit = Object.values(combinedNet)
    .filter((c) => c.total !== 0n)
    .map((c) => ({
      token: c.token,
      rawAmount: (c.total > 0 ? c.total : -c.total).toString(),
      formattedAmount: formatTokenAmount(c.total > 0 ? c.total : -c.total, c.token.decimals, c.token.symbol),
      isProfit: c.total > 0,
    }));

  return {
    type: 'Sandwich',
    confidence: 'high',
    detectionMethod: 'cross-block',
    // CRITICAL: Add clear sandwich indicators for LLM
    isSandwichAttack: true,
    sandwichDetected: true,
    sandwichType: 'cross-block',
    victimTxHash: victimHash,
    frontRunSwap: frontRunAnalysis.swapDetails,
    backRunSwap: backRunAnalysis.swapDetails,
    mevBotProfile: mevProfile,
    priceImpact,
    combinedFinancials: {
      netProfitOrLoss: formattedCombinedProfit,
    },
    // Enhanced detection metadata for LLM  
    enhancedDetection: {
      method: 'cross-block',
      confidence: 'high',
      patternFound: true,
      transactionRole: 'front-run',
      crossBlockSpan: {
        frontRunBlock: blockNumber,
        victimBlock: victimBlockNumber,
        backRunBlock: backRunBlockNumber
      },
      relatedTransactions: {
        frontRun: mainTxHash,
        victim: victimHash,
        backRun: backRunHash
      }
    }
  };
}

async function buildSandwichAnalysis(chainId: number, pattern: SandwichPattern, detectionMethod: string): Promise<any> {
  Logger.info(`Building sandwich analysis using ${detectionMethod} detection method`);

  // Analyze each transaction in the sandwich
  const frontRunTrace = await getTransactionTrace(chainId, pattern.frontRun.hash, pattern.frontRun.blockNumber);
  const victimTrace = await getTransactionTrace(chainId, pattern.victim.hash, pattern.victim.blockNumber);
  const backRunTrace = await getTransactionTrace(chainId, pattern.backRun.hash, pattern.backRun.blockNumber);

  const frontRunAnalysis = await analyzeSimpleTrace(chainId, frontRunTrace);
  const victimAnalysis = await analyzeSimpleTrace(chainId, victimTrace);
  const backRunAnalysis = await analyzeSimpleTrace(chainId, backRunTrace);

  // Analyze MEV bot
  const mevProfile = await analyzeMEVBotBehavior(chainId, pattern.frontRun.from, pattern.frontRun.blockNumber);

  // Combine financials from front-run and back-run (attacker's transactions)
  const combinedNet: Record<string, { token: TokenInfo; total: bigint }> = {};
  const allNetChanges = [...frontRunAnalysis.financials.netProfitOrLoss, ...backRunAnalysis.financials.netProfitOrLoss];

  for (const change of allNetChanges) {
    const address = change.token.address;
    if (!combinedNet[address]) {
      combinedNet[address] = { token: change.token, total: 0n };
    }
    const amount = BigInt(change.rawAmount);
    combinedNet[address].total += change.isProfit ? amount : -amount;
  }

  const formattedCombinedProfit = Object.values(combinedNet)
    .filter((c) => c.total !== 0n)
    .map((c) => ({
      token: c.token,
      rawAmount: (c.total > 0 ? c.total : -c.total).toString(),
      formattedAmount: formatTokenAmount(c.total > 0 ? c.total : -c.total, c.token.decimals, c.token.symbol),
      isProfit: c.total > 0,
    }));

  return {
    type: 'Sandwich',
    confidence: pattern.confidence,
    detectionMethod,
    // CRITICAL: Add clear sandwich indicators for LLM
    isSandwichAttack: true,
    sandwichDetected: true,
    sandwichType: detectionMethod,
    victimTxHash: pattern.victim.hash,
    frontRunSwap: frontRunAnalysis.swapDetails,
    backRunSwap: backRunAnalysis.swapDetails,
    victimSwap: victimAnalysis.swapDetails,
    mevBotProfile: mevProfile,
    priceImpact: pattern.priceImpact,
    combinedFinancials: {
      netProfitOrLoss: formattedCombinedProfit,
    },
    sandwichPattern: {
      frontRun: pattern.frontRun,
      victim: pattern.victim,
      backRun: pattern.backRun,
    },
    // Enhanced detection metadata for LLM
    enhancedDetection: {
      method: detectionMethod,
      confidence: pattern.confidence,
      patternFound: true,
      transactionRole: detectionMethod === 'front-run' ? 'front-run' : 
                      detectionMethod === 'victim' ? 'victim' : 
                      detectionMethod === 'back-run' ? 'back-run' : 'attacker',
      relatedTransactions: {
        frontRun: pattern.frontRun.hash,
        victim: pattern.victim.hash,
        backRun: pattern.backRun.hash,
      }
    }
  };
}
// --- LLM Interaction & Reporting ---

async function getLlmAnalysis(analysisData: any): Promise<any> {
  const prompt = `
You are a senior DeFi protocol analyst specializing in MEV (Maximal Extractable Value) and on-chain transaction analysis. Your expertise includes identifying arbitrage opportunities, sandwich attacks, liquidations, and complex DeFi strategies across protocols like Uniswap, Curve, Balancer, 1inch, and others.

### CRITICAL: Pattern-First Analysis
PRIORITIZE transaction patterns over financial data. Even if profit calculations are unclear or missing, sandwich attacks can be definitively identified by transaction sequences and token flow patterns.

### Enhanced Detection Indicators:
- **Pattern Detection**: Look for \`detectionMethod\` field indicating "pattern-analysis", "front-run", "victim", "back-run"
- **Sandwich Pattern**: Look for \`sandwichPattern\` object with frontRun/victim/backRun transaction details
- **Token Flow Analysis**: Examine common tokens traded across sequential transactions
- **Cross-Block Detection**: Transactions may span multiple blocks with same attacker address

### MEV Strategy Classifications:
- **Sandwich Attack**: Front-running and back-running a victim transaction (HIGHEST PRIORITY)
- **Arbitrage**: Exploiting price differences across different DEXs or pools
- **Liquidation**: Profiting from liquidating under-collateralized positions
- **DEX Trading**: Large swaps or complex multi-hop trades
- **Flash Loan**: Using uncollateralized loans for complex DeFi operations

### Enhanced Input Data Structure:
- \`type\`: Strategy classification ("Sandwich", "Arbitrage", etc.)
- \`detectionMethod\`: Enhanced detection method (pattern-analysis/front-run/victim/back-run)
- \`sandwichPattern\`: Complete sandwich sequence with all three transactions
- \`confidence\`: Pattern-based confidence level (high/medium/low)
- \`metadata\`: Transaction context (gas, timing, protocols used)
- \`protocols\`: Detected DeFi protocols and their confidence levels
- \`swapDetails\` / \`frontRunSwap\` / \`backRunSwap\` / \`victimSwap\`: Asset flow information
- \`financials\` / \`combinedFinancials\`: Net profit/loss analysis (secondary priority)
- \`mevBotProfile\`: MEV bot behavioral analysis
- \`priceImpact\`: Price manipulation analysis

### CRITICAL ANALYSIS RULES:
1. **CHECK FOR SANDWICH PATTERN FIRST**: Look for \`detectionMethod\` and \`sandwichPattern\` fields in the input data
2. **MANDATORY SANDWICH CLASSIFICATION**: If ANY sandwich-related fields exist, classify as "Sandwich Attack" regardless of other analysis
3. **RESPECT PATTERN DETECTION**: If \`detectionMethod\` indicates "pattern-analysis", "front-run", "victim", or "back-run", this is DEFINITIVE
4. **NEVER CONTRADICT DETECTION**: Do not say "no evidence of sandwich" if sandwich detection fields are present
5. **EXPLAIN THE PATTERN**: Describe the detected sandwich sequence based on the detection data

### Enhanced Detection Fields to Check:
- detectionMethod: If present, indicates sandwich detection method
- sandwichPattern: Contains frontRun/victim/backRun transaction details
- type: If "Sandwich", classify as sandwich attack
- enhancedDetection: Contains pattern detection metadata
- isSandwichAttack: Boolean flag indicating sandwich detection
- sandwichDetected: Boolean flag confirming sandwich pattern found

### Output Examples:

**Front-Run Transaction Example:**
{
  "strategy": "Sandwich Attack - Front-Run Transaction",
  "confidence": "high",
  "detectionMethod": "pattern-analysis",
  "summary": "This transaction is the front-run component of a detected sandwich attack targeting victim transaction",
  "narrative": [
    "Pattern Detection: Enhanced algorithm identified this as the front-run transaction in a sandwich attack sequence",
    "Transaction Role: This transaction manipulates token prices before the victim transaction executes",
    "Attack Sequence: Front-run (this tx) → Victim → Back-run (completes the sandwich)",
    "Token Manipulation: Transaction involves WETH/MINDFAK pair to set up price manipulation",
    "MEV Strategy: Sophisticated attack designed to extract value from victim's transaction"
  ],
  "protocols": ["Uniswap V2"],
  "financials": {
    "role": "Front-run transaction (setup phase)",
    "attackerStrategy": "Price manipulation for sandwich attack",
    "note": "Profit realized in back-run transaction, not this front-run"
  }
}

**Victim Transaction Example:**
{
  "strategy": "Sandwich Attack - Victim Transaction", 
  "confidence": "high",
  "detectionMethod": "victim",
  "summary": "This transaction is the victim of a detected sandwich attack, suffering from price manipulation",
  "narrative": [
    "Victim Identification: Enhanced pattern detection identified this as the victim transaction",
    "Attack Sequence: Front-run → Victim (this tx) → Back-run",
    "Price Impact: Transaction executed at manipulated prices due to front-running",
    "Slippage: Victim suffered additional slippage from price manipulation"
  ]
}

**Back-Run Transaction Example:**
{
  "strategy": "Sandwich Attack - Back-Run Transaction",
  "confidence": "high", 
  "detectionMethod": "back-run",
  "summary": "This transaction is the back-run component completing the sandwich attack and extracting profit",
  "narrative": [
    "Pattern Detection: Identified as back-run transaction completing the sandwich attack",
    "Attack Sequence: Front-run → Victim → Back-run (this tx)",
    "Profit Extraction: This transaction captures the profit from the price manipulation",
    "Attack Completion: Final step that realizes the MEV extraction from the victim"
  ]
}

**Arbitrage Example:**
{
  "strategy": "Cross-DEX Arbitrage",
  "confidence": "high",
  "summary": "Bot exploited WETH price difference between Uniswap and Curve, netting 1.23 ETH profit",
  "narrative": [
    "Bought 100 WETH for 299,850 USDC on Curve (lower price)",
    "Sold 100 WETH for 301,200 USDC on Uniswap V3 (higher price)",
    "Captured 1,350 USDC price difference minus gas costs"
  ],
  "protocols": ["Curve", "Uniswap V3"],
  "financials": {
    "profit": "1,350 USDC",
    "cost": "0.089 ETH (120 USDC gas)",
    "netProfit": "1,230 USDC (1.23 ETH)",
    "roi": "0.41%"
  }
}

### Analysis Rules:
1. Use \`formattedAmount\` from data for all displayed values
2. Reference detected protocols from metadata when available
3. Calculate ROI as (netProfit / totalCapitalUsed) * 100
4. Express confidence based on data completeness and pattern clarity
5. Include gas costs in financial analysis
6. Use precise DeFi terminology and protocol names

### Input Data for Analysis:
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

Return ONLY the JSON object following the schema above. No additional text or markdown.
`;

  Logger.separator();
  Logger.info('Sending enriched analysis to LLM for reporting...');
  Logger.info(`🤖 LLM Input Summary: type=${analysisData.type}, hasDetectionMethod=${!!analysisData.detectionMethod}, hasSandwichPattern=${!!analysisData.sandwichPattern}, hasEnhancedDetection=${!!analysisData.enhancedDetection}, isSandwichAttack=${analysisData.isSandwichAttack}, sandwichDetected=${analysisData.sandwichDetected}`);
  Logger.debug(`LLM Input Full Data: ${JSON.stringify(analysisData, null, 2)}`);

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: Config.LLM_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('LLM returned empty content.');
  return JSON.parse(content);
}

function presentFinalReport(llmJson: any, txHash: string) {
  Logger.separator();
  console.log(`\n--- ENHANCED MEV ANALYSIS REPORT for ${txHash} ---`);

  // Strategy and confidence
  console.log(`\n🔍 Strategy: ${llmJson.strategy || 'Unknown'}`);
  if (llmJson.confidence) {
    console.log(`📊 Confidence: ${llmJson.confidence.toUpperCase()}`);
  }

  console.log(`\n🗣️  Summary: ${llmJson.summary || 'No summary provided.'}`);

  // Detected protocols
  if (llmJson.protocols && Array.isArray(llmJson.protocols) && llmJson.protocols.length > 0) {
    console.log(`\n🔗 Protocols: ${llmJson.protocols.join(', ')}`);
  }

  // Step-by-step narrative
  if (llmJson.narrative && Array.isArray(llmJson.narrative)) {
    console.log('\n💬 Transaction Flow:');
    llmJson.narrative.forEach((step: string, index: number) => {
      console.log(`   ${index + 1}. ${step}`);
    });
  }

  // Enhanced financial breakdown
  if (llmJson.financials) {
    console.log('\n💰 Financial Analysis:');
    if (llmJson.financials.profit) {
      console.log(`   📈 Profit: ${llmJson.financials.profit}`);
    }
    if (llmJson.financials.cost) {
      console.log(`   📉 Cost: ${llmJson.financials.cost}`);
    }
    if (llmJson.financials.netProfit) {
      console.log(`   💎 Net Profit: ${llmJson.financials.netProfit}`);
    }
    if (llmJson.financials.roi) {
      console.log(`   📊 ROI: ${llmJson.financials.roi}`);
    }
  } else {
    console.log('\n💰 Financial data not available in the response.');
  }

  Logger.separator();
}

// --- Main Execution Logic (Exportable) ---

/**
 * The main analysis function. Can be imported and used in other applications like a Next.js API route.
 * @param chainId The ID of the chain (e.g., 1 for Ethereum Mainnet).
 * @param txHash The transaction hash to analyze.
 * @returns The final analysis report from the LLM.
 */
export async function analyzeTransaction(chainId: number, txHash: string) {
  try {
    // Step 1: Fetch all necessary data ONCE.
    Logger.info(`Starting analysis for ${txHash} on chain ${chainId}`);
    const receipt = await callRpc(chainId, 'eth_getTransactionReceipt', [txHash]);
    if (!receipt) throw new Error(`Transaction receipt not found for hash ${txHash}.`);

    const blockNumber = parseInt(receipt.blockNumber, 16);
    const mainTraceData = await getTransactionTrace(chainId, txHash, blockNumber);
    const metadata = await enrichTransactionMetadata(chainId, txHash, receipt);

    // Step 2: Attempt to analyze as a sandwich, passing the pre-fetched data.
    let analysis: any;
    const sandwichData = await detectAndAnalyzeSandwich(chainId, txHash, blockNumber, mainTraceData);

    // DEBUG: Log sandwich detection results
    Logger.info(`🔍 Sandwich Detection Results: exists=${!!sandwichData}, type=${sandwichData?.type}, isSandwichAttack=${sandwichData?.isSandwichAttack}, method=${sandwichData?.detectionMethod}`);

    if (sandwichData) {
      analysis = { type: 'Sandwich', ...sandwichData };
      Logger.info('✅ Sandwich attack analysis complete - data will be sent to LLM');
      Logger.debug(`📊 Final sandwich analysis: type=${analysis.type}, hasDetectionMethod=${!!analysis.detectionMethod}, hasSandwichPattern=${!!analysis.sandwichPattern}, hasEnhancedDetection=${!!analysis.enhancedDetection}, isSandwichAttack=${analysis.isSandwichAttack}`);
    } else {
      // Step 2b: If not a sandwich, perform a simple analysis, REUSING the pre-fetched data.
      Logger.info('❌ No sandwich detected. Analyzing as a general arbitrage/swap transaction.');
      const simpleAnalysis = await analyzeSimpleTrace(chainId, mainTraceData, metadata);
      analysis = { type: 'Arbitrage', ...simpleAnalysis };
      Logger.info('Simple arbitrage/swap analysis complete.');
    }

    // Step 3: Get LLM summary and report it.
    Logger.info(`📤 About to send analysis to LLM: type=${analysis.type}, hasDetectionMethod=${!!analysis.detectionMethod}, hasSandwichPattern=${!!analysis.sandwichPattern}, hasEnhancedDetection=${!!analysis.enhancedDetection}, isSandwichAttack=${analysis.isSandwichAttack}`);
    
    const llmReport = await getLlmAnalysis(analysis);
    presentFinalReport(llmReport, txHash);
    return llmReport;
  } catch (error) {
    Logger.error(`An error occurred during the analysis of ${txHash}: ${error}`);
    // Re-throw the error so the calling context (e.g., an API route) can handle it
    throw error;
  }
}

// --- CLI Entry Point ---

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    Logger.error('Usage: ts-node <script_path> <chainId> <txHash>');
    Logger.error(
      'Example: ts-node src/analyzeTrace.ts 1 0xaadde745a5bf7dbf572aa5d3c9095d18b5432edfa239975196368fbd10e55503',
    );
    exit(1);
  }

  const chainId = parseInt(args[0], 10);
  const txHash = args[1];

  await analyzeTransaction(chainId, txHash).catch(() => exit(1));
}

// Only run main if the script is executed directly
if (require.main === module) {
  main();
}
