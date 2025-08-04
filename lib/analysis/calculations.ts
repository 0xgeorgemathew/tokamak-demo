import { ERC20_TRANSFER_TOPIC } from '../constants';
import { PriceImpactAnalysis } from '../types';
import { TokenMetadataManager } from './tokens';
export async function calculatePriceImpact(
    chainId: number,
    frontRunTrace: any,
    victimTrace: any,
    backRunTrace: any,
): Promise<PriceImpactAnalysis> {
    const extractSwapTokens = (trace: any) => {
        const tokens = new Set<string>();
        trace.events?.forEach((event: any) => {
            if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC) {
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

    const tokenA = await TokenMetadataManager.getTokenInfo(chainId, commonTokens[ 0 ]);
    const tokenB = await TokenMetadataManager.getTokenInfo(chainId, commonTokens[ 1 ]);

    return {
        tokenPair: { tokenA, tokenB },
        preBandwichPrice: 'Analysis needed',
        postBandwichPrice: 'Analysis needed',
        maxPriceImpact: 'High',
        victimSlippage: 'Significant',
        poolManipulation: 85, // Placeholder - would calculate from reserves
    };
}