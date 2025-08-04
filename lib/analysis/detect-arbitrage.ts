import type {
    TokenInfo,
    ProtocolInteraction,
    TransactionMetadata,
} from '../types';
import { ERC20_TRANSFER_TOPIC, NATIVE_ETH_ADDRESS, KNOWN_PROTOCOLS, Logger } from '../constants';
import { extractTokenFlows, TokenMetadataManager } from './tokens';
import { formatTokenAmount } from '../utils';

export interface ArbitragePattern {
    type: 'simple-arbitrage' | 'cross-protocol' | 'triangular' | 'flash-loan';
    confidence: 'high' | 'medium' | 'low';
    protocols: ProtocolInteraction[];
    tokenPairs: string[];
    priceImbalance?: number;
    profitability: {
        gross: string;
        net: string;
        roi: string;
    };
    complexity: number;
}

export interface ArbitrageAnalysis {
    isArbitrage: boolean;
    pattern?: ArbitragePattern;
    swapPath: ArbitrageSwap[];
    financials: {
        inputTokens: EnrichedToken[];
        outputTokens: EnrichedToken[];
        netProfitOrLoss: EnrichedToken[];
    };
    gasEfficiency: {
        totalGasUsed: number;
        gasCostEth: string;
        profitAfterGas: string;
    };
}

interface ArbitrageSwap {
    protocol: string;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: string;
    amountOut: string;
    priceImpact?: number;
}

interface EnrichedToken {
    token: TokenInfo;
    rawAmount: string;
    formattedAmount: string;
    isProfit: boolean;
}

/**
 * Main function to detect and analyze arbitrage patterns in a transaction
 */
export async function detectArbitrage(
    chainId: number,
    txHash: string,
    trace: any,
    metadata?: TransactionMetadata
): Promise<ArbitrageAnalysis | null> {
    Logger.info(`Analyzing transaction ${txHash} for arbitrage patterns`);

    const protocols = detectProtocols(trace);
    const tokenFlows = await extractTokenFlows(trace);
    
    if (protocols.length < 2) {
        Logger.debug('Not enough protocols involved for arbitrage');
        return null;
    }

    // Analyze different arbitrage patterns in order of complexity/reliability
    const patterns = await Promise.all([
        detectFlashLoanArbitrage(chainId, trace, protocols, tokenFlows), // Highest confidence
        detectTriangularArbitrage(chainId, trace, protocols, tokenFlows),
        detectCrossProtocolArbitrage(chainId, trace, protocols, tokenFlows),
        detectSimpleArbitrage(chainId, trace, protocols, tokenFlows),
        detectStatisticalArbitrage(chainId, trace, protocols, tokenFlows) // New pattern
    ]);

    const detectedPattern = patterns.find((p: ArbitragePattern | null) => p !== null);
    
    if (!detectedPattern) {
        return null;
    }

    const swapPath = await buildSwapPath(chainId, trace, protocols);
    const financials = await analyzeFinancials(chainId, trace, metadata);
    const gasEfficiency = await analyzeGasEfficiency(trace, metadata, financials);

    return {
        isArbitrage: true,
        pattern: detectedPattern,
        swapPath,
        financials,
        gasEfficiency
    };
}

/**
 * Detect simple arbitrage: buy on one protocol, sell on another
 */
async function detectSimpleArbitrage(
    _chainId: number,
    _trace: any,
    protocols: ProtocolInteraction[],
    tokenFlows: any[]
): Promise<ArbitragePattern | null> {
    if (protocols.length !== 2) return null;

    const uniqueTokens = [...new Set(tokenFlows.map(f => f.token))];
    if (uniqueTokens.length !== 2) return null; // Simple arbitrage involves exactly 2 tokens

    // Check if we have buy/sell pattern
    const netChanges = calculateNetTokenChanges(tokenFlows);
    const hasNeutralPosition = Object.values(netChanges).every(amount => 
        Math.abs(Number(amount)) < 1000 // Near zero net position
    );

    if (!hasNeutralPosition) return null;

    // Additional validation: check for same token pair across different protocols
    const isDifferentProtocols = protocols[0].protocol !== protocols[1].protocol;
    if (!isDifferentProtocols) return null;

    Logger.info(`Simple arbitrage detected between ${protocols[0].protocol} and ${protocols[1].protocol}`);

    return {
        type: 'simple-arbitrage',
        confidence: 'high',
        protocols,
        tokenPairs: uniqueTokens,
        profitability: {
            gross: '0', // Will be calculated later
            net: '0',
            roi: '0'
        },
        complexity: 1
    };
}

/**
 * Detect cross-protocol arbitrage involving multiple DEXs
 */
