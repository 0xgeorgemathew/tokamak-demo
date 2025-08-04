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

    // STEP 2: NEW ALGORITHM - Track all token movements in/out of controlled addresses
    const tokenMovements: Record<string, { in: bigint; out: bigint }> = {};

    // Process ERC20 transfers
    trace.events?.forEach((event: any) => {
        if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC && event.topics.length >= 3) {
            const token = event.contract.toLowerCase();
            const from = `0x${event.topics[ 1 ].slice(26)}`.toLowerCase();
            const to = `0x${event.topics[ 2 ].slice(26)}`.toLowerCase();
            const amount = BigInt(event.data);

            if (!tokenMovements[ token ]) {
                tokenMovements[ token ] = { in: 0n, out: 0n };
            }

            // Track money flowing INTO controlled addresses (positive for us)
            if (controlledAddresses.has(to) && !controlledAddresses.has(from)) {
                tokenMovements[ token ].in += amount;
                Logger.debug(`💰 ${token}: +${amount} (external → controlled)`);
            }

            // Track money flowing OUT OF controlled addresses (negative for us)
            if (controlledAddresses.has(from) && !controlledAddresses.has(to)) {
                tokenMovements[ token ].out += amount;
                Logger.debug(`💸 ${token}: -${amount} (controlled → external)`);
            }
        }
    });

    // Process ETH transfers
    const processEthTransfers = (call: any) => {
        const value = BigInt(call.value || '0x0');
        if (value > 0n) {
            if (!tokenMovements[ NATIVE_ETH_ADDRESS ]) {
                tokenMovements[ NATIVE_ETH_ADDRESS ] = { in: 0n, out: 0n };
            }

            if (controlledAddresses.has(call.to.toLowerCase()) && !controlledAddresses.has(call.from.toLowerCase())) {
                tokenMovements[ NATIVE_ETH_ADDRESS ].in += value;
                Logger.debug(`💰 ETH: +${value} (external → controlled)`);
            }

            if (controlledAddresses.has(call.from.toLowerCase()) && !controlledAddresses.has(call.to.toLowerCase())) {
                tokenMovements[ NATIVE_ETH_ADDRESS ].out += value;
                Logger.debug(`💸 ETH: -${value} (controlled → external)`);
            }
        }
        call.calls?.forEach(processEthTransfers);
    };
    if (trace.calls) processEthTransfers(trace);

    // STEP 3: Calculate transaction fees
    const txFee = BigInt(trace.gasUsed || '0x0') * BigInt(trace.gasPrice || '0x0');
    if (!tokenMovements[ NATIVE_ETH_ADDRESS ]) {
        tokenMovements[ NATIVE_ETH_ADDRESS ] = { in: 0n, out: 0n };
    }
    tokenMovements[ NATIVE_ETH_ADDRESS ].out += txFee; // Gas is always a cost
    Logger.debug(`⛽ Gas fee: ${txFee} ETH`);

    // STEP 4: Calculate TRUE net changes (profit/loss per token)
    const netChanges: Record<string, bigint> = {};
    const totalInflows: Record<string, bigint> = {};
    const totalOutflows: Record<string, bigint> = {};

    for (const [ token, movements ] of Object.entries(tokenMovements)) {
        const netChange = movements.in - movements.out;

        if (netChange !== 0n || movements.in > 0n || movements.out > 0n) {
            netChanges[ token ] = netChange;
            totalInflows[ token ] = movements.in;
            totalOutflows[ token ] = movements.out;

            Logger.debug(`🧮 ${token} Net Analysis: In=${movements.in}, Out=${movements.out}, Net=${netChange}`);
        }
    }

    // STEP 5: Enrich and format for LLM
    const enrichedNetChanges: { token: TokenInfo; amount: bigint; totalIn: bigint; totalOut: bigint }[] = [];

    for (const [ address, netAmount ] of Object.entries(netChanges)) {
        const tokenInfo = await TokenMetadataManager.getTokenInfo(chainId, address);
        enrichedNetChanges.push({
            token: tokenInfo,
            amount: netAmount,
            totalIn: totalInflows[ address ] || 0n,
            totalOut: totalOutflows[ address ] || 0n
        });
    }

    // STEP 6: Format for LLM with clear profit/loss distinction
    const formatEnrichedForLlm = (items: { token: TokenInfo; amount: bigint; totalIn: bigint; totalOut: bigint }[]) =>
        items.map((item) => ({
            token: item.token,
            rawAmount: (item.amount > 0n ? item.amount : -item.amount).toString(),
            formattedAmount: formatTokenAmount(
                item.amount > 0n ? item.amount : -item.amount,
                item.token.decimals,
                item.token.symbol
            ),
            isProfit: item.amount > 0n,
            // Additional context for debugging
            totalReceived: formatTokenAmount(item.totalIn, item.token.decimals, item.token.symbol),
            totalSpent: formatTokenAmount(item.totalOut, item.token.decimals, item.token.symbol),
            netChange: formatTokenAmount(
                item.amount > 0n ? item.amount : -item.amount,
                item.token.decimals,
                item.token.symbol
            ) + (item.amount > 0n ? ' profit' : ' loss')
        }));

    // STEP 7: CRITICAL FIX - Only include tokens with actual net changes
    const tokensWithNetChanges = enrichedNetChanges.filter((c) => c.amount !== 0n);

    // Separate into losses and gains based on NET amounts
    const losses = tokensWithNetChanges.filter((c) => c.amount < 0n).sort((a, b) => Number(a.amount - b.amount));
    const gains = tokensWithNetChanges.filter((c) => c.amount > 0n).sort((a, b) => Number(b.amount - a.amount));

    // Find primary assets (largest net movements)
    const primaryAssetIn = losses.length > 0 ? formatEnrichedForLlm([ losses[ 0 ] ])[ 0 ] : null;
    const primaryAssetOut = gains.length > 0 ? formatEnrichedForLlm([ gains[ 0 ] ])[ 0 ] : null;

    // STEP 8: Build comprehensive financial summary
    const allNetChanges = formatEnrichedForLlm(tokensWithNetChanges);

    Logger.info(`📊 Net Changes Summary:`);
    allNetChanges.forEach(change => {
        Logger.info(`   ${change.token.symbol}: ${change.isProfit ? '+' : '-'}${change.formattedAmount} (net ${change.isProfit ? 'profit' : 'loss'})`);
        Logger.debug(`      Total received: ${change.totalReceived}, Total spent: ${change.totalSpent}`);
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

        // FIXED: Now shows actual net profit/loss per token
        financials: {
            netProfitOrLoss: allNetChanges,

            // Additional breakdown for better analysis
            totalInflows: formatEnrichedForLlm(tokensWithNetChanges.map(c => ({ ...c, amount: c.totalIn }))),
            totalOutflows: formatEnrichedForLlm(tokensWithNetChanges.map(c => ({ ...c, amount: c.totalOut }))),

            // Summary metrics
            totalTokensInvolved: tokensWithNetChanges.length,
            profitableTokens: gains.length,
            lossTokens: losses.length,
        },

        swapDetails: {
            assetIn: primaryAssetIn,
            assetOut: primaryAssetOut,

            // Enhanced swap context
            swapType: tokensWithNetChanges.length === 2 ? 'simple-swap' :
                tokensWithNetChanges.length > 2 ? 'multi-token-arbitrage' : 'complex',
            netProfitSummary: gains.map(g =>
                `+${formatTokenAmount(g.amount, g.token.decimals, g.token.symbol)}`
            ).join(', ') +
                (losses.length > 0 ? ' | ' + losses.map(l =>
                    `-${formatTokenAmount(-l.amount, l.token.decimals, l.token.symbol)}`
                ).join(', ') : ''),
        },

        // Debug information
        debugInfo: {
            controlledAddresses: Array.from(controlledAddresses),
            tokenMovements: Object.fromEntries(
                Object.entries(tokenMovements).map(([ token, movements ]) => [
                    token,
                    {
                        in: movements.in.toString(),
                        out: movements.out.toString(),
                        net: (movements.in - movements.out).toString()
                    }
                ])
            )
        }
    };
}