# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js-based blockchain transaction analyzer and MEV (Maximal Extractable Value) detection system. The application provides transaction analysis, address profitability tracking, and strategy simulation capabilities across multiple EVM-compatible networks.

## Core Architecture

### Frontend Structure
- **Next.js 14 App Router**: Modern React framework with TypeScript
- **Component Hierarchy**: 
  - `app/page.tsx`: Main homepage with view switching between analyzer and simulator
  - `components/`: UI components organized by function (analyzer, simulator, shared UI)
  - `components/views/`: Complex view components for different app modes
  - `hooks/`: Custom React hooks for business logic (e.g., strategy simulator)

### Backend/API Structure
- **Transaction Analysis Engine**: `lib/analysis/transaction-analyzer.ts` - Core MEV detection and blockchain analysis
- **Configuration**: `lib/config.ts` - OpenAI integration and API endpoints
- **Network Support**: Multiple EVM chains via 1inch APIs (Ethereum, Arbitrum, Avalanche, etc.)
- **API Routes**: `app/api/analyze-transaction/route.ts` for server-side analysis

### Key Features
1. **Transaction Analysis**: Deep trace analysis for MEV detection, sandwich attacks, arbitrage
2. **Address Profitability**: Portfolio tracking and profit/loss calculation
3. **Strategy Simulation**: Backtesting trading strategies using historical data
4. **Multi-Chain Support**: 11+ EVM networks including Ethereum, Arbitrum, Base, etc.

## Development Commands

### Essential Commands
```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Testing
- No specific test commands defined - tests should be added if implementing new features
- Consider adding unit tests for the transaction analyzer logic

## Configuration & Environment

### Environment Variables Required
- `OPENAI_API_KEY`: Required for LLM-powered transaction analysis
- API endpoints configured to use 1inch proxy service

### Network Configuration
- Networks defined in `lib/constants.ts` with RPC URLs, block explorers, and chain IDs
- Default network is Ethereum mainnet
- All networks use 1inch API endpoints for data fetching

## Key Files and Components

### Transaction Analysis (`lib/analysis/transaction-analyzer.ts`)
- **Core Function**: `analyzeTransaction(chainId, txHash)` - Main entry point for analysis
- **MEV Detection**: Sophisticated sandwich attack detection with pattern matching
- **Protocol Detection**: Identifies DeFi protocols (Uniswap, Curve, Aave, etc.)
- **LLM Integration**: Uses OpenAI GPT-4 for natural language analysis reports

### UI Components
- **AnalyzerCard**: Transaction hash input and analysis display
- **SimulatorView**: Strategy backtesting interface
- **NetworkSelector**: Multi-chain network switching
- **GlassmorphicCard**: Reusable glassmorphism-styled containers

### Type Definitions (`lib/types.ts`)
- Comprehensive TypeScript interfaces for blockchain data
- Transaction metadata, MEV patterns, protocol interactions
- Network definitions and analysis results

## Development Guidelines

### Adding New Networks
1. Add network configuration to `SUPPORTED_NETWORKS` in `lib/constants.ts`
2. Ensure 1inch API support exists for the new chain
3. Test transaction analysis on the new network

### Extending Analysis Features
- Core analysis logic in `transaction-analyzer.ts`
- Add new MEV patterns to detection algorithms
- Update LLM prompts for new analysis types
- Maintain TypeScript interfaces in `lib/types.ts`

### UI Development
- Follow glassmorphism design patterns established in existing components
- Use Tailwind CSS for styling
- Maintain responsive design for mobile compatibility
- Components should be self-contained with proper TypeScript typing

## Integration Points

### 1inch API Integration
- Primary data source for blockchain data and transaction traces
- Proxy service: `https://1inch-vercel-proxy-psi.vercel.app`
- Supports multi-chain RPC calls and transaction tracing

### OpenAI Integration
- Model: GPT-4.1 (configured in `lib/config.ts`)
- Used for generating human-readable analysis reports
- Requires structured JSON prompts for consistent output

### External Dependencies
- **React Three Fiber**: 3D visualization components
- **Recharts**: Data visualization and charting
- **Radix UI**: Accessible UI primitives
- **Lucide React**: Icon system

## Common Development Tasks

### Analyzing New Transaction Types
1. Update detection patterns in `transaction-analyzer.ts`
2. Add new TypeScript interfaces in `lib/types.ts`
3. Update LLM prompts for new pattern recognition
4. Test with real transaction hashes

### Adding Protocol Support
1. Add protocol addresses to `KNOWN_PROTOCOLS` in `lib/constants.ts`
2. Update protocol detection logic
3. Add protocol-specific analysis rules

### UI Enhancements
1. Create new components in appropriate `components/` subdirectory
2. Use existing design patterns (glassmorphism, plasma theme)
3. Ensure TypeScript compliance and proper prop interfaces
4. Test across different screen sizes and networks