async function detectCrossProtocolArbitrage(
    _chainId: number,
    _trace: any,
    protocols: ProtocolInteraction[],
    tokenFlows: any[]
): Promise<ArbitragePattern | null> {
    if (protocols.length < 2) return null;

    const uniqueTokens = [...new Set(tokenFlows.map(f => f.token))];
    const protocolTypes = [...new Set(protocols.map(p => p.protocol))];

    // Look for DEX-to-DEX arbitrage patterns
    const dexProtocols = protocolTypes.filter(p => 
        p.toLowerCase().includes('uniswap') || 
        p.toLowerCase().includes('sushiswap') ||
        p.toLowerCase().includes('curve') ||
        p.toLowerCase().includes('balancer') ||
        p.toLowerCase().includes('1inch') ||
        p.toLowerCase().includes('0x')
    );

    if (dexProtocols.length < 2 || uniqueTokens.length < 2) return null;

    // Enhanced validation: check for price discovery pattern
    const hasMultipleSwaps = tokenFlows.length >= 4; // At least 2 swaps (2 transfers each)
    if (!hasMultipleSwaps) return null;

    Logger.info(`Cross-protocol arbitrage detected across ${dexProtocols.length} DEXs: ${dexProtocols.join(', ')}`);

    return {
        type: 'cross-protocol',
        confidence: dexProtocols.length >= 3 ? 'high' : 'medium',
        protocols,
        tokenPairs: uniqueTokens,
        profitability: {
            gross: '0',
            net: '0', 
            roi: '0'
        },
        complexity: protocols.length
    };
}

/**
 * Detect triangular arbitrage: A->B->C->A
 */
async function detectTriangularArbitrage(
    chainId: number,
    trace: any,
    protocols: ProtocolInteraction[],
    tokenFlows: any[]
): Promise<ArbitragePattern | null> {
    const uniqueTokens = [...new Set(tokenFlows.map(f => f.token))];
    
    // Triangular arbitrage typically involves 3+ tokens
    if (uniqueTokens.length < 3) return null;

    // Check for circular trading pattern
    const swapSequence = await detectSwapSequence(trace);
    const isCircular = swapSequence.length >= 3 && 
                      swapSequence[0].tokenIn === swapSequence[swapSequence.length - 1].tokenOut;

    if (!isCircular) return null;

    Logger.info(`Triangular arbitrage detected with ${uniqueTokens.length} tokens across ${swapSequence.length} swaps`);

    return {
        type: 'triangular',
        confidence: 'high',
        protocols,
        tokenPairs: uniqueTokens,
        profitability: {
            gross: '0',
            net: '0',
            roi: '0'
        },
        complexity: swapSequence.length
    };
}

/**
 * Detect flash loan arbitrage patterns
 */
async function detectFlashLoanArbitrage(
    _chainId: number,
    _trace: any,
    protocols: ProtocolInteraction[],
    tokenFlows: any[]
): Promise<ArbitragePattern | null> {
    // Look for flash loan indicators
    const flashLoanProtocols = protocols.filter(p => 
        p.protocol.toLowerCase().includes('aave') ||
        p.protocol.toLowerCase().includes('compound') ||
        p.protocol.toLowerCase().includes('dydx') ||
        p.protocol.toLowerCase().includes('balancer') || // Balancer also provides flash loans
        p.protocol.toLowerCase().includes('euler')
    );

    if (flashLoanProtocols.length === 0) return null;

    // Check for large temporary token movements (borrow -> trade -> repay pattern)
    const largeFlows = tokenFlows.filter(f => BigInt(f.amount) > BigInt('1000000000000000000')); // > 1 ETH equivalent
    
    if (largeFlows.length === 0) return null;

    // Additional validation: flash loans typically involve multiple protocols
    const hasDexProtocols = protocols.some(p =>
        p.protocol.toLowerCase().includes('uniswap') ||
        p.protocol.toLowerCase().includes('sushiswap') ||
        p.protocol.toLowerCase().includes('curve')
    );

    if (!hasDexProtocols) return null;

    Logger.info(`Flash loan arbitrage detected using ${flashLoanProtocols.map(p => p.protocol).join(', ')}`);

    return {
        type: 'flash-loan',
        confidence: flashLoanProtocols.length > 1 ? 'high' : 'medium',
        protocols,
        tokenPairs: [...new Set(tokenFlows.map(f => f.token))],
        profitability: {
            gross: '0',
            net: '0',
            roi: '0'
        },
        complexity: protocols.length + 2 // Extra complexity for flash loan mechanics
    };
}

/**
 * Detect statistical arbitrage based on volume and complexity patterns
 */
