import { ProtocolInteraction, GasAnalysis } from "../types";

export function analyzeGasEfficiency(gasUsed: number, protocols: ProtocolInteraction[]): GasAnalysis {
    let efficiency: 'high' | 'medium' | 'low' = 'medium';

    // Simple heuristics for gas efficiency
    if (gasUsed < 100000) efficiency = 'high';
    else if (gasUsed > 500000) efficiency = 'low';

    // Adjust based on complexity (multiple protocols = more complex)
    if (protocols.length > 2 && gasUsed < 200000) efficiency = 'high';

    return {
        totalGasUsed: gasUsed,
        gasPrice: '0', // Will be filled by caller
        gasCostEth: '0', // Will be filled by caller
        gasEfficiency: efficiency,
    };
}