import React, { useState } from 'react';
import {
  Hash,
  Wallet,
  History,
  Settings,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Target,
  DollarSign,
  Coins,
  Fuel,
  ArrowUpDown,
  Shield,
  Link,
  Search,
  RefreshCw,
  Activity,
  Clock,
  Layers,
} from 'lucide-react';
import { PortfolioChart } from './PortfolioChart';
import { getHistoricalPortfolioValue } from '@/lib/api/1inch';
import { isValidTransactionHash } from '@/lib/utils';

// The "TransactionInput" component is defined here. We will modify its button.
const TransactionInput = ({ value, onChange, onSubmit, loading }: any) => (
  <div className='flex items-center space-x-4'>
    <div className='relative flex-grow'>
      <Hash className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
      <input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Enter transaction hash or wallet address'
        className='w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500'
      />
    </div>
    <button
      onClick={() => onSubmit(value, 'transaction')}
      disabled={loading}
      // --- THIS IS THE CHANGE ---
      // Replaced the old classes with new glassmorphic styles
      className='backdrop-blur-sm bg-white/5 border border-white/10 text-white-300 px-6 py-3 rounded-xl font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'
    >
      {loading ? 'Analyzing...' : 'Analyze'}
    </button>
  </div>
);

interface TransactionAnalysisResult {
  strategy: string;
  confidence: string;
  summary: string;
  narrative: string[];
  protocols: string[];
  financials: {
    profit?: string;
    cost?: string;
    netProfit?: string;
    roi?: string;
    victimLoss?: string;
  };
  mevBotAnalysis?: {
    confidence: string;
    txFrequency: string;
    avgGasPrice: string;
    successRate?: string;
  };
  priceImpactAnalysis?: {
    tokenPair: string;
    victimSlippage: string;
    poolManipulation: string;
    maxPriceImpact?: string;
  };
  sandwichAnalysis?: {
    blockPosition: number;
    totalBlockTxs: number;
    isSandwichVictim: boolean;
    isSandwichAttacker: boolean;
    frontRunTx?: string;
    backRunTx?: string;
    victimSlippage?: string;
    attackerProfit?: string;
  };
  blockData?: {
    blockNumber: number;
    transactionIndex: number;
    gasPrice: string;
    timestamp: number;
  };
}

interface AnalyzerCardProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onAnalyze: (value: string, type: 'address' | 'transaction') => void;
  loading: boolean;
  result: string | null;
}

interface PortfolioData {
  timestamp: number;
  value_usd: number;
}

const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <div
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group ${
      active ? 'text-white' : 'text-gray-400 hover:text-white'
    }`}
    style={{
      background: active ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
      border: active ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
    }}
    onClick={onClick}
  >
    <Icon className='w-5 h-5 transition-transform duration-300 group-hover:scale-110' />
    <span className='text-sm font-medium tracking-wide'>{label}</span>
  </div>
);

// Strategy Badge Component
const StrategyBadge = ({ strategy, confidence }: { strategy: string; confidence: string }) => {
  const getStrategyColor = (strategy: string) => {
    switch (strategy.toLowerCase()) {
      case 'sandwich attack':
        return { bg: 'rgba(255, 0, 0, 0.1)', border: 'rgba(255, 0, 0, 0.3)', text: 'text-red-400' };
      case 'arbitrage':
      case 'cross-dex arbitrage':
        return { bg: 'rgba(0, 255, 0, 0.1)', border: 'rgba(0, 255, 0, 0.3)', text: 'text-green-400' };
      case 'liquidation':
        return { bg: 'rgba(255, 255, 0, 0.1)', border: 'rgba(255, 255, 0, 0.3)', text: 'text-yellow-400' };
      default:
        return { bg: 'rgba(0, 255, 255, 0.1)', border: 'rgba(0, 255, 255, 0.3)', text: 'text-cyan-400' };
    }
  };

  const colors = getStrategyColor(strategy);

  return (
    <div
      className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg ${colors.text} font-medium text-sm`}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <Zap className='w-4 h-4' />
      <span>{strategy}</span>
      <span className='text-xs opacity-75'>({confidence})</span>
    </div>
  );
};

// Helper functions for formatting
const formatTokenAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (num > 1000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return num.toFixed(6).replace(/\.?0+$/, '');
};

const formatCurrency = (amount: string): string => {
  const num = parseFloat(amount);
  if (num < 0.001) {
    return num.toFixed(10).replace(/\.?0+$/, '');
  }
  return num.toFixed(6).replace(/\.?0+$/, '');
};

const detectUniswapV2 = (protocols: string[], narrative: string[]): boolean => {
  const allText = [...protocols, ...narrative].join(' ').toLowerCase();
  return allText.includes('uni-v2') || allText.includes('uniswap v2') || allText.includes('uniswap-v2');
};

