// lib/analysis/llm.ts - SPECIALIZED PROMPTS VERSION

import { Config, getOpenAI } from '../config';
import { Logger } from '../constants';

/**
 * Main LLM analysis function that routes to specialized prompts based on analysis type
 */
export async function getLlmAnalysis(analysisData: any): Promise<any> {
  const analysisType = analysisData.type?.toLowerCase() || 'swap';

  Logger.info(`🤖 Routing to specialized LLM analysis for type: ${analysisType}`);

  // Route to appropriate specialized analysis
  switch (analysisType) {
    case 'sandwich':
      return await getSandwichAnalysis(analysisData);
    case 'arbitrage':
      return await getArbitrageAnalysis(analysisData);
    case 'swap':
    default:
      return await getGeneralSwapAnalysis(analysisData);
  }
}

/**
 * Specialized analysis for sandwich attacks - focuses on attack patterns and victim impact
 */
async function getSandwichAnalysis(analysisData: any): Promise<any> {
  const prompt = `
You are a MEV security analyst specializing in sandwich attack detection and analysis.

### SANDWICH ATTACK ANALYSIS CONTEXT:
This transaction has been CONFIRMED as part of a sandwich attack pattern through technical analysis.

### Key Detection Indicators Present:
- Detection Method: ${analysisData.detectionMethod || 'pattern-analysis'}
- Sandwich Type: ${analysisData.sandwichType || 'unknown'}
- Is Sandwich Attack: ${analysisData.isSandwichAttack || false}
- Pattern Detected: ${analysisData.sandwichDetected || false}

### Sandwich Pattern Data:
${analysisData.sandwichPattern ? `
- Front-run: ${analysisData.sandwichPattern.frontRun?.hash}
- Victim: ${analysisData.sandwichPattern.victim?.hash} 
- Back-run: ${analysisData.sandwichPattern.backRun?.hash}
` : 'Pattern data not available'}

### Transaction Role Analysis:
${analysisData.enhancedDetection?.transactionRole ? `
This transaction is the: ${analysisData.enhancedDetection.transactionRole}
Detection confidence: ${analysisData.enhancedDetection.confidence}
` : 'Role analysis pending'}

### Financial Impact (Combined Attack Profit):
${analysisData.combinedFinancials?.netProfitOrLoss ?
      analysisData.combinedFinancials.netProfitOrLoss.map((item: any) =>
        `${item.token.symbol}: ${item.isProfit ? '+' : '-'}${item.formattedAmount}`
      ).join(', ') : 'Financial analysis pending'}

### MEV Bot Profile:
${analysisData.mevBotProfile ? `
- Address: ${analysisData.mevBotProfile.address}
- Confidence: ${analysisData.mevBotProfile.confidence}
- Avg Gas Price: ${analysisData.mevBotProfile.patterns?.avgGasPrice}
- TX Frequency: ${analysisData.mevBotProfile.patterns?.txFrequency}
` : 'Bot analysis not available'}

### Price Impact Data:
${analysisData.priceImpact ? `
- Token Pair: ${analysisData.priceImpact.tokenPair?.tokenA?.symbol}/${analysisData.priceImpact.tokenPair?.tokenB?.symbol}
- Max Price Impact: ${analysisData.priceImpact.maxPriceImpact}
- Victim Slippage: ${analysisData.priceImpact.victimSlippage}
- Pool Manipulation: ${analysisData.priceImpact.poolManipulation}%
` : 'Price impact analysis not available'}

### Analysis Requirements:
1. **Strategy**: Always classify as "Sandwich Attack" with specific role
2. **Confidence**: Use detection confidence level (${analysisData.confidence || 'high'})
3. **Role Classification**: Identify if this tx is front-run, victim, or back-run
4. **Attack Mechanics**: Explain the sandwich attack mechanism
5. **Financial Impact**: Focus on attacker profit and victim loss
6. **Detection Method**: Explain how the attack was detected

### Output Schema:
{
  "strategy": "Sandwich Attack - [Front-Run/Victim/Back-Run]",
  "confidence": "high|medium|low",
  "summary": "Brief description focusing on sandwich attack mechanics",
  "narrative": [
    "Attack detection explanation",
    "Transaction role in sandwich sequence", 
    "Financial impact analysis",
    "MEV extraction method",
    "Victim impact assessment"
  ],
  "protocols": ["List of protocols involved"],
  "financials": {
    "attackerProfit": "Combined profit from front-run + back-run",
    "victimLoss": "Estimated victim slippage/loss",
    "gasCost": "Attack execution cost",
    "netProfit": "Attacker net profit after gas",
    "roi": "Return on investment for attacker"
  },
  "sandwichAnalysis": {
    "blockPosition": "Transaction position in block",
    "totalBlockTxs": "Total transactions in block", 
    "isSandwichVictim": "true if victim",
    "isSandwichAttacker": "true if attacker",
    "frontRunTx": "Hash if available",
    "backRunTx": "Hash if available",
    "victimSlippage": "Slippage percentage",
    "attackerProfit": "Profit amount"
  },
  "mevBotAnalysis": {
    "confidence": "Bot detection confidence",
    "txFrequency": "Transaction frequency",
    "avgGasPrice": "Average gas price used",
    "successRate": "Success rate if available"
  },
  "priceImpactAnalysis": {
    "tokenPair": "Token pair affected",
    "victimSlippage": "Victim slippage percentage", 
    "poolManipulation": "Pool manipulation level",
    "maxPriceImpact": "Maximum price impact"
  }
}

### Analysis Data:
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

Return ONLY the JSON object. Focus on sandwich attack mechanics and victim impact.
`;

  return await callLLM(prompt, 'sandwich', analysisData);
}

