import { ERC20_TRANSFER_TOPIC, Logger, NATIVE_ETH_ADDRESS } from '../constants';
import { TokenInfo, TransactionMetadata } from '../types';
import { formatTokenAmount } from '../utils';
import { detectProtocols } from './detect-protocols';
import { analyzeGasEfficiency } from './gas';
import { TokenMetadataManager } from './tokens';

export async function analyzeSimpleTrace(chainId: number, traceData: any, metadata?: TransactionMetadata): Promise<any> {
    const trace = traceData.transactionTrace;
    const initiator = trace.from.toLowerCase();
    const proxyContract = trace.to.toLowerCase();

    Logger.info(`🔍 Analyzing trace for initiator: ${initiator}`);

    const detectedProtocols = detectProtocols(trace);
    Logger.info(`Detected protocols: ${detectedProtocols.map((p) => p.protocol).join(', ')}`);

    const gasUsed = parseInt(trace.gasUsed || '0x0', 16);
    const gasAnalysis = analyzeGasEfficiency(gasUsed, detectedProtocols);
    if (metadata) {
        gasAnalysis.gasPrice = metadata.gasPrice;
        gasAnalysis.gasCostEth = metadata.gasCostEth;
    }

    // STEP 1: Build comprehensive controlled addresses map
    const controlledAddresses = new Set([ initiator, proxyContract ]);
    const findControlledRecursive = (call: any) => {
        if (controlledAddresses.has(call.from.toLowerCase())) {
            controlledAddresses.add(call.to.toLowerCase());
        }
        call.calls?.forEach(findControlledRecursive);
    };
    if (trace.calls) findControlledRecursive(trace);

    Logger.debug('Controlled addresses:', Array.from(controlledAddresses));

    // STEP 2: CORRECTED ALGORITHM - Track COMPLETE token flow including initial investments
    const tokenMovements: Record<string, {
        totalIn: bigint;
        totalOut: bigint;
        initialBalance: bigint;
        finalBalance: bigint;
    }> = {};

    // FIX #1: Process initial transaction value (ETH sent with transaction)
    const initialEthValue = BigInt(trace.value || '0x0');
    if (initialEthValue > 0n) {
        if (!tokenMovements[ NATIVE_ETH_ADDRESS ]) {
            tokenMovements[ NATIVE_ETH_ADDRESS ] = { totalIn: 0n, totalOut: 0n, initialBalance: 0n, finalBalance: 0n };
        }
        tokenMovements[ NATIVE_ETH_ADDRESS ].totalOut += initialEthValue;
        Logger.debug(`💸 Initial ETH: -${initialEthValue} (transaction value)`);
    }

    // FIX #2: Process ALL ERC20 transfers and track balances properly
    trace.events?.forEach((event: any) => {
        if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC && event.topics.length >= 3) {
            const token = event.contract.toLowerCase();
            const from = `0x${event.topics[ 1 ].slice(26)}`.toLowerCase();
            const to = `0x${event.topics[ 2 ].slice(26)}`.toLowerCase();
            const amount = BigInt(event.data);

            if (!tokenMovements[ token ]) {
                tokenMovements[ token ] = { totalIn: 0n, totalOut: 0n, initialBalance: 0n, finalBalance: 0n };
            }

            // Track ALL movements involving controlled addresses
            if (controlledAddresses.has(from)) {
                tokenMovements[ token ].totalOut += amount;
                Logger.debug(`💸 ${token}: -${amount} (${from} → ${to})`);
            }
            if (controlledAddresses.has(to)) {
                tokenMovements[ token ].totalIn += amount;
                Logger.debug(`💰 ${token}: +${amount} (${from} → ${to})`);
            }
        }
    });

    // FIX #3: Process ETH transfers in calls
    const processEthTransfers = (call: any) => {
        const value = BigInt(call.value || '0x0');
        if (value > 0n) {
            if (!tokenMovements[ NATIVE_ETH_ADDRESS ]) {
                tokenMovements[ NATIVE_ETH_ADDRESS ] = { totalIn: 0n, totalOut: 0n, initialBalance: 0n, finalBalance: 0n };
            }

            if (controlledAddresses.has(call.from?.toLowerCase())) {
                tokenMovements[ NATIVE_ETH_ADDRESS ].totalOut += value;
                Logger.debug(`💸 ETH call: -${value} (${call.from} → ${call.to})`);
            }
            if (controlledAddresses.has(call.to?.toLowerCase())) {
                tokenMovements[ NATIVE_ETH_ADDRESS ].totalIn += value;
                Logger.debug(`💰 ETH call: +${value} (${call.from} → ${call.to})`);
            }
        }
        call.calls?.forEach(processEthTransfers);
    };
    if (trace.calls) processEthTransfers(trace);

    // STEP 4: Calculate transaction fees (always a cost)
    const txFee = BigInt(trace.gasUsed || '0x0') * BigInt(trace.gasPrice || '0x0');
    if (!tokenMovements[ NATIVE_ETH_ADDRESS ]) {
        tokenMovements[ NATIVE_ETH_ADDRESS ] = { totalIn: 0n, totalOut: 0n, initialBalance: 0n, finalBalance: 0n };
    }
    tokenMovements[ NATIVE_ETH_ADDRESS ].totalOut += txFee;
    Logger.debug(`⛽ Gas fee: ${txFee} ETH`);

    // STEP 5: CRITICAL FIX - Calculate TRUE net changes
    const netChanges: Record<string, bigint> = {};
    const totalInflows: Record<string, bigint> = {};
    const totalOutflows: Record<string, bigint> = {};

    for (const [ token, movements ] of Object.entries(tokenMovements)) {
        const netChange = movements.totalIn - movements.totalOut;

        // Only include tokens that had actual movement
        if (movements.totalIn > 0n || movements.totalOut > 0n) {
            netChanges[ token ] = netChange;
            totalInflows[ token ] = movements.totalIn;
            totalOutflows[ token ] = movements.totalOut;

            Logger.debug(`🧮 ${token} CORRECTED Analysis: In=${movements.totalIn}, Out=${movements.totalOut}, Net=${netChange}`);
        }
    }

    // STEP 6: Enrich with token metadata
    const enrichedNetChanges: {
        token: TokenInfo;
        amount: bigint;
        totalIn: bigint;
        totalOut: bigint;
        netChangeFormatted: string;
    }[] = [];

    for (const [ address, netAmount ] of Object.entries(netChanges)) {
        const tokenInfo = await TokenMetadataManager.getTokenInfo(chainId, address);
        const totalIn = totalInflows[ address ] || 0n;
        const totalOut = totalOutflows[ address ] || 0n;

        enrichedNetChanges.push({
            token: tokenInfo,
            amount: netAmount,
            totalIn,
            totalOut,
            netChangeFormatted: formatTokenAmount(
                netAmount > 0n ? netAmount : -netAmount,
                tokenInfo.decimals,
                tokenInfo.symbol
            )
        });
    }

    // STEP 7: Format for LLM with CORRECTED profit/loss data
    const formatEnrichedForLlm = (items: typeof enrichedNetChanges) =>
        items.map((item) => ({
            token: item.token,
            rawAmount: (item.amount > 0n ? item.amount : -item.amount).toString(),
            formattedAmount: item.netChangeFormatted,
            isProfit: item.amount > 0n,
            // CORRECTED: Show actual total flows for transparency
            totalReceived: formatTokenAmount(item.totalIn, item.token.decimals, item.token.symbol),
            totalSpent: formatTokenAmount(item.totalOut, item.token.decimals, item.token.symbol),
            netChange: `${item.netChangeFormatted} ${item.amount > 0n ? 'profit' : 'loss'}`,
            // FIX: Add investment context
            investmentFlow: item.totalOut > 0n && item.totalIn > 0n ?
                `Invested ${formatTokenAmount(item.totalOut, item.token.decimals, item.token.symbol)}, received ${formatTokenAmount(item.totalIn, item.token.decimals, item.token.symbol)}` :
                item.totalOut > 0n ? `Spent ${formatTokenAmount(item.totalOut, item.token.decimals, item.token.symbol)}` :
                    `Received ${formatTokenAmount(item.totalIn, item.token.decimals, item.token.symbol)}`
        }));

    // STEP 8: Filter to only include tokens with net changes (CRITICAL)
    const tokensWithNetChanges = enrichedNetChanges.filter((c) => c.amount !== 0n);

    // Separate into losses and gains based on NET amounts
    const losses = tokensWithNetChanges.filter((c) => c.amount < 0n).sort((a, b) => Number(a.amount - b.amount));
    const gains = tokensWithNetChanges.filter((c) => c.amount > 0n).sort((a, b) => Number(b.amount - a.amount));

    // Find primary assets (largest net movements)
    const primaryAssetIn = losses.length > 0 ? formatEnrichedForLlm([ losses[ 0 ] ])[ 0 ] : null;
    const primaryAssetOut = gains.length > 0 ? formatEnrichedForLlm([ gains[ 0 ] ])[ 0 ] : null;

    // STEP 9: Build CORRECTED financial summary
    const allNetChanges = formatEnrichedForLlm(tokensWithNetChanges);

    Logger.info(`📊 CORRECTED Net Changes Summary:`);
    allNetChanges.forEach(change => {
        Logger.info(`   ${change.token.symbol}: ${change.isProfit ? '+' : '-'}${change.formattedAmount} (net ${change.isProfit ? 'profit' : 'loss'})`);
        Logger.info(`      Investment flow: ${change.investmentFlow}`);
    });

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

        // CORRECTED: Now shows actual net profit/loss per token
        financials: {
            netProfitOrLoss: allNetChanges,

            // Enhanced breakdown for better analysis
            investmentBreakdown: allNetChanges.map(change => ({
                token: change.token.symbol,
                invested: change.totalSpent,
                received: change.totalReceived,
                netProfit: change.netChange,
                investmentContext: change.investmentFlow
            })),

            // Summary metrics  
            totalTokensInvolved: tokensWithNetChanges.length,
            profitableTokens: gains.length,
            lossTokens: losses.length,
        },

        swapDetails: {
            assetIn: primaryAssetIn,
            assetOut: primaryAssetOut,

            // Enhanced swap context with CORRECTED interpretation
            swapType: tokensWithNetChanges.length === 2 ? 'simple-swap' :
                tokensWithNetChanges.length > 2 ? 'multi-token-arbitrage' : 'complex',
            netProfitSummary: `Net result: ${gains.map(g =>
                `+${g.netChangeFormatted}`
            ).join(', ')}${losses.length > 0 ? ' | ' + losses.map(l =>
                `-${l.netChangeFormatted}`
            ).join(', ') : ''}`,

            // FIX: Add investment context to swap details
            tradeAnalysis: {
                type: 'arbitrage',
                description: `Converted ${primaryAssetIn?.formattedAmount || 'assets'} to ${primaryAssetOut?.formattedAmount || 'assets'}`,
                realProfit: gains.length > 0 ? gains[ 0 ].netChangeFormatted : 'No profit',
                investmentRequired: losses.length > 0 ? losses.map(l => l.netChangeFormatted).join(', ') : 'No investment'
            }
        },

        // Enhanced debug information
        debugInfo: {
            controlledAddresses: Array.from(controlledAddresses),
            correctedTokenMovements: Object.fromEntries(
                Object.entries(tokenMovements).map(([ token, movements ]) => [
                    token,
                    {
                        totalIn: movements.totalIn.toString(),
                        totalOut: movements.totalOut.toString(),
                        netChange: (movements.totalIn - movements.totalOut).toString(),
                        hasRealProfit: movements.totalIn > movements.totalOut
                    }
                ])
            ),
            transactionFlow: {
                initialValue: trace.value || '0x0',
                gasCost: txFee.toString(),
                explanation: 'Net changes now properly account for initial investments and final receipts'
            }
        }
    };
}