// ⚠️  DEPRECATED: This file has been migrated to lib/analysis/transaction-analyzer.ts
// 
// The core transaction analysis functionality has been moved to:
// lib/analysis/transaction-analyzer.ts
//
// To use the analyzer in your application, import it like this:
// import { analyzeTransaction } from './lib/analysis/transaction-analyzer';
//
// This file is kept for legacy CLI usage only.

import { exit } from 'process';
import { analyzeTransaction } from './lib/analysis/transaction-analyzer';
import { Logger } from './lib/constants';

// --- CLI Entry Point ---

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    Logger.error('Usage: ts-node <script_path> <chainId> <txHash>');
    Logger.error(
      'Example: ts-node txAnalyzer.ts 1 0xaadde745a5bf7dbf572aa5d3c9095d18b5432edfa239975196368fbd10e55503',
    );
    exit(1);
  }

  const chainId = parseInt(args[0], 10);
  const txHash = args[1];

  await analyzeTransaction(chainId, txHash).catch(() => exit(1));
}

// Only run main if the script is executed directly
if (require.main === module) {
  main();
}