/**
 * Specialized analysis for arbitrage transactions - focuses on profit calculations and efficiency
 */
async function getArbitrageAnalysis(analysisData: any): Promise<any> {
  const prompt = `
You are a DeFi arbitrage analyst specializing in cross-DEX trading and profit optimization.

### ARBITRAGE ANALYSIS CONTEXT:
This transaction has been identified as an arbitrage opportunity across multiple venues.

### Arbitrage Pattern Detected:
- Pattern Type: ${analysisData.pattern?.type || 'cross-protocol'}
- Complexity: ${analysisData.pattern?.complexity || 'unknown'}
- Protocols Involved: ${analysisData.pattern?.protocols?.length || 0}
- Confidence: ${analysisData.pattern?.confidence || 'medium'}

### Financial Analysis (CORRECTED NET PROFIT):
${analysisData.financials?.netProfitOrLoss ?
      analysisData.financials.netProfitOrLoss.map((item: any) =>
        `${item.token.symbol}: ${item.netChange || (item.isProfit ? '+' : '-') + item.formattedAmount}`
      ).join('\n') : 'Financial data not available'}

### Investment Breakdown:
${analysisData.financials?.investmentBreakdown ?
      analysisData.financials.investmentBreakdown.map((item: any) =>
        `${item.token}: Invested ${item.invested}, Received ${item.received}, Net: ${item.netProfit}`
      ).join('\n') : 'Investment breakdown not available'}

### Swap Path Analysis:
${analysisData.swapPath ?
      analysisData.swapPath.map((swap: any, i: number) =>
        `${i + 1}. ${swap.tokenIn?.symbol} → ${swap.tokenOut?.symbol} via ${swap.protocol}`
      ).join('\n') : 'Swap path not available'}

### Gas Efficiency:
- Total Gas Used: ${analysisData.gasEfficiency?.totalGasUsed || 'unknown'}
- Gas Cost: ${analysisData.gasEfficiency?.gasCostEth || 'unknown'}
- Profit After Gas: ${analysisData.gasEfficiency?.profitAfterGas || 'unknown'}

### Analysis Requirements:
1. **Strategy**: Classify arbitrage type (simple, cross-protocol, triangular, flash-loan)
2. **Profit Calculation**: Use ACTUAL net profit amounts from netProfitOrLoss
3. **Efficiency Analysis**: Calculate ROI based on capital required vs profit
4. **Venue Analysis**: Identify price differences exploited
5. **Risk Assessment**: Evaluate capital efficiency and gas costs

### Output Schema:
{
  "strategy": "Cross-DEX Arbitrage|Triangular Arbitrage|Flash Loan Arbitrage",
  "confidence": "high|medium|low",
  "summary": "Brief description focusing on arbitrage mechanics and profit",
  "narrative": [
    "Arbitrage opportunity explanation",
    "Price difference identification", 
    "Execution path description",
    "Capital efficiency analysis",
    "Net profit calculation with actual amounts",
    "Gas cost impact on profitability"
  ],
  "protocols": ["List of DEXs/protocols used"],
  "financials": {
    "profit": "Gross profit from arbitrage",
    "cost": "Total costs including gas",
    "netProfit": "Actual net profit after all costs", 
    "roi": "Return on investment percentage",
    "capitalEfficiency": "Profit per unit of capital",
    "priceImbalance": "Price difference exploited"
  }
}

### Analysis Data:
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

Return ONLY the JSON object. Focus on actual net profit, not gross amounts.
`;

  return await callLLM(prompt, 'arbitrage', analysisData);
}