async function detectStatisticalArbitrage(
    _chainId: number,
    _trace: any,
    protocols: ProtocolInteraction[],
    tokenFlows: any[]
): Promise<ArbitragePattern | null> {
    const uniqueTokens = [...new Set(tokenFlows.map(f => f.token))];
    
    // Statistical arbitrage usually involves multiple protocols and complex routing
    if (protocols.length < 3 || uniqueTokens.length < 2) return null;

    // Check for complex routing patterns (many small swaps)
    const totalVolume = tokenFlows.reduce((sum, flow) => sum + BigInt(flow.amount), 0n);
    const avgFlowSize = totalVolume / BigInt(tokenFlows.length);
    
    // Look for patterns suggesting statistical arbitrage:
    // 1. Multiple small trades
    // 2. Many protocols involved
    // 3. Complex token routing
    const hasSmallTrades = avgFlowSize < BigInt('100000000000000000'); // < 0.1 ETH avg
    const hasComplexRouting = protocols.length >= 4 && tokenFlows.length >= 8;
    const hasMultipleTokenPairs = uniqueTokens.length >= 4;

    if (!(hasSmallTrades && hasComplexRouting && hasMultipleTokenPairs)) return null;

    Logger.info(`Statistical arbitrage detected: ${protocols.length} protocols, ${uniqueTokens.length} tokens, ${tokenFlows.length} flows`);

    return {
        type: 'cross-protocol', // Use existing type but with higher complexity
        confidence: 'medium',
        protocols,
        tokenPairs: uniqueTokens,
        profitability: {
            gross: '0',
            net: '0',
            roi: '0'
        },
        complexity: protocols.length + Math.floor(tokenFlows.length / 2)
    };
}

/**
 * Build detailed swap path from transaction trace
 */
async function buildSwapPath(
    _chainId: number,
    trace: any,
    protocols: ProtocolInteraction[]
): Promise<ArbitrageSwap[]> {
    const swaps: ArbitrageSwap[] = [];
    const swapSequence = await detectSwapSequence(trace);

    for (const swap of swapSequence) {
        const protocol = protocols.find(p => 
            trace.transactionTrace.calls?.some((call: any) => 
                call.to?.toLowerCase() === p.address.toLowerCase()
            )
        );

        swaps.push({
            protocol: protocol?.protocol || 'Unknown',
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            amountIn: swap.amountIn,
            amountOut: swap.amountOut,
            priceImpact: swap.priceImpact
        });
    }

    return swaps;
}

/**
 * Detect the sequence of swaps in the transaction
 */
async function detectSwapSequence(trace: any): Promise<{
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: string;
    amountOut: string;
    priceImpact?: number;
}[]> {
    const sequence = [];
    const events = trace.transactionTrace.events || [];
    
    // Group transfer events by transaction flow
    const transferEvents = events.filter((event: any) => 
        event.topics?.[0] === ERC20_TRANSFER_TOPIC
    );

    // Simplified swap detection - look for consecutive transfers
    for (let i = 0; i < transferEvents.length - 1; i += 2) {
        const transferIn = transferEvents[i];
        const transferOut = transferEvents[i + 1];

        if (transferIn && transferOut) {
            const tokenIn = await TokenMetadataManager.getTokenInfo(1, transferIn.contract);
            const tokenOut = await TokenMetadataManager.getTokenInfo(1, transferOut.contract);

            sequence.push({
                tokenIn,
                tokenOut,
                amountIn: transferIn.data || '0',
                amountOut: transferOut.data || '0'
            });
        }
    }

    return sequence;
}

/**
 * Analyze financial outcomes of the arbitrage
 */
async function analyzeFinancials(
    chainId: number,
    trace: any,
    metadata?: TransactionMetadata
): Promise<{
    inputTokens: EnrichedToken[];
    outputTokens: EnrichedToken[];
    netProfitOrLoss: EnrichedToken[];
}> {
    const controlledAddresses = getControlledAddresses(trace);
    const netChanges = await calculateNetChangesFromTrace(chainId, trace, controlledAddresses);

    const enrichedChanges = await Promise.all(
        Object.entries(netChanges).map(async ([address, amount]) => {
            const tokenInfo = await TokenMetadataManager.getTokenInfo(chainId, address);
            return {
                token: tokenInfo,
                rawAmount: (amount > 0n ? amount : -amount).toString(),
                formattedAmount: formatTokenAmount(
                    amount > 0n ? amount : -amount,
                    tokenInfo.decimals,
                    tokenInfo.symbol
                ),
                isProfit: amount > 0n
            };
        })
    );

    const inputTokens = enrichedChanges.filter(c => !c.isProfit);
    const outputTokens = enrichedChanges.filter(c => c.isProfit);
    const netProfitOrLoss = enrichedChanges.filter(c => BigInt(c.rawAmount) !== 0n);

    return {
        inputTokens,
        outputTokens,
        netProfitOrLoss
    };
}

