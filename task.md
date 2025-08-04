Current Problem
My App's Analysis:

Shows 0.278172271414083584 WETH as "profit"
This is actually the total WETH received, not the net profit

EigenPhi's Analysis:

Profit: $9.69
Revenue: $13.09
Cost: $3.40
This shows net profit after accounting for all ins/outs

Root Cause
Looking at your calculation: 0.2747 - 0.2782 = -0.0035 (you mean 0.2782 - 0.2747 = +0.0035)
The real profit is 0.0035 WETH ≈ $12.25 (at $3500 ETH), which closely matches EigenPhi's $9.69.
The Fix Strategy

1. Change Net Profit Calculation Logic
   Current logic in analyzeSimpleTrace():
   typescript// WRONG: This shows total amounts, not net profit
   const losses = enrichedNetChanges.filter((c) => c.amount < 0n)
   const gains = enrichedNetChanges.filter((c) => c.amount > 0n)
   Should be:

Calculate same-token net changes first
Only show actual profit/loss per token
For WETH: +0.278 WETH received - 0.2747 WETH spent = +0.0035 WETH net profit

2. Enhanced Token Flow Tracking
   The transaction likely involves:

Input: Some WETH + COMMS
Output: Different amounts of WETH + COMMS
Net Result: Small WETH profit + gas costs

3. Multi-Token Arbitrage Pattern
   This appears to be a triangular arbitrage:

WETH → COMMS (on DEX A)
COMMS → WETH (on DEX B)
Net result: slight WETH increase

4. Implementation Plan
   Step 1: Fix analyzeSimpleTrace()
   typescript// Group by token address first
   const tokenNetChanges = new Map<string, bigint>();

// Calculate net change per token
trace.events?.forEach((event) => {
if (event.topics?.[0] === ERC20_TRANSFER_TOPIC) {
const token = event.contract.toLowerCase();
const amount = BigInt(event.data);

    // Add/subtract based on controlled addresses
    if (controlledAddresses.has(from)) tokenNetChanges.set(token, (tokenNetChanges.get(token) || 0n) - amount);
    if (controlledAddresses.has(to)) tokenNetChanges.set(token, (tokenNetChanges.get(token) || 0n) + amount);

}
});

// Only report non-zero net changes as profit/loss
const realNetChanges = Array.from(tokenNetChanges.entries())
.filter(([_, amount]) => amount !== 0n)
.map(([address, amount]) => ({ address, amount }));
Step 2: Separate Revenue vs Profit

Revenue: Total value of assets received
Cost: Total value of assets spent + gas
Profit: Revenue - Cost

Step 3: Multi-Venue Detection

Detect if same token pair traded on multiple DEXes
Calculate price differences between venues

5. Expected Output After Fix
   json{
   "strategy": "Cross-DEX Arbitrage",
   "summary": "Triangular arbitrage across 3 venues yielding $9.69 profit",
   "financials": {
   "revenue": "$13.09",
   "cost": "$3.40",
   "netProfit": "$9.69",
   "profitBreakdown": [
   {
   "token": "WETH",
   "netChange": "+0.0035 WETH",
   "usdValue": "+$12.25"
   },
   {
   "token": "ETH",
   "netChange": "-0.0000589 ETH",
   "usdValue": "-$2.06 (gas)"
   }
   ]
   }
   }
   The core fix is changing from "total amounts moved" to "net profit per token" - this single change should make your results match EigenPhi's analysis.
