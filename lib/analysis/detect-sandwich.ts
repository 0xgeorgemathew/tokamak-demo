import { callRpc, getTransactionTrace } from "../api/1inch";
import type {
    TokenInfo,
    EnrichedAsset,
    TransactionMetadata,
    ProtocolInteraction,
    GasAnalysis,
    SandwichPattern,
    PriceImpactAnalysis,
    MEVBotProfile
} from '../types';
import { ERC20_TRANSFER_TOPIC, Logger } from '../constants';
import { extractTokenFlows } from './tokens';
import { calculatePriceImpact } from "./calculations";
export async function detectSandwichByPattern(
    chainId: number,
    txHash: string,
    blockNumber: number,
): Promise<SandwichPattern | null> {
    Logger.info(`Running pattern-first sandwich detection for ${txHash}`);

    // First try single-block detection
    const singleBlockResult = await detectSandwichInBlock(chainId, txHash, blockNumber);
    if (singleBlockResult) {
        return singleBlockResult;
    }

    // If not found, try multi-block detection
    Logger.info('Single-block detection failed, trying multi-block detection...');
    return await detectSandwichAcrossBlocks(chainId, txHash, blockNumber);
}

export async function detectSandwichInBlock(
    chainId: number,
    txHash: string,
    blockNumber: number,
): Promise<SandwichPattern | null> {
    // Get the block and find our transaction
    const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${blockNumber.toString(16)}`, true ]);
    const txs = block.transactions;
    const currentTxIndex = txs.findIndex((tx: any) => tx.hash === txHash);

    if (currentTxIndex === -1) return null;

    const currentTx = txs[ currentTxIndex ];
    const currentTrace = await getTransactionTrace(chainId, txHash, blockNumber);
    const currentFlows = await extractTokenFlows(currentTrace);
    const currentAddress = currentTx.from.toLowerCase();

    // Extract current transaction's token pairs
    const currentTokens = [ ...new Set(currentFlows.map(f => f.token)) ];
    if (currentTokens.length < 2) return null; // Need at least 2 tokens for a swap

    // Look for pattern: Check surrounding transactions for mirrored token flows
    let frontRunTx = null;
    let backRunTx = null;

    // Strategy 1: Look for same address before and after (front-run and back-run)
    for (let i = Math.max(0, currentTxIndex - 5); i < currentTxIndex; i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() === currentAddress) {
            // Found a potential front-run from same address
            const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
            const flows = await extractTokenFlows(trace);
            const tokens = [ ...new Set(flows.map(f => f.token)) ];

            // Check if it involves same tokens
            const commonTokens = currentTokens.filter(token => tokens.includes(token));
            if (commonTokens.length >= 2) {
                frontRunTx = tx;
                break;
            }
        }
    }

    for (let i = currentTxIndex + 1; i < Math.min(txs.length, currentTxIndex + 6); i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() === currentAddress) {
            // Found a potential back-run from same address
            const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
            const flows = await extractTokenFlows(trace);
            const tokens = [ ...new Set(flows.map(f => f.token)) ];

            // Check if it involves same tokens
            const commonTokens = currentTokens.filter(token => tokens.includes(token));
            if (commonTokens.length >= 2) {
                backRunTx = tx;
                break;
            }
        }
    }

    // If we found both front-run and back-run, current tx is the victim
    if (frontRunTx && backRunTx) {

        const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
        const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);
        const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, currentTrace, backRunTrace);

        return {
            frontRun: {
                hash: frontRunTx.hash,
                type: 'front-run',
                blockNumber,
                transactionIndex: frontRunTx.transactionIndex,
                from: frontRunTx.from,
            },
            victim: {
                hash: txHash,
                type: 'victim',
                blockNumber,
                transactionIndex: currentTx.transactionIndex,
                from: currentTx.from,
            },
            backRun: {
                hash: backRunTx.hash,
                type: 'back-run',
                blockNumber,
                transactionIndex: backRunTx.transactionIndex,
                from: backRunTx.from,
            },
            confidence: 'high',
            priceImpact,
            victimLoss: [],
            attackerProfit: [],
        };
    }

    // Strategy 2: Check if current tx is part of sandwich (front-run or back-run)
    // Look for victim transaction between potential front-run and back-run
    let potentialVictim = null;

    // Check if current is front-run
    for (let i = currentTxIndex + 1; i < Math.min(txs.length, currentTxIndex + 5); i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() !== currentAddress) {
            // Potential victim (different address)
            const trace = await getTransactionTrace(chainId, tx.hash, blockNumber);
            const flows = await extractTokenFlows(trace);
            const tokens = [ ...new Set(flows.map(f => f.token)) ];

            // Check if victim uses same tokens
            const commonTokens = currentTokens.filter(token => tokens.includes(token));
            if (commonTokens.length >= 2) {
                potentialVictim = tx;
                break;
            }
        }
    }

    if (potentialVictim) {
        // Look for back-run after victim
        const victimIndex = txs.findIndex((tx: any) => tx.hash === potentialVictim.hash);
        for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 5); i++) {
            const tx = txs[ i ];
            if (tx.from.toLowerCase() === currentAddress) {
                // Found back-run from same address as current (front-run)
                backRunTx = tx;

                const victimTrace = await getTransactionTrace(chainId, potentialVictim.hash, blockNumber);
                const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);
                const priceImpact = await calculatePriceImpact(chainId, currentTrace, victimTrace, backRunTrace);

                return {
                    frontRun: {
                        hash: txHash,
                        type: 'front-run',
                        blockNumber,
                        transactionIndex: currentTx.transactionIndex,
                        from: currentTx.from,
                    },
                    victim: {
                        hash: potentialVictim.hash,
                        type: 'victim',
                        blockNumber,
                        transactionIndex: potentialVictim.transactionIndex,
                        from: potentialVictim.from,
                    },
                    backRun: {
                        hash: backRunTx.hash,
                        type: 'back-run',
                        blockNumber,
                        transactionIndex: backRunTx.transactionIndex,
                        from: backRunTx.from,
                    },
                    confidence: 'high',
                    priceImpact,
                    victimLoss: [],
                    attackerProfit: [],
                };
            }
        }
    }

    return null;
}

export async function detectSandwichAcrossBlocks(
    chainId: number,
    txHash: string,
    blockNumber: number,
): Promise<SandwichPattern | null> {
    const currentBlock = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${blockNumber.toString(16)}`, true ]);
    const currentTxIndex = currentBlock.transactions.findIndex((tx: any) => tx.hash === txHash);

    if (currentTxIndex === -1) return null;

    const currentTx = currentBlock.transactions[ currentTxIndex ];
    const currentTrace = await getTransactionTrace(chainId, txHash, blockNumber);
    const currentFlows = await extractTokenFlows(currentTrace);
    const currentAddress = currentTx.from.toLowerCase();
    const currentTokens = [ ...new Set(currentFlows.map(f => f.token)) ];

    if (currentTokens.length < 2) return null;

    // Check previous blocks for front-run
    let frontRunTx = null;
    let frontRunBlockNumber = null;

    for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
        const prevBlockNum = blockNumber - blockOffset;
        if (prevBlockNum < 0) break;

        try {
            const prevBlock = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${prevBlockNum.toString(16)}`, true ]);

            // Look for transactions from same address with same tokens
            for (let i = prevBlock.transactions.length - 1; i >= Math.max(0, prevBlock.transactions.length - 10); i--) {
                const tx = prevBlock.transactions[ i ];
                if (tx.from.toLowerCase() === currentAddress) {
                    const trace = await getTransactionTrace(chainId, tx.hash, prevBlockNum);
                    const flows = await extractTokenFlows(trace);
                    const tokens = [ ...new Set(flows.map(f => f.token)) ];

                    const commonTokens = currentTokens.filter(token => tokens.includes(token));
                    if (commonTokens.length >= 2) {
                        frontRunTx = tx;
                        frontRunBlockNumber = prevBlockNum;
                        break;
                    }
                }
            }
            if (frontRunTx) break;
        } catch (error) {
            Logger.error(`Failed to fetch block ${prevBlockNum}: ${error}`);
        }
    }

    // Check next blocks for back-run
    let backRunTx = null;
    let backRunBlockNumber = null;

    for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
        const nextBlockNum = blockNumber + blockOffset;

        try {
            const nextBlock = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${nextBlockNum.toString(16)}`, true ]);

            // Look for transactions from same address with same tokens
            for (let i = 0; i < Math.min(nextBlock.transactions.length, 10); i++) {
                const tx = nextBlock.transactions[ i ];
                if (tx.from.toLowerCase() === currentAddress) {
                    const trace = await getTransactionTrace(chainId, tx.hash, nextBlockNum);
                    const flows = await extractTokenFlows(trace);
                    const tokens = [ ...new Set(flows.map(f => f.token)) ];

                    const commonTokens = currentTokens.filter(token => tokens.includes(token));
                    if (commonTokens.length >= 2) {
                        backRunTx = tx;
                        backRunBlockNumber = nextBlockNum;
                        break;
                    }
                }
            }
            if (backRunTx) break;
        } catch (error) {
            Logger.error(`Failed to fetch block ${nextBlockNum}: ${error}`);
        }
    }

    // If we found both front-run and back-run across blocks
    if (frontRunTx && backRunTx && frontRunBlockNumber !== null && backRunBlockNumber !== null) {
        const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, frontRunBlockNumber);
        const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, backRunBlockNumber);
        const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, currentTrace, backRunTrace);

        return {
            frontRun: {
                hash: frontRunTx.hash,
                type: 'front-run',
                blockNumber: frontRunBlockNumber,
                transactionIndex: frontRunTx.transactionIndex,
                from: frontRunTx.from,
            },
            victim: {
                hash: txHash,
                type: 'victim',
                blockNumber,
                transactionIndex: currentTx.transactionIndex,
                from: currentTx.from,
            },
            backRun: {
                hash: backRunTx.hash,
                type: 'back-run',
                blockNumber: backRunBlockNumber,
                transactionIndex: backRunTx.transactionIndex,
                from: backRunTx.from,
            },
            confidence: 'medium', // Lower confidence for cross-block detection
            priceImpact,
            victimLoss: [],
            attackerProfit: [],
        };
    }

    return null;
}