/**
 * General analysis for regular swaps and unknown patterns
 */
async function getGeneralSwapAnalysis(analysisData: any): Promise<any> {
  const prompt = `
You are a DeFi transaction analyst specializing in swap analysis and profit/loss calculations.

### GENERAL SWAP ANALYSIS CONTEXT:
This transaction appears to be a regular swap or complex DeFi interaction.

### Financial Analysis (CORRECTED NET CALCULATIONS):
${analysisData.financials?.netProfitOrLoss ?
      analysisData.financials.netProfitOrLoss.map((item: any) =>
        `${item.token.symbol}: ${item.netChange || (item.isProfit ? '+' : '-') + item.formattedAmount} (${item.investmentFlow || 'flow unknown'})`
      ).join('\n') : 'Financial data not available'}

### Trade Details:
- Swap Type: ${analysisData.swapDetails?.swapType || 'unknown'}
- Asset In: ${analysisData.swapDetails?.assetIn?.formattedAmount || 'unknown'}
- Asset Out: ${analysisData.swapDetails?.assetOut?.formattedAmount || 'unknown'}
- Trade Analysis: ${analysisData.swapDetails?.tradeAnalysis?.description || 'unknown'}

### Protocol Interactions:
${analysisData.protocols ?
      analysisData.protocols.map((p: any) => `${p.protocol} (${p.confidence})`).join(', ') : 'No protocols detected'}

### Gas Analysis:
- Gas Used: ${analysisData.gasAnalysis?.totalGasUsed || 'unknown'}
- Gas Cost: ${analysisData.gasAnalysis?.gasCostEth || 'unknown'}
- Efficiency: ${analysisData.gasAnalysis?.gasEfficiency || 'unknown'}

### Analysis Requirements:
1. **Strategy**: Classify based on detected patterns (DEX Trading, Multi-hop Swap, etc.)
2. **Profit Calculation**: Use CORRECTED net profit/loss from financial data
3. **Trade Efficiency**: Analyze if the trade was profitable after gas costs
4. **Protocol Usage**: Identify DeFi protocols and routing efficiency
5. **Transaction Purpose**: Determine likely intent (trading, LP, etc.)

### Output Schema:
{
  "strategy": "DEX Trading|Multi-hop Swap|Token Exchange|Complex DeFi",
  "confidence": "high|medium|low",
  "summary": "Brief description of the transaction purpose and outcome",
  "narrative": [
    "Transaction purpose explanation",
    "Asset flow description with ACTUAL amounts", 
    "Protocol interaction analysis",
    "Gas efficiency assessment",
    "Final profit/loss with corrected calculations"
  ],
  "protocols": ["List of protocols used"],
  "financials": {
    "profit": "Gross profit if any",
    "cost": "Total costs including gas",
    "netProfit": "Net result after all costs using CORRECTED calculations", 
    "efficiency": "Cost efficiency analysis"
  }
}

### Analysis Data:
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

Return ONLY the JSON object. Use corrected net profit calculations, not gross amounts.
`;

  return await callLLM(prompt, 'general', analysisData);
}

/**
 * Enhanced LLM call function with type-specific logging and error handling
 */
async function callLLM(prompt: string, analysisType: string, analysisData: any): Promise<any> {
  Logger.info(`📤 Sending ${analysisType} analysis to LLM...`);

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: Config.LLM_MODEL,
      messages: [ { role: 'user', content: prompt } ],
      response_format: { type: 'json_object' },
      temperature: analysisType === 'sandwich' ? 0.05 : 0.1, // Lower temperature for sandwich (more deterministic)
      max_tokens: analysisType === 'sandwich' ? 2000 : 1500, // More tokens for complex sandwich analysis
    });

    const content = response.choices[ 0 ].message.content;
    if (!content) {
      throw new Error(`LLM returned empty content for ${analysisType} analysis`);
    }

    const result = JSON.parse(content);

    // Validate result has required fields
    if (!result.strategy || !result.summary) {
      Logger.error(`❌ LLM result missing required fields for ${analysisType}`);
      throw new Error(`Invalid LLM response for ${analysisType} analysis`);
    }

    Logger.info(`✅ ${analysisType} analysis completed successfully`);
    return result;

  } catch (error: any) {
    Logger.error(`❌ LLM analysis failed for ${analysisType}: ${error.message}`);

    // Fallback response to prevent complete failure
    return {
      strategy: analysisType === 'sandwich' ? 'Sandwich Attack - Analysis Failed' :
        analysisType === 'arbitrage' ? 'Arbitrage - Analysis Failed' : 'Transaction Analysis Failed',
      confidence: 'low',
      summary: `${analysisType} analysis could not be completed due to LLM error: ${error.message}`,
      narrative: [ `Analysis failed: ${error.message}` ],
      protocols: analysisData.protocols?.map((p: any) => p.protocol) || [],
      financials: {
        error: 'Financial analysis unavailable due to LLM failure'
      },
      ...(analysisType === 'sandwich' && {
        sandwichAnalysis: {
          detectionMethod: analysisData.detectionMethod,
          confidence: analysisData.confidence,
          error: 'Detailed sandwich analysis failed'
        }
      })
    };
  }
}