// Enhanced sandwich attack detection with aggressive pattern matching
const detectSandwichAttack = (
  result: TransactionAnalysisResult
): {
  isSandwich: boolean;
  type: 'victim' | 'attacker' | 'front-run' | 'back-run' | 'none';
  confidence: 'high' | 'medium' | 'low';
  details: string;
  sandwichData?: {
    frontRunTx?: string;
    victimTx?: string;
    backRunTx?: string;
    blockPosition?: number;
    detectionMethod?: string;
    transactionRole?: string;
  };
} => {
  const { sandwichAnalysis, blockData, priceImpactAnalysis, financials, narrative, strategy } = result;

  // Check for explicit sandwich analysis data from enhanced backend detection
  if (sandwichAnalysis) {
    if (sandwichAnalysis.isSandwichVictim) {
      return {
        isSandwich: true,
        type: 'victim',
        confidence:
          sandwichAnalysis.victimSlippage && parseFloat(sandwichAnalysis.victimSlippage) > 2 ? 'high' : 'medium',
        details: `Victim of sandwich attack with ${sandwichAnalysis.victimSlippage || 'significant'} slippage`,
        sandwichData: {
          frontRunTx: sandwichAnalysis.frontRunTx,
          backRunTx: sandwichAnalysis.backRunTx,
          blockPosition: sandwichAnalysis.blockPosition,
        },
      };
    }
    if (sandwichAnalysis.isSandwichAttacker) {
      return {
        isSandwich: true,
        type: 'attacker',
        confidence: 'high',
        details: `Sandwich attacker with ${sandwichAnalysis.attackerProfit || 'profitable'} gains`,
        sandwichData: {
          blockPosition: sandwichAnalysis.blockPosition,
        },
      };
    }
  }

  // Check for enhanced detection method indicators from backend
  if (result.hasOwnProperty('detectionMethod')) {
    const detectionMethod = (result as any).detectionMethod;
    if (detectionMethod === 'front-run' || detectionMethod === 'victim' || detectionMethod === 'back-run') {
      return {
        isSandwich: true,
        type: detectionMethod === 'front-run' ? 'front-run' : detectionMethod === 'back-run' ? 'back-run' : 'victim',
        confidence: 'high',
        details: `Sandwich attack detected via ${detectionMethod} analysis using enhanced detection algorithm`,
        sandwichData: {
          detectionMethod,
          blockPosition: blockData?.transactionIndex,
        },
      };
    }
  }

  // Check for sandwich pattern data from backend
  if (result.hasOwnProperty('sandwichPattern')) {
    const sandwichPattern = (result as any).sandwichPattern;
    const enhancedDetection = (result as any).enhancedDetection;
    
    if (sandwichPattern?.frontRun && sandwichPattern?.victim && sandwichPattern?.backRun) {
      // Determine transaction type based on enhanced detection
      let transactionType: 'victim' | 'attacker' | 'front-run' | 'back-run' = 'attacker';
      let details = `Complete sandwich attack pattern detected: Front-run → Victim → Back-run sequence identified`;
      
      if (enhancedDetection?.transactionRole) {
        transactionType = enhancedDetection.transactionRole;
        
        switch (enhancedDetection.transactionRole) {
          case 'front-run':
            details = `This is the FRONT-RUN transaction targeting victim ${sandwichPattern.victim.hash.slice(0, 10)}...`;
            break;
          case 'victim':
            details = `This is the VICTIM transaction being sandwiched by ${sandwichPattern.frontRun.hash.slice(0, 10)}...`;
            break;
          case 'back-run':
            details = `This is the BACK-RUN transaction completing the sandwich of victim ${sandwichPattern.victim.hash.slice(0, 10)}...`;
            break;
          default:
            details = `Sandwich attack participant in sequence: Front-run → Victim → Back-run`;
        }
      }
      
      return {
        isSandwich: true,
        type: transactionType,
        confidence: 'high',
        details,
        sandwichData: {
          frontRunTx: sandwichPattern.frontRun.hash,
          victimTx: sandwichPattern.victim.hash,
          backRunTx: sandwichPattern.backRun.hash,
          blockPosition: blockData?.transactionIndex,
          detectionMethod: enhancedDetection?.method || 'pattern-analysis',
          transactionRole: enhancedDetection?.transactionRole,
        },
      };
    }
  }

  // Comprehensive heuristic detection
  let suspiciousFactors = 0;
  let details = '';
  let _confidence: 'high' | 'medium' | 'low' = 'low';

  // 1. Check strategy patterns (most reliable indicator)
  const strategyText = strategy.toLowerCase();
  const sandwichKeywords = ['sandwich', 'front-run', 'back-run', 'mev', 'frontrun', 'backrun'];

  if (sandwichKeywords.some((keyword) => strategyText.includes(keyword))) {
    return {
      isSandwich: true,
      type: strategyText.includes('victim') ? 'victim' : 'attacker',
      confidence: 'high',
      details: 'Sandwich attack detected in transaction strategy',
    };
  }

  // 2. Check narrative for sandwich patterns (enhanced keywords)
  const narrativeText = (narrative || []).join(' ').toLowerCase();
  const narrativeKeywords = [
    'sandwich',
    'front-run',
    'back-run',
    'manipulated',
    'sandwiched',
    'mev',
    'victim',
    'attacker',
    'frontrun',
    'backrun',
    'price manipulation',
    'detected from',
    'detected via',
    'front-run transaction',
    'back-run transaction',
    'victim transaction',
    'sandwich pattern',
    'enhanced detection',
  ];

  if (narrativeKeywords.some((keyword) => narrativeText.includes(keyword))) {
    suspiciousFactors += 3;
    details += 'Sandwich attack patterns detected in transaction narrative. ';
    _confidence = 'high';

    // Determine type based on narrative content
    if (narrativeText.includes('front-run')) {
      return {
        isSandwich: true,
        type: 'front-run',
        confidence: 'high',
        details: 'Front-run transaction in sandwich attack detected',
      };
    } else if (narrativeText.includes('back-run')) {
      return {
        isSandwich: true,
        type: 'back-run',
        confidence: 'high',
        details: 'Back-run transaction in sandwich attack detected',
      };
    } else if (narrativeText.includes('victim')) {
      return {
        isSandwich: true,
        type: 'victim',
        confidence: 'high',
        details: 'Victim transaction in sandwich attack detected',
      };
    }
  }

  // 3. Check price impact patterns (lowered thresholds)
  if (priceImpactAnalysis) {
    const slippage = parseFloat(priceImpactAnalysis.victimSlippage || '0');
    if (slippage > 0.5) {
      // Even more sensitive detection
      suspiciousFactors += slippage > 3 ? 3 : slippage > 1 ? 2 : 1;
      details += `Suspicious slippage (${slippage}%) indicates potential sandwich victim. `;
      _confidence = slippage > 3 ? 'high' : slippage > 1 ? 'medium' : 'low';
    }

    if (
      priceImpactAnalysis.poolManipulation?.toLowerCase().includes('high') ||
      (typeof priceImpactAnalysis.poolManipulation === 'string' &&
        parseFloat(priceImpactAnalysis.poolManipulation.replace('%', '')) > 50)
    ) {
      suspiciousFactors += 2;
      details += 'High pool manipulation detected. ';
    }

    // Check for unusual price impact patterns
    if (priceImpactAnalysis.maxPriceImpact) {
      const impact = parseFloat(priceImpactAnalysis.maxPriceImpact.replace('%', '') || '0');
      if (impact > 1) {
        // Even more sensitive
        suspiciousFactors += impact > 5 ? 2 : 1;
        details += 'Significant price impact suggests MEV activity. ';
      }
    }
  }

  // 4. Check financial patterns (lowered thresholds)
  if (financials?.profit && financials?.cost) {
    const profit = parseFloat(financials.profit.split(' ')[0] || '0');
    const cost = parseFloat(financials.cost.split(' ')[0] || '0');
    const ratio = profit / cost;

    if (ratio > 5) {
      // Even more sensitive detection
      suspiciousFactors += ratio > 50 ? 3 : ratio > 20 ? 2 : 1;
      details += `High profit ratio (${ratio.toFixed(1)}x) suggests sandwich attack execution. `;
      _confidence = ratio > 50 ? 'high' : ratio > 20 ? 'medium' : 'low';
    }

    // Check for unusually profitable transactions
    if (profit > 0.05) {
      // Lower threshold
      suspiciousFactors += 1;
      details += 'Highly profitable transaction suggests MEV extraction. ';
    }
  }

  // 5. Check block position patterns (more aggressive)
  if (blockData) {
    const { transactionIndex, gasPrice } = blockData;

    if (transactionIndex !== undefined) {
      // Early positions (0-10) or specific patterns
      if (transactionIndex < 10) {
        suspiciousFactors += transactionIndex < 3 ? 2 : 1;
        details += 'Early block position suggests MEV activity. ';
      }
    }

    // High gas prices (MEV bots often pay premium gas)
    if (gasPrice) {
      const gasPriceNum = parseFloat(gasPrice);
      if (gasPriceNum > 30) {
        // Lower threshold for gas price
        suspiciousFactors += gasPriceNum > 100 ? 2 : 1;
        details += 'High gas price suggests MEV bot activity. ';
      }
    }
  }

  // 6. Check for MEV bot analysis indicators
  if (result.mevBotAnalysis) {
    const { confidence: botConfidence, txFrequency } = result.mevBotAnalysis;
    if (
      botConfidence.toLowerCase().includes('high') ||
      botConfidence.toLowerCase().includes('medium') ||
      txFrequency.includes('frequent') ||
      txFrequency.includes('high')
    ) {
      suspiciousFactors += 2;
      details += 'MEV bot behavior detected. ';
      _confidence = 'medium';
    }
  }

  // 7. Determine result based on comprehensive scoring (more sensitive)
  if (suspiciousFactors >= 3) {
    return {
      isSandwich: true,
      type: details.includes('victim') || details.includes('slippage') ? 'victim' : 'attacker',
      confidence: 'high',
      details: details.trim(),
    };
  } else if (suspiciousFactors >= 2) {
    return {
      isSandwich: true,
      type: details.includes('profit') || details.includes('execution') ? 'attacker' : 'victim',
      confidence: 'medium',
      details: details.trim(),
    };
  } else if (suspiciousFactors >= 1) {
    return {
      isSandwich: true,
      type: 'victim',
      confidence: 'low',
      details: details.trim() || 'Potential MEV/sandwich activity detected',
    };
  }

  return {
    isSandwich: false,
    type: 'none',
    confidence: 'low',
    details: 'No sandwich attack patterns detected',
  };
};

