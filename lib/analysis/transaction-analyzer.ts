import { ERC20_TRANSFER_TOPIC, NATIVE_ETH_ADDRESS, KNOWN_PROTOCOLS, MEV_BOT_PATTERNS, MEV_BOT_HEURISTICS, Logger } from '../constants';
import { formatTokenAmount } from '../utils';
import type { TokenInfo, TransactionMetadata, ProtocolInteraction, GasAnalysis, SandwichPattern, MEVBotProfile } from '../types';
// Type definitions are now imported from ../types
// Constants and Logger are now imported from ../constants
import { enhanceAnalysisForLLM, getLlmAnalysis, postProcessLLMResult } from './llm';
import { callRpc, getTransactionTrace } from '../api/1inch';
import { detectCrossBlockSandwich, detectSandwichByPattern, detectSandwichFromBackRun, detectSandwichFromFrontRun, detectSandwichFromVictim } from './detect-sandwich';
import { TokenMetadataManager } from './tokens';
import { calculatePriceImpact } from './calculations';
import { detectArbitrage } from './detect-arbitrage';
import { detectProtocols } from './detect-protocols';
import { analyzeGasEfficiency } from './gas';
import { analyzeSimpleTrace } from './trace';

// --- Core Analysis Functions ---

/**
 * Detect protocols involved in the transaction
 */

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
function presentFinalReport(llmJson: any, txHash: string, analysisType: string) {
  Logger.separator();
  console.log(`\n--- ${analysisType.toUpperCase()} ANALYSIS REPORT for ${txHash} ---`);

  // Type-specific header
  if (analysisType === 'sandwich') {
    console.log(`🚨 SANDWICH ATTACK DETECTED`);
    console.log(`🎯 Detection Method: ${llmJson.analysisMetadata?.detectionMethod || 'pattern-analysis'}`);
  } else if (analysisType === 'arbitrage') {
    console.log(`💹 ARBITRAGE OPPORTUNITY EXECUTED`);
  } else {
    console.log(`📊 GENERAL TRANSACTION ANALYSIS`);
  }

  // Common reporting
  console.log(`\n🔍 Strategy: ${llmJson.strategy || 'Unknown'}`);
  if (llmJson.confidence) {
    console.log(`📊 Confidence: ${llmJson.confidence.toUpperCase()}`);
  }

  console.log(`\n🗣️  Summary: ${llmJson.summary || 'No summary provided.'}`);

  // Protocols
  if (llmJson.protocols && Array.isArray(llmJson.protocols) && llmJson.protocols.length > 0) {
    console.log(`\n🔗 Protocols: ${llmJson.protocols.join(', ')}`);
  }

  // Narrative
  if (llmJson.narrative && Array.isArray(llmJson.narrative)) {
    console.log(`\n💬 Analysis Details:`);
    llmJson.narrative.forEach((step: string, index: number) => {
      console.log(`   ${index + 1}. ${step}`);
    });
  }

  // Type-specific financial reporting
  if (llmJson.financials) {
    if (analysisType === 'sandwich') {
      console.log('\n🚨 Sandwich Attack Impact:');
      if (llmJson.financials.attackerProfit) {
        console.log(`   🏦 Attacker Profit: ${llmJson.financials.attackerProfit}`);
      }
      if (llmJson.financials.victimLoss) {
        console.log(`   💸 Victim Loss: ${llmJson.financials.victimLoss}`);
      }
      if (llmJson.financials.netProfit) {
        console.log(`   💰 Net Attack Profit: ${llmJson.financials.netProfit}`);
      }
    } else if (analysisType === 'arbitrage') {
      console.log('\n💹 Arbitrage Performance:');
      if (llmJson.financials.profit) {
        console.log(`   📈 Gross Profit: ${llmJson.financials.profit}`);
      }
      if (llmJson.financials.cost) {
        console.log(`   📉 Total Cost: ${llmJson.financials.cost}`);
      }
      if (llmJson.financials.netProfit) {
        console.log(`   💎 Net Profit: ${llmJson.financials.netProfit}`);
      }
      if (llmJson.financials.roi) {
        console.log(`   📊 ROI: ${llmJson.financials.roi}`);
      }
      if (llmJson.financials.capitalEfficiency) {
        console.log(`   ⚡ Capital Efficiency: ${llmJson.financials.capitalEfficiency}`);
      }
    } else {
      console.log('\n💰 Financial Analysis:');
      if (llmJson.financials.profit) {
        console.log(`   📈 Profit: ${llmJson.financials.profit}`);
      }
      if (llmJson.financials.cost) {
        console.log(`   📉 Cost: ${llmJson.financials.cost}`);
      }
      if (llmJson.financials.netProfit) {
        console.log(`   💎 Net Result: ${llmJson.financials.netProfit}`);
      }
    }
  }

  // Type-specific additional sections
  if (analysisType === 'sandwich' && llmJson.sandwichAnalysis) {
    console.log('\n🎯 Sandwich Pattern Details:');
    console.log(`   📍 Block Position: ${llmJson.sandwichAnalysis.blockPosition}`);
    if (llmJson.sandwichAnalysis.frontRunTx) {
      console.log(`   ⚡ Front-run TX: ${llmJson.sandwichAnalysis.frontRunTx}`);
    }
    if (llmJson.sandwichAnalysis.backRunTx) {
      console.log(`   🔄 Back-run TX: ${llmJson.sandwichAnalysis.backRunTx}`);
    }
    if (llmJson.sandwichAnalysis.victimSlippage) {
      console.log(`   💥 Victim Slippage: ${llmJson.sandwichAnalysis.victimSlippage}`);
    }
  }

  if (llmJson.mevBotAnalysis) {
    console.log('\n🤖 MEV Bot Analysis:');
    console.log(`   🎯 Confidence: ${llmJson.mevBotAnalysis.confidence}`);
    console.log(`   ⚡ TX Frequency: ${llmJson.mevBotAnalysis.txFrequency}`);
    console.log(`   ⛽ Avg Gas Price: ${llmJson.mevBotAnalysis.avgGasPrice}`);
  }

  Logger.separator();
}

