import { NextRequest, NextResponse } from 'next/server';
import { analyzeTransaction } from '@/lib/analysis/transaction-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, txHash } = body;

    // Validate input
    if (!chainId || !txHash) {
      return NextResponse.json(
        { error: 'Missing required parameters: chainId and txHash' },
        { status: 400 }
      );
    }

    // Validate chainId is a number
    const numericChainId = Number(chainId);
    if (isNaN(numericChainId)) {
      return NextResponse.json(
        { error: 'chainId must be a valid number' },
        { status: 400 }
      );
    }

    // Validate txHash format (basic validation)
    if (typeof txHash !== 'string' || !txHash.startsWith('0x') || txHash.length !== 66) {
      return NextResponse.json(
        { error: 'txHash must be a valid transaction hash (0x...66 chars)' },
        { status: 400 }
      );
    }

    // Perform the analysis
    const result = await analyzeTransaction(numericChainId, txHash);

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error - Transaction analysis failed:', error);
    
    // Return a more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Transaction analysis failed';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}