/**
 * Analyze gas efficiency of the arbitrage
 */
async function analyzeGasEfficiency(
    trace: any,
    _metadata?: TransactionMetadata,
    financials?: any
): Promise<{
    totalGasUsed: number;
    gasCostEth: string;
    profitAfterGas: string;
}> {
    const gasUsed = parseInt(trace.transactionTrace.gasUsed || '0x0', 16);
    const gasPrice = parseInt(trace.transactionTrace.gasPrice || '0x0', 16);
    const gasCostWei = BigInt(gasUsed) * BigInt(gasPrice);
    const gasCostEth = formatTokenAmount(gasCostWei, 18, 'ETH');

    // Calculate profit after gas (simplified)
    let profitAfterGas = '0 ETH';
    if (financials?.netProfitOrLoss) {
        const ethProfit = financials.netProfitOrLoss.find((token: any) => 
            token.token.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
        );
        if (ethProfit) {
            const profitWei = BigInt(ethProfit.rawAmount);
            const netProfitWei = ethProfit.isProfit ? profitWei - gasCostWei : -(profitWei + gasCostWei);
            profitAfterGas = formatTokenAmount(
                netProfitWei > 0n ? netProfitWei : -netProfitWei,
                18,
                'ETH'
            );
        }
    }

    return {
        totalGasUsed: gasUsed,
        gasCostEth,
        profitAfterGas
    };
}

/**
 * Helper functions
 */
function detectProtocols(trace: any): ProtocolInteraction[] {
    const protocols: ProtocolInteraction[] = [];
    const addresses = new Set<string>();

    // Collect all interacted addresses
    addresses.add(trace.transactionTrace.to?.toLowerCase());
    const collectAddresses = (call: any) => {
        if (call.to) addresses.add(call.to.toLowerCase());
        call.calls?.forEach(collectAddresses);
    };
    if (trace.transactionTrace.calls) collectAddresses(trace.transactionTrace);

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

function getControlledAddresses(trace: any): Set<string> {
    const initiator = trace.transactionTrace.from?.toLowerCase();
    const proxyContract = trace.transactionTrace.to?.toLowerCase();
    const controlledAddresses = new Set([initiator, proxyContract]);

    const findControlledRecursive = (call: any) => {
        if (controlledAddresses.has(call.from?.toLowerCase())) {
            controlledAddresses.add(call.to?.toLowerCase());
        }
        call.calls?.forEach(findControlledRecursive);
    };

    if (trace.transactionTrace.calls) findControlledRecursive(trace.transactionTrace);
    return controlledAddresses;
}

function calculateNetTokenChanges(tokenFlows: any[]): Record<string, bigint> {
    const netChanges: Record<string, bigint> = {};
    
    for (const flow of tokenFlows) {
        if (!netChanges[flow.token]) {
            netChanges[flow.token] = 0n;
        }
        netChanges[flow.token] += BigInt(flow.amount) * (flow.direction === 'in' ? 1n : -1n);
    }
    
    return netChanges;
}

async function calculateNetChangesFromTrace(
    _chainId: number,
    trace: any,
    controlledAddresses: Set<string>
): Promise<Record<string, bigint>> {
    const netChanges: Record<string, bigint> = {};

    // Process ERC20 transfers
    trace.transactionTrace.events?.forEach((event: any) => {
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

    // Process ETH transfers
    const processEthTransfers = (call: any) => {
        netChanges[NATIVE_ETH_ADDRESS] = netChanges[NATIVE_ETH_ADDRESS] || 0n;
        const value = BigInt(call.value || '0x0');
        if (value > 0n) {
            if (controlledAddresses.has(call.from?.toLowerCase())) {
                netChanges[NATIVE_ETH_ADDRESS] -= value;
            }
            if (controlledAddresses.has(call.to?.toLowerCase())) {
                netChanges[NATIVE_ETH_ADDRESS] += value;
            }
        }
        call.calls?.forEach(processEthTransfers);
    };

    if (trace.transactionTrace.calls) processEthTransfers(trace.transactionTrace);

    // Subtract transaction fee
    const txFee = BigInt(trace.transactionTrace.gasUsed || '0x0') * BigInt(trace.transactionTrace.gasPrice || '0x0');
    netChanges[NATIVE_ETH_ADDRESS] = (netChanges[NATIVE_ETH_ADDRESS] || 0n) - txFee;

    return netChanges;
}