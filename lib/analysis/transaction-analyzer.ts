import { ERC20_TRANSFER_TOPIC, NATIVE_ETH_ADDRESS, KNOWN_PROTOCOLS, MEV_BOT_PATTERNS, MEV_BOT_HEURISTICS, Logger } from '../constants';
import { formatTokenAmount } from '../utils';
import type { TokenInfo, TransactionMetadata, ProtocolInteraction, GasAnalysis, SandwichPattern, MEVBotProfile } from '../types';
// Type definitions are now imported from ../types
// Constants and Logger are now imported from ../constants
import { getLlmAnalysis } from './llm';
import { callRpc, getTransactionTrace } from '../api/1inch';
import { detectCrossBlockSandwich, detectSandwichByPattern, detectSandwichFromBackRun, detectSandwichFromFrontRun, detectSandwichFromVictim } from './detect-sandwich';
import { TokenMetadataManager } from './tokens';
import { calculatePriceImpact } from './calculations';
import { detectArbitrage } from './detect-arbitrage';

// --- Core Analysis Functions ---

/**
 * Detect protocols involved in the transaction
 */
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
    if (address && KNOWN_PROTOCOLS[ address as keyof typeof KNOWN_PROTOCOLS ]) {
      protocols.push({
        address,
        protocol: KNOWN_PROTOCOLS[ address as keyof typeof KNOWN_PROTOCOLS ],
        confidence: 'high',
      });
    }
  }

  return protocols;
}

/**
 * Analyze MEV bot behavior patterns
 */