// Extract tokens from transaction data
const extractTokensFromTransaction = (
  result: TransactionAnalysisResult
): Array<{
  symbol: string;
  amount?: string;
  type: 'input' | 'output' | 'fee' | 'unknown';
}> => {
  const tokens: Set<string> = new Set();
  const tokenData: Array<{ symbol: string; amount?: string; type: 'input' | 'output' | 'fee' | 'unknown' }> = [];

  // Extract from financials
  if (result.financials) {
    if (result.financials.profit) {
      const match = result.financials.profit.match(/([0-9.]+)\s+([A-Z]{2,10})/);
      if (match) {
        tokenData.push({ symbol: match[2], amount: match[1], type: 'output' });
        tokens.add(match[2]);
      }
    }
    if (result.financials.cost) {
      const match = result.financials.cost.match(/([0-9.]+)\s+([A-Z]{2,10})/);
      if (match) {
        tokenData.push({ symbol: match[2], amount: match[1], type: 'fee' });
        tokens.add(match[2]);
      }
    }
    if (result.financials.netProfit) {
      const match = result.financials.netProfit.match(/([0-9.]+)\s+([A-Z]{2,10})/);
      if (match) {
        if (!tokens.has(match[2])) {
          tokenData.push({ symbol: match[2], amount: match[1], type: 'output' });
          tokens.add(match[2]);
        }
      }
    }
  }

  // Extract from narrative
  if (result.narrative) {
    result.narrative.forEach((step) => {
      // Common token patterns
      const tokenMatches = step.match(/([0-9,]+(?:\.[0-9]+)?)\s+([A-Z]{2,10})/g);
      if (tokenMatches) {
        tokenMatches.forEach((match) => {
          const parts = match.match(/([0-9,]+(?:\.[0-9]+)?)\s+([A-Z]{2,10})/);
          if (parts && !tokens.has(parts[2])) {
            const amount = parts[1].replace(/,/g, '');
            const type =
              step.toLowerCase().includes('receiv') || step.toLowerCase().includes('got')
                ? 'output'
                : step.toLowerCase().includes('spend') || step.toLowerCase().includes('paid')
                ? 'input'
                : 'unknown';
            tokenData.push({ symbol: parts[2], amount, type });
            tokens.add(parts[2]);
          }
        });
      }

      // Extract standalone token symbols
      const standaloneTokens = step.match(/\b([A-Z]{2,10})\b/g);
      if (standaloneTokens) {
        standaloneTokens.forEach((token) => {
          if (!tokens.has(token) && token !== 'ETH' && token !== 'USD' && token.length <= 10) {
            tokenData.push({ symbol: token, type: 'unknown' });
            tokens.add(token);
          }
        });
      }
    });
  }

  // Extract from price impact analysis
  if (result.priceImpactAnalysis?.tokenPair) {
    const pairTokens = result.priceImpactAnalysis.tokenPair.split(/[\/\-→>]/);
    pairTokens.forEach((token) => {
      const cleanToken = token.trim().toUpperCase();
      if (!tokens.has(cleanToken)) {
        tokenData.push({ symbol: cleanToken, type: 'unknown' });
        tokens.add(cleanToken);
      }
    });
  }

  // Always include ETH if not present (most transactions involve ETH)
  if (!tokens.has('ETH')) {
    tokenData.push({ symbol: 'ETH', type: 'fee' });
  }

  return tokenData;
};