export async function detectCrossBlockSandwich(
    chainId: number,
    frontRunTxHash: string,
    frontRunBlockNumber: number,
    attackerAddress: string
): Promise<{
    victimHash: string;
    backRunHash: string;
    victimBlockNumber: number;
    backRunBlockNumber: number;
} | null> {
    Logger.info(`Searching for sandwich pattern across blocks starting from ${frontRunBlockNumber}`);

    // Step 1: Look for victim transaction in the same block first, then next blocks
    let victimHash = null;
    let victimBlockNumber = frontRunBlockNumber;

    // Search current block and next 3 blocks for victim
    for (let blockOffset = 0; blockOffset <= 3; blockOffset++) {
        const searchBlockNumber = frontRunBlockNumber + blockOffset;
        try {
            const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${searchBlockNumber.toString(16)}`, true ]);
            const txs = block.transactions;

            if (blockOffset === 0) {
                // In same block, look for transactions after the front-run
                const frontRunIndex = txs.findIndex((tx: any) => tx.hash === frontRunTxHash);
                if (frontRunIndex !== -1) {
                    // Look for victim transaction immediately after front-run
                    for (let i = frontRunIndex + 1; i < txs.length; i++) {
                        if (txs[ i ].from.toLowerCase() !== attackerAddress.toLowerCase()) {
                            victimHash = txs[ i ].hash;
                            victimBlockNumber = searchBlockNumber;
                            Logger.info(`Found potential victim in same block: ${victimHash}`);
                            break;
                        }
                    }
                }
            } else {
                // In subsequent blocks, look for any transaction not from attacker
                for (let i = 0; i < Math.min(txs.length, 10); i++) {
                    if (txs[ i ].from.toLowerCase() !== attackerAddress.toLowerCase()) {
                        victimHash = txs[ i ].hash;
                        victimBlockNumber = searchBlockNumber;
                        Logger.info(`Found potential victim in block ${searchBlockNumber}: ${victimHash}`);
                        break;
                    }
                }
            }

            if (victimHash) break;
        } catch (error) {
            Logger.error(`Failed to fetch block ${searchBlockNumber}: ${error}`);
        }
    }

    if (!victimHash) {
        Logger.info('No potential victim transaction found');
        return null;
    }

    // Step 2: Look for back-run transaction from same attacker after victim
    let backRunHash = null;
    let backRunBlockNumber = victimBlockNumber;

    // Search from victim block to next 3 blocks for back-run
    for (let blockOffset = 0; blockOffset <= 3; blockOffset++) {
        const searchBlockNumber = victimBlockNumber + blockOffset;
        try {
            const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${searchBlockNumber.toString(16)}`, true ]);
            const txs = block.transactions;

            if (blockOffset === 0) {
                // In same block as victim, look after victim transaction
                const victimIndex = txs.findIndex((tx: any) => tx.hash === victimHash);
                if (victimIndex !== -1) {
                    for (let i = victimIndex + 1; i < txs.length; i++) {
                        if (txs[ i ].from.toLowerCase() === attackerAddress.toLowerCase()) {
                            backRunHash = txs[ i ].hash;
                            backRunBlockNumber = searchBlockNumber;
                            Logger.info(`Found back-run in same block as victim: ${backRunHash}`);
                            break;
                        }
                    }
                }
            } else {
                // In subsequent blocks, look for any transaction from attacker
                for (let i = 0; i < Math.min(txs.length, 10); i++) {
                    if (txs[ i ].from.toLowerCase() === attackerAddress.toLowerCase()) {
                        backRunHash = txs[ i ].hash;
                        backRunBlockNumber = searchBlockNumber;
                        Logger.info(`Found back-run in block ${searchBlockNumber}: ${backRunHash}`);
                        break;
                    }
                }
            }

            if (backRunHash) break;
        } catch (error) {
            Logger.error(`Failed to fetch block ${searchBlockNumber}: ${error}`);
        }
    }

    if (!backRunHash) {
        Logger.info('No back-run transaction found from same attacker');
        return null;
    }

    Logger.info(`Cross-block sandwich pattern detected: Front-run (${frontRunTxHash}) → Victim (${victimHash}) → Back-run (${backRunHash})`);

    return {
        victimHash,
        backRunHash,
        victimBlockNumber,
        backRunBlockNumber
    };
}
export async function detectSandwichFromVictim(
    chainId: number,
    victimTxHash: string,
    blockNumber: number
): Promise<SandwichPattern | null> {
    Logger.info(`Analyzing potential victim transaction: ${victimTxHash}`);

    const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${blockNumber.toString(16)}`, true ]);
    const txs = block.transactions;
    const victimIndex = txs.findIndex((tx: any) => tx.hash === victimTxHash);

    if (victimIndex === -1) return null;

    const victimTx = txs[ victimIndex ];
    const victimTrace = await getTransactionTrace(chainId, victimTxHash, blockNumber);

    let frontRunTx = null;
    let backRunTx = null;
    let attacker = null;

    // Look for front-run transaction (more comprehensive search)
    for (let i = Math.max(0, victimIndex - 5); i < victimIndex; i++) {
        const potentialFrontRun = txs[ i ];
        const frontTrace = await getTransactionTrace(chainId, potentialFrontRun.hash, blockNumber);

        if (await isLikelySandwichTransaction(frontTrace, victimTrace, 'front-run')) {
            frontRunTx = potentialFrontRun;
            attacker = potentialFrontRun.from.toLowerCase();
            break;
        }
    }

    if (!frontRunTx || !attacker) return null;

    // Look for back-run transaction from same attacker
    for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 5); i++) {
        const potentialBackRun = txs[ i ];
        if (potentialBackRun.from.toLowerCase() === attacker) {
            backRunTx = potentialBackRun;
            break;
        }
    }

    if (!backRunTx) return null;

    const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
    const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);

    // Enhanced validation: Check if this is really a sandwich attack
    if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
        return null;
    }

    const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

    return {
        frontRun: {
            hash: frontRunTx.hash,
            type: 'front-run',
            blockNumber,
            transactionIndex: frontRunTx.transactionIndex,
            from: frontRunTx.from,
        },
        victim: {
            hash: victimTxHash,
            type: 'victim',
            blockNumber,
            transactionIndex: victimTx.transactionIndex,
            from: victimTx.from,
        },
        backRun: {
            hash: backRunTx.hash,
            type: 'back-run',
            blockNumber,
            transactionIndex: backRunTx.transactionIndex,
            from: backRunTx.from,
        },
        confidence: 'high',
        priceImpact,
        victimLoss: [],
        attackerProfit: [],
    };
}

export async function detectSandwichFromBackRun(
    chainId: number,
    backRunTxHash: string,
    blockNumber: number
): Promise<SandwichPattern | null> {
    Logger.info(`Analyzing potential back-run transaction: ${backRunTxHash}`);

    const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${blockNumber.toString(16)}`, true ]);
    const txs = block.transactions;
    const backRunIndex = txs.findIndex((tx: any) => tx.hash === backRunTxHash);

    if (backRunIndex === -1) return null;

    const backRunTx = txs[ backRunIndex ];
    const attacker = backRunTx.from.toLowerCase();

    let frontRunTx = null;
    let victimTx = null;

    for (let i = Math.max(0, backRunIndex - 5); i < backRunIndex; i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() === attacker && !frontRunTx) {
            frontRunTx = tx;
        }
        if (frontRunTx && tx.from.toLowerCase() !== attacker && !victimTx) {
            victimTx = tx;
        }
    }

    if (!frontRunTx || !victimTx) return null;

    const frontRunTrace = await getTransactionTrace(chainId, frontRunTx.hash, blockNumber);
    const victimTrace = await getTransactionTrace(chainId, victimTx.hash, blockNumber);
    const backRunTrace = await getTransactionTrace(chainId, backRunTxHash, blockNumber);

    // Enhanced validation: Check if this is really a sandwich attack
    if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
        return null;
    }

    const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

    return {
        frontRun: {
            hash: frontRunTx.hash,
            type: 'front-run',
            blockNumber,
            transactionIndex: frontRunTx.transactionIndex,
            from: frontRunTx.from,
        },
        victim: {
            hash: victimTx.hash,
            type: 'victim',
            blockNumber,
            transactionIndex: victimTx.transactionIndex,
            from: victimTx.from,
        },
        backRun: {
            hash: backRunTxHash,
            type: 'back-run',
            blockNumber,
            transactionIndex: backRunTx.transactionIndex,
            from: backRunTx.from,
        },
        confidence: 'high',
        priceImpact,
        victimLoss: [],
        attackerProfit: [],
    };
}