/**
 * Utility function to enhance analysis data before sending to LLM
 */
export function enhanceAnalysisForLLM(analysisData: any): any {
  // Add computed fields that help LLM understand the context
  const enhanced = {
    ...analysisData,

    // Add analysis type hints
    analysisHints: {
      isSandwichAttack: !!(analysisData.isSandwichAttack || analysisData.sandwichDetected || analysisData.sandwichPattern),
      isArbitrage: !!(analysisData.pattern || analysisData.swapPath || (analysisData.protocols?.length > 1)),
      isComplexTrade: !!(analysisData.financials?.totalTokensInvolved > 2),
      hasMultipleProtocols: !!(analysisData.protocols?.length > 1)
    },

    // Enhance financial context
    financialContext: analysisData.financials?.netProfitOrLoss ? {
      hasProfitableTokens: analysisData.financials.netProfitOrLoss.some((item: any) => item.isProfit),
      hasLossTokens: analysisData.financials.netProfitOrLoss.some((item: any) => !item.isProfit),
      totalTokensTraded: analysisData.financials.netProfitOrLoss.length,
      primaryProfitToken: analysisData.financials.netProfitOrLoss.find((item: any) => item.isProfit)?.token?.symbol,
      primaryLossToken: analysisData.financials.netProfitOrLoss.find((item: any) => !item.isProfit)?.token?.symbol
    } : null,

    // Add sandwich-specific context
    ...(analysisData.sandwichPattern && {
      sandwichContext: {
        hasCompletePattern: !!(analysisData.sandwichPattern.frontRun && analysisData.sandwichPattern.victim && analysisData.sandwichPattern.backRun),
        attackerAddress: analysisData.sandwichPattern.frontRun?.from,
        victimAddress: analysisData.sandwichPattern.victim?.from,
        blockSpan: analysisData.enhancedDetection?.crossBlockSpan ? 'cross-block' : 'single-block'
      }
    })
  };

  return enhanced;
}

/**
 * Post-process LLM results to ensure consistency and add computed fields
 */
export function postProcessLLMResult(result: any, analysisType: string, originalData: any): any {
  return {
    ...result,

    // Add metadata about analysis
    analysisMetadata: {
      type: analysisType,
      timestamp: new Date().toISOString(),
      detectionMethod: originalData.detectionMethod,
      confidence: originalData.confidence || result.confidence
    },

    // Ensure required fields exist
    blockData: originalData.metadata ? {
      blockNumber: originalData.metadata.blockNumber,
      transactionIndex: originalData.metadata.transactionIndex,
      gasPrice: originalData.metadata.gasPrice,
      timestamp: originalData.metadata.blockTimestamp
    } : undefined,

    // Add enhanced sandwich data if it's a sandwich attack
    ...(analysisType === 'sandwich' && originalData.sandwichPattern && {
      sandwichAnalysis: {
        blockPosition: originalData.metadata?.transactionIndex || 0,
        totalBlockTxs: 100, // Would need to be calculated from block data
        isSandwichVictim: originalData.enhancedDetection?.transactionRole === 'victim',
        isSandwichAttacker: [ 'front-run', 'back-run', 'attacker' ].includes(originalData.enhancedDetection?.transactionRole),
        frontRunTx: originalData.sandwichPattern.frontRun?.hash,
        backRunTx: originalData.sandwichPattern.backRun?.hash,
        victimSlippage: originalData.priceImpact?.victimSlippage,
        attackerProfit: originalData.combinedFinancials?.netProfitOrLoss?.find((item: any) => item.isProfit)?.formattedAmount
      }
    })
  };
}