/**
 * Main transaction analysis function - detects MEV patterns and generates comprehensive reports
 */
export async function analyzeTransaction(chainId: number, txHash: string) {
  try {
    // Step 1: Fetch all necessary data
    Logger.info(`Starting analysis for ${txHash} on chain ${chainId}`);
    const receipt = await callRpc(chainId, 'eth_getTransactionReceipt', [ txHash ]);
    if (!receipt) throw new Error(`Transaction receipt not found for hash ${txHash}.`);

    const blockNumber = parseInt(receipt.blockNumber, 16);
    const mainTraceData = await getTransactionTrace(chainId, txHash, blockNumber);
    const metadata = await enrichTransactionMetadata(chainId, txHash, receipt);

    // Step 2: Determine analysis type and run appropriate detection
    let analysis: any;
    let analysisType: string;

    // PRIORITY 1: Check for sandwich attack patterns
    const sandwichData = await detectAndAnalyzeSandwich(chainId, txHash, blockNumber, mainTraceData);

    if (sandwichData) {
      analysis = { type: 'Sandwich', ...sandwichData };
      analysisType = 'sandwich';
      Logger.info('✅ Sandwich attack detected - routing to specialized sandwich analysis');
    } else {
      // PRIORITY 2: Check for arbitrage patterns  
      const arbitrageAnalysis = await detectArbitrage(chainId, txHash, mainTraceData, metadata);

      if (arbitrageAnalysis) {
        analysis = { type: 'Arbitrage', ...arbitrageAnalysis };
        analysisType = 'arbitrage';
        Logger.info('✅ Arbitrage pattern detected - routing to specialized arbitrage analysis');
      } else {
        // FALLBACK: General swap analysis
        const simpleAnalysis = await analyzeSimpleTrace(chainId, mainTraceData, metadata);
        analysis = { type: 'Swap', ...simpleAnalysis };
        analysisType = 'general';
        Logger.info('📊 General transaction detected - routing to general swap analysis');
      }
    }

    // Step 3: Enhance data for LLM and get specialized analysis
    Logger.info(`🎯 Analysis type determined: ${analysisType}`);
    Logger.info(`📊 Key indicators: sandwich=${!!sandwichData}, arbitrage=${!!analysis.pattern}, protocols=${analysis.protocols?.length || 0}`);

    const enhancedAnalysis = enhanceAnalysisForLLM(analysis);
    const llmReport = await getLlmAnalysis(enhancedAnalysis);
    const finalReport = postProcessLLMResult(llmReport, analysisType, analysis);

    // Step 4: Present results
    presentFinalReport(finalReport, txHash, analysisType);
    return finalReport;

  } catch (error) {
    Logger.error(`Analysis failed for ${txHash}: ${error}`);
    throw error;
  }
}