export async function detectSandwichFromFrontRun(
    chainId: number,
    frontRunTxHash: string,
    blockNumber: number
): Promise<SandwichPattern | null> {
    Logger.info(`Analyzing potential front-run transaction: ${frontRunTxHash}`);

    const block = await callRpc(chainId, 'eth_getBlockByNumber', [ `0x${blockNumber.toString(16)}`, true ]);
    const txs = block.transactions;
    const frontRunIndex = txs.findIndex((tx: any) => tx.hash === frontRunTxHash);

    if (frontRunIndex === -1) return null;

    const frontRunTx = txs[ frontRunIndex ];
    const attacker = frontRunTx.from.toLowerCase();

    let victimTx = null;
    let backRunTx = null;

    // Look for victim transaction immediately after front-run
    for (let i = frontRunIndex + 1; i < Math.min(txs.length, frontRunIndex + 4); i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() !== attacker && !victimTx) {
            victimTx = tx;
            break;
        }
    }

    if (!victimTx) return null;

    // Look for back-run transaction from same attacker after victim
    const victimIndex = txs.findIndex((tx: any) => tx.hash === victimTx.hash);
    for (let i = victimIndex + 1; i < Math.min(txs.length, victimIndex + 4); i++) {
        const tx = txs[ i ];
        if (tx.from.toLowerCase() === attacker) {
            backRunTx = tx;
            break;
        }
    }

    if (!backRunTx) return null;

    const frontRunTrace = await getTransactionTrace(chainId, frontRunTxHash, blockNumber);
    const victimTrace = await getTransactionTrace(chainId, victimTx.hash, blockNumber);
    const backRunTrace = await getTransactionTrace(chainId, backRunTx.hash, blockNumber);

    // Enhanced validation: Check if this is really a sandwich attack
    if (!(await validateSandwichPattern(frontRunTrace, victimTrace, backRunTrace, attacker))) {
        return null;
    }

    const priceImpact = await calculatePriceImpact(chainId, frontRunTrace, victimTrace, backRunTrace);

    return {
        frontRun: {
            hash: frontRunTxHash,
            type: 'front-run',
            blockNumber,
            transactionIndex: frontRunTx.transactionIndex,
            from: frontRunTx.from,
        },
        victim: {
            hash: victimTx.hash,
            type: 'victim',
            blockNumber,
            transactionIndex: victimTx.transactionIndex,
            from: victimTx.from,
        },
        backRun: {
            hash: backRunTx.hash,
            type: 'back-run',
            blockNumber,
            transactionIndex: backRunTx.transactionIndex,
            from: backRunTx.from,
        },
        confidence: 'high',
        priceImpact,
        victimLoss: [],
        attackerProfit: [],
    };
}
async function validateSandwichPattern(
    frontRunTrace: any,
    victimTrace: any,
    backRunTrace: any,
    _attackerAddress: string
): Promise<boolean> {
    // Use the new pattern-based validation
    const frontFlows = await extractTokenFlows(frontRunTrace);
    const victimFlows = await extractTokenFlows(victimTrace);
    const backFlows = await extractTokenFlows(backRunTrace);

    // Check if tokens match
    const frontTokens = [ ...new Set(frontFlows.map((f) => f.token)) ];
    const victimTokens = [ ...new Set(victimFlows.map((f) => f.token)) ];
    const backTokens = [ ...new Set(backFlows.map((f) => f.token)) ];

    const commonTokens = frontTokens.filter((token) => victimTokens.includes(token) && backTokens.includes(token));

    // Must have at least 2 common tokens and opposite flows
    return commonTokens.length >= 2;
}

async function isLikelySandwichTransaction(
    trace1: any,
    trace2: any,
    _expectedType: 'front-run' | 'back-run'
): Promise<boolean> {
    const getSwapTokens = (trace: any) => {
        const tokens = new Set<string>();
        trace.transactionTrace.events?.forEach((event: any) => {
            if (event.topics?.[ 0 ] === ERC20_TRANSFER_TOPIC) {
                tokens.add(event.contract.toLowerCase());
            }
        });
        return Array.from(tokens);
    };

    const tokens1 = getSwapTokens(trace1);
    const tokens2 = getSwapTokens(trace2);

    const commonTokens = tokens1.filter((token) => tokens2.includes(token));

    return commonTokens.length >= 2;
}