// Result Card Component
const ResultCard = ({ result }: { result: TransactionAnalysisResult }) => {
  const hasUniswapV2 = detectUniswapV2(result.protocols || [], result.narrative || []);
  const sandwichDetection = detectSandwichAttack(result);
  const extractedTokens = extractTokensFromTransaction(result);
  const updatedProtocols =
    hasUniswapV2 && !result.protocols?.includes('Uniswap V2')
      ? [...(result.protocols || []), 'Uniswap V2']
      : result.protocols;

  // Enhanced glassmorphism styles
  const glassStyle = {
    backdropFilter: 'blur(32px) saturate(180%)',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  };

  const accentGlassStyle = (color: string) => ({
    backdropFilter: 'blur(24px) saturate(180%)',
    background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
    border: `1px solid ${color}25`,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  });

  return (
    <div className='w-full space-y-3'>
      {/* Enhanced Sandwich Detection Alert */}
      {sandwichDetection.isSandwich && (
        <div
          className='p-3 rounded-lg border'
          style={{
            ...accentGlassStyle(
              sandwichDetection.type === 'victim'
                ? 'rgba(239, 68, 68'
                : sandwichDetection.type === 'front-run'
                ? 'rgba(245, 158, 11'
                : sandwichDetection.type === 'back-run'
                ? 'rgba(168, 85, 247'
                : 'rgba(245, 158, 11'
            ),
            borderColor:
              sandwichDetection.confidence === 'high'
                ? sandwichDetection.type === 'victim'
                  ? 'rgba(239, 68, 68, 0.6)'
                  : sandwichDetection.type === 'front-run'
                  ? 'rgba(245, 158, 11, 0.6)'
                  : sandwichDetection.type === 'back-run'
                  ? 'rgba(168, 85, 247, 0.6)'
                  : 'rgba(245, 158, 11, 0.6)'
                : sandwichDetection.confidence === 'medium'
                ? sandwichDetection.type === 'victim'
                  ? 'rgba(239, 68, 68, 0.4)'
                  : sandwichDetection.type === 'front-run'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : sandwichDetection.type === 'back-run'
                  ? 'rgba(168, 85, 247, 0.4)'
                  : 'rgba(245, 158, 11, 0.4)'
                : sandwichDetection.type === 'victim'
                ? 'rgba(239, 68, 68, 0.2)'
                : sandwichDetection.type === 'front-run'
                ? 'rgba(245, 158, 11, 0.2)'
                : sandwichDetection.type === 'back-run'
                ? 'rgba(168, 85, 247, 0.2)'
                : 'rgba(245, 158, 11, 0.2)',
          }}
        >
          <div className='flex items-start justify-between mb-2'>
            <div className='flex items-start space-x-2'>
              <Shield
                className={`w-5 h-5 ${
                  sandwichDetection.type === 'victim'
                    ? 'text-red-400'
                    : sandwichDetection.type === 'front-run'
                    ? 'text-amber-400'
                    : sandwichDetection.type === 'back-run'
                    ? 'text-purple-400'
                    : 'text-amber-400'
                }`}
              />
              <div>
                <div className='flex items-center space-x-1 mb-1'>
                  <h4
                    className={`font-bold text-base ${
                      sandwichDetection.type === 'victim'
                        ? 'text-red-400'
                        : sandwichDetection.type === 'front-run'
                        ? 'text-amber-400'
                        : sandwichDetection.type === 'back-run'
                        ? 'text-purple-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {sandwichDetection.type === 'victim'
                      ? '🎯 Sandwich Attack Victim'
                      : sandwichDetection.type === 'front-run'
                      ? '⚡ Front-Run Transaction'
                      : sandwichDetection.type === 'back-run'
                      ? '🔄 Back-Run Transaction'
                      : '🚨 Sandwich Attack Detected'}
                  </h4>
                </div>
                <p className='text-gray-200 text-xs leading-relaxed mb-2'>{sandwichDetection.details}</p>

                {/* Enhanced sandwich data display */}
                {sandwichDetection.sandwichData && (
                  <div className='space-y-1'>
                    {sandwichDetection.sandwichData.detectionMethod && (
                      <div className='flex items-center space-x-2'>
                        <Search className='w-4 h-4 text-cyan-400' />
                        <span className='text-cyan-400 text-xs font-medium'>
                          Detection Method: {sandwichDetection.sandwichData.detectionMethod}
                        </span>
                      </div>
                    )}

                    {sandwichDetection.sandwichData.blockPosition !== undefined && (
                      <div className='flex items-center space-x-2'>
                        <Layers className='w-4 h-4 text-blue-400' />
                        <span className='text-blue-400 text-xs font-medium'>
                          Block Position: #{sandwichDetection.sandwichData.blockPosition}
                        </span>
                      </div>
                    )}

                    {(sandwichDetection.sandwichData.frontRunTx ||
                      sandwichDetection.sandwichData.victimTx ||
                      sandwichDetection.sandwichData.backRunTx) && (
                      <div
                        className='mt-2 p-2 rounded-md'
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <h5 className='text-gray-300 text-xs font-medium mb-1'>Related Transactions:</h5>
                        <div className='space-y-0.5'>
                          {sandwichDetection.sandwichData.frontRunTx && (
                            <div className='flex items-center space-x-2'>
                              <div className='w-2 h-2 bg-amber-400 rounded-full'></div>
                              <span className='text-amber-400 text-xs font-mono'>
                                Front-run: {sandwichDetection.sandwichData.frontRunTx.slice(0, 10)}...
                              </span>
                            </div>
                          )}
                          {sandwichDetection.sandwichData.victimTx && (
                            <div className='flex items-center space-x-2'>
                              <div className='w-2 h-2 bg-red-400 rounded-full'></div>
                              <span className='text-red-400 text-xs font-mono'>
                                Victim: {sandwichDetection.sandwichData.victimTx.slice(0, 10)}...
                              </span>
                            </div>
                          )}
                          {sandwichDetection.sandwichData.backRunTx && (
                            <div className='flex items-center space-x-2'>
                              <div className='w-2 h-2 bg-purple-400 rounded-full'></div>
                              <span className='text-purple-400 text-xs font-mono'>
                                Back-run: {sandwichDetection.sandwichData.backRunTx.slice(0, 10)}...
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div
              className={`px-2 py-1 rounded-md text-xs font-bold ${
                sandwichDetection.confidence === 'high'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : sandwichDetection.confidence === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}
            >
              {sandwichDetection.confidence.toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* Tokens Involved */}
      {extractedTokens.length > 0 && (
        <div className='space-y-2'>
          <h3 className='text-blue-400 font-medium text-sm flex items-center'>
            <Coins className='w-4 h-4 mr-1' />
            Tokens Involved
          </h3>
          <div className='flex flex-wrap gap-1'>
            {extractedTokens.map((token, index) => {
              const getTokenColor = (type: string) => {
                switch (type) {
                  case 'input':
                    return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: 'text-red-300' };
                  case 'output':
                    return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', text: 'text-green-300' };
                  case 'fee':
                    return {
                      bg: 'rgba(251, 146, 60, 0.12)',
                      border: 'rgba(251, 146, 60, 0.3)',
                      text: 'text-orange-300',
                    };
                  default:
                    return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: 'text-blue-300' };
                }
              };

              const colors = getTokenColor(token.type);

              return (
                <div
                  key={`${token.symbol}-${index}`}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 ${colors.text}`}
                  style={{
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <span className='font-mono'>{token.symbol}</span>
                  {token.amount && <span className='text-xs opacity-75'>{formatTokenAmount(token.amount)}</span>}
                  {token.type !== 'unknown' && <span className='text-xs opacity-60 capitalize'>{token.type}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy and Summary */}
      <div className='space-y-2'>
        <StrategyBadge strategy={result.strategy} confidence={result.confidence} />

        <div className='p-3 rounded-lg' style={glassStyle}>
          <p className='text-white text-sm leading-relaxed'>{result.summary}</p>
        </div>
      </div>

      {/* Transaction Flow */}
      {result.narrative && result.narrative.length > 0 && (
        <div className='p-4 rounded-lg' style={accentGlassStyle('rgba(6, 182, 212')}>
          <h3 className='text-cyan-400 font-semibold mb-3 flex items-center text-base'>
            <RefreshCw className='w-4 h-4 mr-2' />
            Transaction Flow
          </h3>
          <div className='space-y-2'>
            {result.narrative.map((step, index) => {
              // Enhanced step formatting
              let enhancedStep = step;
              if (step.includes('COMMS') && step.includes('525,363')) {
                enhancedStep = step.replace(/525,363\.[\d]+/, '525,363');
              }
              if (step.includes('WETH') && step.includes('0.278172271414083584')) {
                enhancedStep = enhancedStep.replace(/0\.278172271414083584/, '0.278');
              }
              if (step.includes('gas') && step.includes('0.000058860859719038')) {
                enhancedStep = enhancedStep.replace(/0\.000058860859719038/, '0.0000589');
              }

              return (
                <div
                  key={index}
                  className='flex items-start space-x-2 p-3 rounded-lg'
                  style={{
                    background: 'rgba(6, 182, 212, 0.08)',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div
                    className='w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0'
                    style={{
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(14, 165, 233, 0.5) 100%)',
                      border: '1px solid rgba(6, 182, 212, 0.4)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <span className='text-cyan-300 text-xs font-bold'>{index + 1}</span>
                  </div>
                  <p className='text-gray-200 text-xs leading-relaxed font-medium'>{enhancedStep}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Analysis */}
      {result.financials && (
        <div className='p-4 rounded-lg' style={accentGlassStyle('rgba(34, 197, 94')}>
          <h3 className='text-green-400 font-semibold mb-3 flex items-center text-base'>
            <DollarSign className='w-4 h-4 mr-2' />
            Financial Analysis
          </h3>
          <div className='grid grid-cols-2 gap-3'>
            {result.financials.profit && (
              <div
                className='space-y-2 p-3 rounded-lg'
                style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <Coins className='w-3 h-3 text-green-300' />
                  <span className='text-green-300 text-xs font-medium'>Profit</span>
                </div>
                <p className='text-green-400 font-bold text-sm'>
                  {result.financials.profit.includes('WETH')
                    ? `${formatTokenAmount(result.financials.profit.split(' ')[0])} WETH`
                    : result.financials.profit}
                </p>
              </div>
            )}
            {result.financials.cost && (
              <div
                className='space-y-2 p-3 rounded-lg'
                style={{
                  background: 'rgba(251, 146, 60, 0.12)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <Fuel className='w-3 h-3 text-orange-300' />
                  <span className='text-orange-300 text-xs font-medium'>Gas Cost</span>
                </div>
                <p className='text-orange-400 font-bold text-sm'>
                  {result.financials.cost.includes('ETH')
                    ? `${formatCurrency(result.financials.cost.split(' ')[0])} ETH`
                    : result.financials.cost}
                </p>
              </div>
            )}
            {result.financials.netProfit && (
              <div
                className='space-y-2 p-3 rounded-lg col-span-2'
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <Target className='w-3 h-3 text-emerald-300' />
                  <span className='text-emerald-300 text-xs font-medium'>Net Profit</span>
                </div>
                <p className='text-emerald-400 font-bold text-base'>
                  {result.financials.netProfit.includes('ETH')
                    ? `${formatTokenAmount(result.financials.netProfit.split(' ')[0])} ETH equivalent`
                    : result.financials.netProfit}
                </p>
              </div>
            )}
            {result.financials.roi && (
              <div
                className='space-y-2 p-3 rounded-lg'
                style={{
                  background: 'rgba(6, 182, 212, 0.12)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <TrendingUp className='w-3 h-3 text-cyan-300' />
                  <span className='text-cyan-300 text-xs font-medium'>ROI</span>
                </div>
                <p className='text-cyan-400 font-bold text-sm'>{result.financials.roi}</p>
              </div>
            )}
            {result.strategy.toLowerCase().includes('arbitrage') && (
              <div
                className='space-y-2 p-3 rounded-lg'
                style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <ArrowUpDown className='w-3 h-3 text-blue-300' />
                  <span className='text-blue-300 text-xs font-medium'>Market Impact</span>
                </div>
                <p className='text-blue-400 font-medium'>Pure Efficiency Capture</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Protocols */}
      {updatedProtocols && updatedProtocols.length > 0 && (
        <div className='space-y-2'>
          <h3 className='text-purple-400 font-medium text-sm flex items-center'>
            <Link className='w-4 h-4 mr-1' />
            Protocols Involved
          </h3>
          <div className='flex flex-wrap gap-2'>
            {updatedProtocols.map((protocol, index) => {
              const isUniswap = protocol.toLowerCase().includes('uniswap');
              return (
                <span
                  key={index}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1 ${
                    isUniswap ? 'text-pink-300' : 'text-purple-300'
                  }`}
                  style={{
                    background: isUniswap
                      ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(219, 39, 119, 0.1) 100%)'
                      : 'rgba(147, 51, 234, 0.12)',
                    border: `1px solid ${isUniswap ? 'rgba(236, 72, 153, 0.3)' : 'rgba(147, 51, 234, 0.3)'}`,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {isUniswap ? <Zap className='w-4 h-4' /> : <Activity className='w-4 h-4' />}
                  <span>{protocol}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Sandwich Analysis */}
      {result.sandwichAnalysis && (
        <div className='p-4 rounded-lg' style={accentGlassStyle('rgba(239, 68, 68')}>
          <h3 className='text-red-400 font-semibold mb-3 flex items-center text-base'>
            <Shield className='w-4 h-4 mr-2' />
            Sandwich Attack Analysis
          </h3>
          <div className='grid grid-cols-2 gap-3'>
            <div
              className='space-y-1 p-3 rounded-lg'
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <div className='flex items-center space-x-1'>
                <Clock className='w-3 h-3 text-red-300' />
                <span className='text-red-300 text-xs font-medium'>Block Position</span>
              </div>
              <p className='text-red-400 font-medium text-sm'>
                {result.sandwichAnalysis.blockPosition} of {result.sandwichAnalysis.totalBlockTxs}
              </p>
            </div>

            {result.sandwichAnalysis.frontRunTx && (
              <div
                className='space-y-1 p-3 rounded-lg'
                style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <Search className='w-3 h-3 text-amber-300' />
                  <span className='text-amber-300 text-xs font-medium'>Front-run Detected</span>
                </div>
                <p className='text-amber-400 font-mono text-xs'>{result.sandwichAnalysis.frontRunTx.slice(0, 10)}...</p>
              </div>
            )}

            {result.sandwichAnalysis.victimSlippage && (
              <div
                className='space-y-1 p-3 rounded-lg col-span-2'
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className='flex items-center space-x-1'>
                  <TrendingDown className='w-3 h-3 text-red-300' />
                  <span className='text-red-300 text-xs font-medium'>Victim Slippage</span>
                </div>
                <p className='text-red-400 font-bold text-sm'>{result.sandwichAnalysis.victimSlippage}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEV Bot Analysis */}
      {result.mevBotAnalysis && (
        <div
          className='p-3 rounded-lg'
          style={{
            background: 'rgba(255, 0, 0, 0.05)',
            border: '1px solid rgba(255, 0, 0, 0.2)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h3 className='text-red-400 font-medium mb-2 flex items-center'>
            <AlertTriangle className='w-4 h-4 mr-1' />
            MEV Bot Analysis
          </h3>
          <div className='grid grid-cols-3 gap-2 text-xs'>
            <div className='space-y-1'>
              <span className='text-gray-400'>Confidence</span>
              <p className='text-red-400 font-medium'>{result.mevBotAnalysis.confidence}</p>
            </div>
            <div className='space-y-1'>
              <span className='text-gray-400'>Frequency</span>
              <p className='text-white'>{result.mevBotAnalysis.txFrequency}</p>
            </div>
            <div className='space-y-1'>
              <span className='text-gray-400'>Avg Gas Price</span>
              <p className='text-white'>{result.mevBotAnalysis.avgGasPrice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Price Impact Analysis */}
      {result.priceImpactAnalysis && (
        <div
          className='p-3 rounded-lg'
          style={{
            background: 'rgba(255, 255, 0, 0.05)',
            border: '1px solid rgba(255, 255, 0, 0.2)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <h3 className='text-yellow-400 font-medium mb-2 flex items-center'>
            <TrendingUp className='w-4 h-4 mr-1' />
            Price Impact Analysis
          </h3>
          <div className='grid grid-cols-2 gap-2 text-xs'>
            <div className='space-y-1'>
              <span className='text-gray-400'>Token Pair</span>
              <p className='text-white font-medium'>{result.priceImpactAnalysis.tokenPair}</p>
            </div>
            <div className='space-y-1'>
              <span className='text-gray-400'>Victim Slippage</span>
              <p className='text-yellow-400 font-medium'>{result.priceImpactAnalysis.victimSlippage}</p>
            </div>
            <div className='space-y-1'>
              <span className='text-gray-400'>Pool Manipulation</span>
              <p className='text-red-400 font-medium'>{result.priceImpactAnalysis.poolManipulation}</p>
            </div>
            {result.priceImpactAnalysis.maxPriceImpact && (
              <div className='space-y-1'>
                <span className='text-gray-400'>Max Price Impact</span>
                <p className='text-orange-400 font-medium'>{result.priceImpactAnalysis.maxPriceImpact}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export function AnalyzerCard({ inputValue, onInputChange, onAnalyze, loading, result }: AnalyzerCardProps) {
  const [activeView, setActiveView] = useState<'transaction' | 'wallet' | 'portfolio'>('transaction');
  const [portfolioData, setPortfolioData] = useState<PortfolioData[] | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // Transaction analysis state
  const [analysisResult, setAnalysisResult] = useState<TransactionAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Function to detect if input is a wallet address (basic validation)
  const isWalletAddress = (input: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
  };

  // Function to fetch portfolio data
  const fetchPortfolioData = async (address: string) => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      const data = await getHistoricalPortfolioValue(address, 1); // Default to Ethereum mainnet
      setPortfolioData(data);
      setActiveView('portfolio');
    } catch (error) {
      setPortfolioError(error instanceof Error ? error.message : 'Failed to fetch portfolio data');
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Function to perform transaction analysis via API route
  const performTransactionAnalysis = async (txHash: string) => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      // Call the API route for server-side analysis
      const response = await fetch('/api/analyze-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chainId: 1, // Use Ethereum mainnet as default
          txHash: txHash,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setAnalysisResult(result);
      setActiveView('transaction');
    } catch (error) {
      console.error('Transaction analysis failed:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Transaction analysis failed');
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Enhanced analyze function that handles both wallet addresses and transaction hashes
  const handleAnalyze = async (value: string, type: 'address' | 'transaction') => {
    const trimmedValue = value.trim();

    // Reset previous analysis results
    setAnalysisResult(null);
    setAnalysisError(null);

    // Determine if input is a transaction hash or wallet address
    if (isValidTransactionHash(trimmedValue)) {
      // It's a transaction hash - perform transaction analysis
      await performTransactionAnalysis(trimmedValue);
    } else if (isWalletAddress(trimmedValue)) {
      // It's a wallet address - fetch portfolio data and call original analyze
      onAnalyze(trimmedValue, 'address');
      await fetchPortfolioData(trimmedValue);
    } else {
      // Invalid input
      onAnalyze(trimmedValue, type);
      setAnalysisError('Please enter a valid transaction hash (0x...) or wallet address');
    }
  };
  return (
    <div
      className='max-w-7xl rounded-3xl structural-illuminated-frame mx-auto'
      style={{
        backdropFilter: 'blur(40px) saturate(200%)',
        background: 'linear-gradient(135deg, rgba(12, 9, 26, 0.8) 0%, rgba(17, 24, 39, 0.7) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className='relative z-10'>
        <div className='h-12 px-6 border-b border-white/10 flex items-center'>
          <div className='flex items-center space-x-2'>
            <div className='w-3 h-3 bg-red-500 rounded-full'></div>
            <div className='w-3 h-3 bg-yellow-500 rounded-full'></div>
            <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          </div>
        </div>
        <div className='flex' style={{ height: '1200px' }}>
          <div className='w-64 border-r border-white/10 p-4 space-y-2 flex flex-col'>
            <SidebarItem
              icon={Hash}
              label='Transaction Analysis'
              active={activeView === 'transaction'}
              onClick={() => setActiveView('transaction')}
            />
            <SidebarItem
              icon={Wallet}
              label='Wallet Analysis'
              active={activeView === 'wallet'}
              onClick={() => setActiveView('wallet')}
            />
            <SidebarItem
              icon={BarChart3}
              label='Portfolio Chart'
              active={activeView === 'portfolio'}
              onClick={() => setActiveView('portfolio')}
            />
            <SidebarItem icon={History} label='History' />
            <div className='flex-grow' />
            <SidebarItem icon={Settings} label='Settings' />
          </div>
          <div className='flex-1 p-4 flex flex-col justify-start'>
            <TransactionInput
              value={inputValue}
              onChange={onInputChange}
              onSubmit={handleAnalyze}
              loading={analysisLoading || loading}
            />
            <div className='flex-grow flex items-center justify-center text-center px-4 overflow-y-hidden'>
              {activeView === 'transaction' && (analysisResult || analysisError || analysisLoading) ? (
                <div className='w-full h-full flex flex-col'>
                  {analysisLoading ? (
                    <div className='flex flex-col items-center justify-center space-y-3 h-full'>
                      <Loader2 className='w-7 h-7 animate-spin text-violet-300' />
                      <span className='text-sm text-gray-400 tracking-wide'>Analyzing transaction...</span>
                      <span className='text-xs text-gray-500'>This may take a moment</span>
                    </div>
                  ) : analysisError ? (
                    <div className='flex flex-col items-center justify-center space-y-3 h-full'>
                      <AlertTriangle className='w-8 h-8 text-red-400' />
                      <span className='text-red-400 font-medium'>Analysis Failed</span>
                      <span className='text-sm text-gray-500 max-w-md text-center'>{analysisError}</span>
                    </div>
                  ) : analysisResult ? (
                    <div className='w-full h-full overflow-y-hidden'>
                      <ResultCard result={analysisResult} />
                    </div>
                  ) : null}
                </div>
              ) : activeView === 'portfolio' ? (
                <div className='w-full h-full flex flex-col'>
                  {portfolioLoading ? (
                    <div className='flex flex-col items-center justify-center space-y-3 h-full'>
                      <Loader2 className='w-7 h-7 animate-spin text-violet-300' />
                      <span className='text-sm text-gray-400 tracking-wide'>Loading portfolio data...</span>
                    </div>
                  ) : portfolioError ? (
                    <div className='flex flex-col items-center justify-center space-y-3 h-full'>
                      <span className='text-red-400'>Failed to load portfolio data</span>
                      <span className='text-sm text-gray-500'>{portfolioError}</span>
                    </div>
                  ) : portfolioData && portfolioData.length > 0 ? (
                    <div className='w-full h-full'>
                      <PortfolioChart data={portfolioData} />
                    </div>
                  ) : (
                    <div className='flex flex-col items-center justify-center space-y-3 h-full'>
                      <span className='text-gray-400'>No portfolio data available</span>
                      <span className='text-sm text-gray-500'>Enter a wallet address to view portfolio history</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {loading ? (
                    <div className='flex flex-col items-center space-y-3'>
                      <Loader2 className='w-7 h-7 animate-spin text-violet-300' />
                      <span className='text-sm text-gray-400 tracking-wide'>Analyzing...</span>
                    </div>
                  ) : result ? (
                    <div
                      className='flex flex-col items-center space-y-2 p-6 rounded-2xl'
                      style={{
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        backdropFilter: 'blur(10px)',
                      }}
                    >
                      <span className='text-emerald-400 font-medium text-lg'>✓ {result}</span>
                    </div>
                  ) : (
                    <div className='max-w-md'>
                      <span className='text-gray-400 text-base leading-relaxed'>
                        {activeView === 'transaction'
                          ? 'Enter a transaction hash (0x...) to analyze MEV activity, sandwich attacks, and arbitrage opportunities.'
                          : 'Enter a transaction hash or wallet address to begin deep analysis.'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
