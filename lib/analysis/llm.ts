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
- \`financials\` / \`combinedFinancials\`: **NET PROFIT/LOSS ANALYSIS** - These represent actual net changes per token, not total amounts moved
- \`mevBotProfile\`: MEV bot behavioral analysis
- \`priceImpact\`: Price manipulation analysis

### CRITICAL: Profit vs Revenue Calculation Rules:
1. **Net Profit**: Use the \`netProfitOrLoss\` data which shows actual net change per token (e.g., +0.0035 WETH, not +0.278 WETH total received)
2. **Revenue**: Total value of assets received 
3. **Cost**: Total value of assets spent + gas costs
4. **Profit Formula**: Revenue - Cost = Net Profit
5. **Multi-Token Arbitrage**: For triangular arbitrage (WETH → COMMS → WETH), show net change per token, not intermediate amounts

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

**Arbitrage Example - Proper Net Profit Calculation:**
{
  "strategy": "Cross-DEX Arbitrage",
  "confidence": "high",
  "summary": "Triangular arbitrage across multiple DEXes yielding small but profitable WETH gain",
  "narrative": [
    "Net Token Analysis: +0.0035 WETH profit from arbitrage sequence",
    "Transaction involved WETH and COMMS tokens across multiple venues",
    "Total WETH received: 0.278 WETH, Total WETH spent: 0.2747 WETH",
    "Actual net profit: 0.278 - 0.2747 = 0.0035 WETH (~$12.25 at $3500 ETH)",
    "Gas cost: 0.0000589 ETH (~$2.06), leaving net profit of ~$10.19"
  ],
  "protocols": ["Uniswap V2", "Multiple DEXes"],
  "financials": {
    "revenue": "$13.09 (total value received)",
    "cost": "$3.40 (gas + opportunity cost)",
    "netProfit": "0.0035 WETH (~$12.25)",
    "roi": "285%" 
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
        messages: [ { role: 'user', content: prompt } ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
    });

    const content = response.choices[ 0 ].message.content;
    if (!content) throw new Error('LLM returned empty content.');
    return JSON.parse(content);
}