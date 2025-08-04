import { callRpc } from "../api/1inch";
import { ERC20_TRANSFER_TOPIC, Logger, NATIVE_ETH_ADDRESS } from "../constants";
import { TokenFlow, TokenInfo } from "../types";

export const TokenMetadataManager = {
    cache: new Map<string, TokenInfo>(),

    async getTokenInfo(chainId: number, address: string): Promise<TokenInfo> {
        const lowerAddress = address.toLowerCase();
        if (this.cache.has(lowerAddress)) {
            return this.cache.get(lowerAddress)!;
        }
        if (lowerAddress === NATIVE_ETH_ADDRESS) {
            const nativeInfo = { address: lowerAddress, symbol: 'ETH', decimals: 18 };
            this.cache.set(lowerAddress, nativeInfo);
            return nativeInfo;
        }

        try {
            Logger.info(`Fetching metadata for token: ${address}`);
            const [ symbolHex, decimalsHex ] = await Promise.all([
                callRpc(chainId, 'eth_call', [ { to: address, data: '0x95d89b41' }, 'latest' ]), // symbol()
                callRpc(chainId, 'eth_call', [ { to: address, data: '0x313ce567' }, 'latest' ]), // decimals()
            ]);

            // *** FIX: More robust string cleaning to remove all non-printable/control characters ***
            const symbol =
                symbolHex && symbolHex !== '0x'
                    ? Buffer.from(symbolHex.slice(2), 'hex')
                        .toString('utf8')
                        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
                        .trim()
                    : 'UNKNOWN';

            const decimals = decimalsHex && decimalsHex !== '0x' ? parseInt(decimalsHex, 16) : 18;

            const info = { address: lowerAddress, symbol, decimals };
            this.cache.set(lowerAddress, info);
            return info;
        } catch (e) {
            Logger.error(`Failed to fetch metadata for ${address}. Defaulting to UNKNOWN.`);
            const info = { address: lowerAddress, symbol: 'UNKNOWN', decimals: 18 };
            this.cache.set(lowerAddress, info);
            return info;
        }
    },
};
export async function extractTokenFlows(trace: any): Promise<TokenFlow[]> {
    const flows: TokenFlow[] = [];
    const transactionFrom = trace.transactionTrace?.from?.toLowerCase();

    trace.transactionTrace?.events?.forEach((event: any) => {
        if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC && event.data) {
            const token = event.contract.toLowerCase();
            const from = `0x${event.topics[ 1 ].slice(26)}`.toLowerCase();
            const to = `0x${event.topics[ 2 ].slice(26)}`.toLowerCase();
            const amount = BigInt(event.data);

            // Determine if this is a buy or sell from the perspective of the transaction initiator
            let direction: 'buy' | 'sell';
            if (from === transactionFrom) {
                direction = 'sell'; // User is sending tokens away
            } else if (to === transactionFrom) {
                direction = 'buy'; // User is receiving tokens
            } else {
                // This is an intermediate transfer, try to infer direction
                direction = 'buy'; // Default assumption
            }

            flows.push({
                token,
                direction,
                amount,
                from,
                to,
            });
        }
    });

    return flows;
}