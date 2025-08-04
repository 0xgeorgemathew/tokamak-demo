// lib/analysis/llm.ts - UPDATED to handle corrected financial data

import { Config, getOpenAI } from '../config';
import {
  ERC20_TRANSFER_TOPIC,
  NATIVE_ETH_ADDRESS,
  KNOWN_PROTOCOLS,
  MEV_BOT_PATTERNS,
  MEV_BOT_HEURISTICS,
  Logger
} from '../constants';
import type { TokenInfo, EnrichedAsset, TransactionMetadata, ProtocolInteraction, GasAnalysis, SandwichPattern, PriceImpactAnalysis, MEVBotProfile } from '../types';

export async function getLlmAnalysis(analysisData: any): Promise<any> {
  const prompt = `
You are a senior DeFi protocol analyst specializing in MEV (Maximal Extractable Value) and on-chain transaction analysis. Your expertise includes identifying arbitrage opportunities, sandwich attacks, liquidations, and complex DeFi strategies across protocols like Uniswap, Curve, Balancer, 1inch, and others.

### CRITICAL: Enhanced Financial Data Understanding
The input data now contains CORRECTED net profit/loss calculations:
- \`netProfitOrLoss\`: Shows actual NET changes per token (e.g., +0.0035 WETH net profit, not +0.278 total received)
- \`totalInflows\`: Total amounts received per token
- \`totalOutflows\`: Total amounts spent per token  
- \`netChange\`: Describes the actual profit/loss with context

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
- \`financials\` / \`combinedFinancials\`: **CORRECTED NET PROFIT/LOSS ANALYSIS** 
- \`mevBotProfile\`: MEV bot behavioral analysis
- \`priceImpact\`: Price manipulation analysis

### CRITICAL: Updated Profit Calculation Rules:
1. **Net Profit**: Use \`netProfitOrLoss\` which now shows ACTUAL net changes per token
2. **Revenue**: Use \`totalInflows\` for total value received 
3. **Cost**: Use \`totalOutflows\` for total value spent (including gas)
4. **True Profit Formula**: Net Profit = Total Inflows - Total Outflows
5. **Multi-Token Arbitrage**: Show net changes per token from \`netProfitOrLoss\` array

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

**Corrected Arbitrage Example - Using ACTUAL Net Profit:**
{
  "strategy": "Cross-DEX Arbitrage",
  "confidence": "high",
  "summary": "Triangular arbitrage yielding small but profitable WETH gain after transaction costs",
  "narrative": [
    "NET PROFIT ANALYSIS: +0.0035 WETH actual profit from arbitrage sequence",
    "Transaction Flow: WETH → COMMS → WETH across multiple venues",
    "Input Analysis: 525,363 COMMS tokens spent + 0.274679 WETH invested",
    "Output Analysis: 0.278172 WETH received (total)",
    "Actual Net Profit: 0.278172 - 0.274679 = 0.003493 WETH (~$12.25 at $3500 ETH)",
    "Gas Cost: 0.0000589 ETH (~$2.06), leaving net profit of ~$10.19"
  ],
  "protocols": ["1inch v5 Router", "Wrapped Ether (WETH)"],
  "financials": {
    "revenue": "0.278172 WETH received (~$973.60)",
    "cost": "0.274679 WETH + 0.0000589 ETH gas (~$964.41 total)",
    "netProfit": "0.003493 WETH (~$12.25)",
    "roi": "1.27%",
    "breakdown": "Actual net gain of 0.0035 WETH after accounting for all token flows"
  }
}

**Sandwich Attack Example:**
{
  "strategy": "Sandwich Attack - Front-Run Transaction",
  "confidence": "high",
  "detectionMethod": "pattern-analysis",
  "summary": "This transaction is the front-run component of a detected sandwich attack targeting victim transaction",
  "narrative": [
    "Pattern Detection: Enhanced algorithm identified this as the front-run transaction in a sandwich attack sequence",
    "Transaction Role: This transaction manipulates token prices before the victim transaction executes",
    "Attack Sequence: Front-run (this tx) → Victim → Back-run (completes the sandwich)",
    "Token Manipulation: Transaction involves WETH/TARGET pair to set up price manipulation",
    "MEV Strategy: Sophisticated attack designed to extract value from victim's transaction"
  ],
  "protocols": ["Uniswap V2"],
  "financials": {
    "role": "Front-run transaction (setup phase)",
    "attackerStrategy": "Price manipulation for sandwich attack",
    "note": "Profit realized in back-run transaction, not this front-run"
  }
}

### Analysis Rules:
1. Use the CORRECTED \`netProfitOrLoss\` data which now shows actual net changes
2. Reference \`totalInflows\` and \`totalOutflows\` for revenue/cost calculations
3. Calculate ROI as (netProfit / totalCapitalUsed) * 100
4. Express confidence based on data completeness and pattern clarity
5. Include gas costs in financial analysis
6. Use precise DeFi terminology and protocol names
7. **IMPORTANT**: The \`formattedAmount\` in \`netProfitOrLoss\` now represents ACTUAL net profit/loss, not total amounts

### Input Data for Analysis:
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

Return ONLY the JSON object following the schema above. No additional text or markdown.
`;

  Logger.separator();
  Logger.info('Sending CORRECTED enriched analysis to LLM for reporting...');
  Logger.info(`🤖 LLM Input Summary: type=${analysisData.type}, hasDetectionMethod=${!!analysisData.detectionMethod}, hasSandwichPattern=${!!analysisData.sandwichPattern}, hasEnhancedDetection=${!!analysisData.enhancedDetection}, isSandwichAttack=${analysisData.isSandwichAttack}, sandwichDetected=${analysisData.sandwichDetected}`);
  Logger.debug(`LLM Input Full Data: ${JSON.stringify(analysisData, null, 2)}`);

  // Log the corrected financial data for debugging
  if (analysisData.financials?.netProfitOrLoss) {
    Logger.info('💰 CORRECTED Financial Data being sent to LLM:');
    analysisData.financials.netProfitOrLoss.forEach((item: any) => {
      Logger.info(`   ${item.token.symbol}: ${item.isProfit ? '+' : '-'}${item.formattedAmount} (${item.netChange || 'net change'})`);
    });
  }

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: Config.LLM_MODEL,
    messages: [ { role: 'user', content: prompt } ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[ 0 ].message.content;
  if (!content) throw new Error('LLM returned empty content.');
  return JSON.parse(content);
}