async function analyzeMEVBotBehavior(chainId: number, address: string, blockNumber: number): Promise<MEVBotProfile> {
  const lowerAddress = address.toLowerCase();

  if (MEV_BOT_PATTERNS[ lowerAddress as keyof typeof MEV_BOT_PATTERNS ]) {
    return {
      address: lowerAddress,
      confidence: 'high',
      patterns: {
        avgGasPrice: 'Known Bot',
        txFrequency: 0,
        successRate: 1.0,
        preferredProtocols: [ 'Multiple' ],
      },
    };
  }

  try {
    const recentTxs = [];

    for (let i = 0; i < 5; i++) {
      const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${(blockNumber - i).toString(16)}`, true ]);
      const txsFromAddress = block.transactions.filter((tx: any) => tx.from.toLowerCase() === lowerAddress);
      recentTxs.push(...txsFromAddress);
    }

    const avgGasPrice =
      recentTxs.length > 0 ? (recentTxs.reduce((sum, tx) => sum + parseInt(tx.gasPrice || '0x0', 16), 0) / recentTxs.length / 1e9).toFixed(2) + ' Gwei' : '0 Gwei';

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
        preferredProtocols: [ 'DEX' ],
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

/**
 * Enrich transaction with metadata (gas, timing, etc.)
 */
async function enrichTransactionMetadata(chainId: number, txHash: string, receipt: any): Promise<TransactionMetadata> {
  const block = await callRpc(chainId, 'eth_getBlockByNumber', [ receipt.blockNumber, false ]);
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

/**
 * Analyze gas efficiency based on usage and protocol complexity
 */
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

/**
 * Analyze transaction trace for basic swap/trade patterns
 */
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

  const controlledAddresses = new Set([ initiator, proxyContract ]);
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
    if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC && event.topics.length >= 3) {
      const token = event.contract.toLowerCase();
      const from = `0x${event.topics[ 1 ].slice(26)}`.toLowerCase();
      const to = `0x${event.topics[ 2 ].slice(26)}`.toLowerCase();
      const amount = BigInt(event.data);
      netChanges[ token ] = netChanges[ token ] || 0n;
      if (controlledAddresses.has(from)) netChanges[ token ] -= amount;
      if (controlledAddresses.has(to)) netChanges[ token ] += amount;
    }
  });

  const parseEthTransfers = (call: any) => {
    netChanges[ NATIVE_ETH_ADDRESS ] = netChanges[ NATIVE_ETH_ADDRESS ] || 0n;
    const value = BigInt(call.value || '0x0');
    if (value > 0n) {
      if (controlledAddresses.has(call.from.toLowerCase())) netChanges[ NATIVE_ETH_ADDRESS ] -= value;
      if (controlledAddresses.has(call.to.toLowerCase())) netChanges[ NATIVE_ETH_ADDRESS ] += value;
    }
    call.calls?.forEach(parseEthTransfers);
  };
  if (trace.calls) parseEthTransfers(trace);

  const txFee = BigInt(trace.gasUsed || '0x0') * BigInt(trace.gasPrice || '0x0');
  netChanges[ NATIVE_ETH_ADDRESS ] = (netChanges[ NATIVE_ETH_ADDRESS ] || 0n) - txFee;

  // 2. Enrich and Format data for the LLM
  const enrichedNetChanges: { token: TokenInfo; amount: bigint }[] = [];
  for (const [ address, amount ] of Object.entries(netChanges)) {
    if (amount === 0n) continue;
    const tokenInfo = await TokenMetadataManager.getTokenInfo(chainId, address);
    enrichedNetChanges.push({ token: tokenInfo, amount });
  }

  const formatEnrichedForLlm = (items: { token: TokenInfo; amount: bigint }[]) =>
    items.map((item) => ({
      token: item.token,
      rawAmount: (item.amount > 0 ? item.amount : -item.amount).toString(),
      formattedAmount: formatTokenAmount(item.amount > 0 ? item.amount : -item.amount, item.token.decimals, item.token.symbol),
      isProfit: item.amount > 0,
    }));

  // 3. FIXED: Only include actual net changes (non-zero profits/losses)
  // Filter out zero net changes to show only actual profit/loss per token
  const actualNetChanges = enrichedNetChanges.filter((c) => c.amount !== 0n);

  const losses = actualNetChanges.filter((c) => c.amount < 0n).sort((a, b) => Number(a.amount - b.amount)); // Most negative first
  const gains = actualNetChanges.filter((c) => c.amount > 0n).sort((a, b) => Number(b.amount - a.amount)); // Most positive first

  const primaryAssetIn = losses.length > 0 ? formatEnrichedForLlm([ losses[ 0 ] ])[ 0 ] : null;
  const primaryAssetOut = gains.length > 0 ? formatEnrichedForLlm([ gains[ 0 ] ])[ 0 ] : null;

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
      netProfitOrLoss: formatEnrichedForLlm(actualNetChanges),
    },
    swapDetails: {
      assetIn: primaryAssetIn,
      assetOut: primaryAssetOut,
    },
  };
}

/**
 * Comprehensive sandwich attack detection and analysis
 */
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

  Logger.info(
    `Cross-block sandwich confirmed! Front-run: ${mainTxHash} (block ${blockNumber}) → Victim: ${victimHash} (block ${victimBlockNumber}) → Back-run: ${backRunHash} (block ${backRunBlockNumber})`
  );

  // Analyze MEV bot behavior
  const mevProfile = await analyzeMEVBotBehavior(chainId, attacker, blockNumber);
  Logger.info(`MEV Bot Analysis: ${mevProfile.confidence} confidence, ${mevProfile.patterns.txFrequency} recent transactions`);

  // Fetch traces and analyze with correct block numbers
  const frontRunAnalysis = await analyzeSimpleTrace(chainId, mainTxTrace);
  const backRunReceipt = await callRpc(chainId, 'eth_getTransactionReceipt', [ backRunHash ]);
  const backRunTrace = await getTransactionTrace(chainId, backRunHash, backRunBlockNumber);
  const backRunMetadata = await enrichTransactionMetadata(chainId, backRunHash, backRunReceipt);
  const backRunAnalysis = await analyzeSimpleTrace(chainId, backRunTrace, backRunMetadata);

  // Get victim transaction for price impact analysis using correct block number
  const victimTrace = await getTransactionTrace(chainId, victimHash, victimBlockNumber);
  const priceImpact = await calculatePriceImpact(chainId, mainTxTrace, victimTrace, backRunTrace);

  // Combine financial analysis
  const combinedNet: Record<string, { token: TokenInfo; total: bigint }> = {};
  const allNetChanges = [ ...frontRunAnalysis.financials.netProfitOrLoss, ...backRunAnalysis.financials.netProfitOrLoss ];

  for (const change of allNetChanges) {
    const address = change.token.address;
    if (!combinedNet[ address ]) {
      combinedNet[ address ] = { token: change.token, total: 0n };
    }
    const amount = BigInt(change.rawAmount);
    combinedNet[ address ].total += change.isProfit ? amount : -amount;
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
        backRunBlock: backRunBlockNumber,
      },
      relatedTransactions: {
        frontRun: mainTxHash,
        victim: victimHash,
        backRun: backRunHash,
      },
    },
  };
}

/**
 * Build comprehensive sandwich analysis from detected pattern
 */
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
  const allNetChanges = [ ...frontRunAnalysis.financials.netProfitOrLoss, ...backRunAnalysis.financials.netProfitOrLoss ];

  for (const change of allNetChanges) {
    const address = change.token.address;
    if (!combinedNet[ address ]) {
      combinedNet[ address ] = { token: change.token, total: 0n };
    }
    const amount = BigInt(change.rawAmount);
    combinedNet[ address ].total += change.isProfit ? amount : -amount;
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
      transactionRole: detectionMethod === 'front-run' ? 'front-run' : detectionMethod === 'victim' ? 'victim' : detectionMethod === 'back-run' ? 'back-run' : 'attacker',
      relatedTransactions: {
        frontRun: pattern.frontRun.hash,
        victim: pattern.victim.hash,
        backRun: pattern.backRun.hash,
      },
    },
  };
}
// --- Reporting Functions ---

/**
 * Present the final analysis report to console
 */
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

/**
 * Main transaction analysis function - detects MEV patterns and generates comprehensive reports
 */
export async function analyzeTransaction(chainId: number, txHash: string) {
  try {
    // Step 1: Fetch all necessary data ONCE.
    Logger.info(`Starting analysis for ${txHash} on chain ${chainId}`);
    const receipt = await callRpc(chainId, 'eth_getTransactionReceipt', [ txHash ]);
    if (!receipt) throw new Error(`Transaction receipt not found for hash ${txHash}.`);

    const blockNumber = parseInt(receipt.blockNumber, 16);
    const mainTraceData = await getTransactionTrace(chainId, txHash, blockNumber);
    const metadata = await enrichTransactionMetadata(chainId, txHash, receipt);

    // Step 2: Attempt to analyze as a sandwich, passing the pre-fetched data.
    let analysis: any;
    const sandwichData = await detectAndAnalyzeSandwich(chainId, txHash, blockNumber, mainTraceData);

    // DEBUG: Log sandwich detection results
    Logger.info(
      `🔍 Sandwich Detection Results: exists=${!!sandwichData}, type=${sandwichData?.type}, isSandwichAttack=${sandwichData?.isSandwichAttack}, method=${sandwichData?.detectionMethod
      }`
    );

    if (sandwichData) {
      analysis = { type: 'Sandwich', ...sandwichData };
      Logger.info('✅ Sandwich attack analysis complete - data will be sent to LLM');
      Logger.debug(
        `📊 Final sandwich analysis: type=${analysis.type
        }, hasDetectionMethod=${!!analysis.detectionMethod}, hasSandwichPattern=${!!analysis.sandwichPattern}, hasEnhancedDetection=${!!analysis.enhancedDetection}, isSandwichAttack=${analysis.isSandwichAttack
        }`
      );
    } else {
      // Step 2b: If not a sandwich, check for arbitrage patterns
      Logger.info('❌ No sandwich detected. Checking for arbitrage patterns...');
      const arbitrageAnalysis = await detectArbitrage(chainId, txHash, mainTraceData, metadata);

      if (arbitrageAnalysis) {
        Logger.info('✅ Arbitrage pattern detected!');
        analysis = { type: 'Arbitrage', ...arbitrageAnalysis };
      } else {
        // Fallback to simple analysis
        Logger.info('No specific MEV pattern detected. Analyzing as general swap transaction.');
        const simpleAnalysis = await analyzeSimpleTrace(chainId, mainTraceData, metadata);
        analysis = { type: 'Swap', ...simpleAnalysis };
      }
    }

    // Step 3: Get LLM summary and report it.
    Logger.info(
      `📤 About to send analysis to LLM: type=${analysis.type
      }, hasDetectionMethod=${!!analysis.detectionMethod}, hasSandwichPattern=${!!analysis.sandwichPattern}, hasEnhancedDetection=${!!analysis.enhancedDetection}, isSandwichAttack=${analysis.isSandwichAttack
      }`
    );

    const llmReport = await getLlmAnalysis(analysis);
    presentFinalReport(llmReport, txHash);
    return llmReport;
  } catch (error) {
    Logger.error(`An error occurred during the analysis of ${txHash}: ${error}`);
    // Re-throw the error so the calling context (e.g., an API route) can handle it
    throw error;
  }
}
