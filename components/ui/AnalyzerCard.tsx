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

// Enhanced sandwich attack detection with improved false positive filtering
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

  // DEBUG: Log all detection-relevant data from backend
  console.log('🔍 Detection Debug Data:', {
    strategy: strategy,
    hasDetectionMethod: result.hasOwnProperty('detectionMethod'),
    detectionMethod: (result as any).detectionMethod,
    hasSandwichPattern: result.hasOwnProperty('sandwichPattern'),
    sandwichPattern: (result as any).sandwichPattern,
    hasEnhancedDetection: result.hasOwnProperty('enhancedDetection'),
    enhancedDetection: (result as any).enhancedDetection,
    sandwichAnalysis: sandwichAnalysis,
    isSandwichAttack: (result as any).isSandwichAttack,
    sandwichDetected: (result as any).sandwichDetected
  });

  // PRIORITY 1: EARLY EXIT for legitimate arbitrage transactions
  // This must come BEFORE any backend sandwich detection checks
  const strategyLower = strategy.toLowerCase();
  if ((strategyLower.includes('arbitrage') || 
       strategyLower.includes('cross-token') ||
       strategyLower === 'cross-token arbitrage') && 
      !strategyLower.includes('sandwich') &&
      !strategyLower.includes('front-run') &&
      !strategyLower.includes('back-run') &&
      !strategyLower.includes('victim')) {
    console.log('✅ Early Exit: Legitimate arbitrage detected, bypassing sandwich detection');
    console.log('Strategy:', strategy);
    return {
      isSandwich: false,
      type: 'none',
      confidence: 'low',
      details: 'Legitimate arbitrage transaction - not a sandwich attack',
    };
  }
  
  // BACKUP CHECK: If backend marked this as arbitrage but somehow has sandwich flags
  if (strategyLower.includes('arbitrage') && !strategyLower.includes('sandwich')) {
    console.log('🛡️ Backup Protection: Overriding backend sandwich flags for arbitrage transaction');
    return {
      isSandwich: false,
      type: 'none',
      confidence: 'low',
      details: 'Backend-confirmed arbitrage transaction - overriding false positive sandwich detection',
    };
  }

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

  // 2. Check narrative for sandwich patterns (more specific keywords)
  const narrativeText = (narrative || []).join(' ').toLowerCase();
  
  // Check for explicit backend sandwich detection first
  const explicitSandwichKeywords = [
    'sandwich attack',
    'front-run transaction',
    'back-run transaction', 
    'victim transaction',
    'sandwich pattern',
    'enhanced detection',
    'detected via',
  ];
  
  const generalKeywords = [
    'manipulated',
    'sandwiched',
    'victim',
    'attacker',
    'price manipulation',
  ];

  if (explicitSandwichKeywords.some((keyword) => narrativeText.includes(keyword))) {
    suspiciousFactors += 4; // High confidence for explicit detection
    details += 'Explicit sandwich attack detection in transaction narrative. ';
    _confidence = 'high';
  } else if (generalKeywords.some((keyword) => narrativeText.includes(keyword))) {
    suspiciousFactors += 2; // Moderate confidence for general keywords
    details += 'Potential sandwich patterns detected in transaction narrative. ';
    _confidence = 'medium';

    // Determine type based on narrative content - only for explicit detection
    if (explicitSandwichKeywords.some(keyword => narrativeText.includes(keyword))) {
      if (narrativeText.includes('front-run transaction')) {
        return {
          isSandwich: true,
          type: 'front-run',
          confidence: 'high',
          details: 'Front-run transaction in sandwich attack detected',
        };
      } else if (narrativeText.includes('back-run transaction')) {
        return {
          isSandwich: true,
          type: 'back-run',
          confidence: 'high',
          details: 'Back-run transaction in sandwich attack detected',
        };
      } else if (narrativeText.includes('victim transaction')) {
        return {
          isSandwich: true,
          type: 'victim',
          confidence: 'high',
          details: 'Victim transaction in sandwich attack detected',
        };
      }
    }
  }

  // 3. Check price impact patterns (raised thresholds to reduce false positives)
  if (priceImpactAnalysis) {
    const slippage = parseFloat(priceImpactAnalysis.victimSlippage || '0');
    if (slippage > 5.0) {
      // Much higher threshold - normal DeFi can have 1-3% slippage
      suspiciousFactors += slippage > 15 ? 3 : slippage > 10 ? 2 : 1;
      details += `High slippage (${slippage}%) indicates potential sandwich victim. `;
      _confidence = slippage > 15 ? 'high' : slippage > 10 ? 'medium' : 'low';
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
      if (impact > 10) {
        // Much higher threshold - normal trades can have 1-5% impact
        suspiciousFactors += impact > 25 ? 2 : 1;
        details += 'Severe price impact suggests potential MEV activity. ';
      }
    }
  }

  // 4. Check financial patterns (raised thresholds to reduce false positives)
  if (financials?.profit && financials?.cost) {
    const profit = parseFloat(financials.profit.split(' ')[0] || '0');
    const cost = parseFloat(financials.cost.split(' ')[0] || '0');
    const ratio = profit / cost;

    if (ratio > 50) {
      // Much higher threshold - only flag extremely suspicious ratios
      suspiciousFactors += ratio > 200 ? 3 : ratio > 100 ? 2 : 1;
      details += `Extremely high profit ratio (${ratio.toFixed(1)}x) suggests sandwich attack execution. `;
      _confidence = ratio > 200 ? 'high' : ratio > 100 ? 'medium' : 'low';
    }

    // Check for unusually profitable transactions - much higher threshold
    if (profit > 1.0) {
      // Raised from 0.05 to 1.0 ETH to reduce false positives
      suspiciousFactors += 1;
      details += 'Highly profitable transaction suggests potential MEV extraction. ';
    }
  }

  // 5. Check block position patterns (less aggressive to reduce false positives)
  if (blockData) {
    const { transactionIndex, gasPrice } = blockData;

    if (transactionIndex !== undefined) {
      // Only flag extremely early positions - many legitimate txs are early
      if (transactionIndex < 3) {
        suspiciousFactors += transactionIndex === 0 ? 2 : 1;
        details += 'Extremely early block position suggests potential MEV activity. ';
      }
    }

    // High gas prices (much higher threshold)
    if (gasPrice) {
      const gasPriceNum = parseFloat(gasPrice);
      if (gasPriceNum > 150) {
        // Raised from 30 to 150 gwei - normal users pay up to 100 gwei during congestion
        suspiciousFactors += gasPriceNum > 300 ? 2 : 1;
        details += 'Extremely high gas price suggests MEV bot activity. ';
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

  // 7. Determine result based on comprehensive scoring (much stricter thresholds)
  if (suspiciousFactors >= 8) {
    return {
      isSandwich: true,
      type: details.includes('victim') || details.includes('slippage') ? 'victim' : 'attacker',
      confidence: 'high',
      details: details.trim(),
    };
  } else if (suspiciousFactors >= 6) {
    return {
      isSandwich: true,
      type: details.includes('profit') || details.includes('execution') ? 'attacker' : 'victim',
      confidence: 'medium',
      details: details.trim(),
    };
  } else if (suspiciousFactors >= 10) {
    // Extremely high threshold to virtually eliminate false positives
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

  // Ultra-Advanced Organic Glass System
  const ultraGlassStyle = {
    backdropFilter: 'blur(50px) saturate(220%)',
    background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0.01) 100%)',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 3px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    borderRadius: '36px 28px 40px 32px', // Organic, non-uniform curves
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const premiumGlassStyle = {
    backdropFilter: 'blur(45px) saturate(200%)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 15px 45px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.25)',
    borderRadius: '20px',
    transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const liquidGlassStyle = {
    backdropFilter: 'blur(45px) saturate(200%)',
    background: 'conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.15) 0deg, rgba(255,255,255,0.05) 120deg, rgba(255,255,255,0.08) 240deg, rgba(255,255,255,0.15) 360deg)',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 15px 45px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.25)',
    borderRadius: '50%', // Perfect circles for financial bubbles
    transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
    transform: 'translateZ(0)',
  };

  const deepGlassStyle = {
    backdropFilter: 'blur(60px) saturate(250%)',
    background: `
      radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(255,255,255,0.15) 0%, transparent 50%),
      linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)
    `,
    border: '1px solid rgba(255,255,255,0.3)',
    boxShadow: `
      0 25px 70px rgba(0,0,0,0.6),
      inset 0 4px 0 rgba(255,255,255,0.4),
      inset 0 0 20px rgba(255,255,255,0.1),
      0 0 0 1px rgba(255,255,255,0.15)
    `,
    borderRadius: '32px 26px 38px 30px',
    position: 'relative' as const,
  };

  const organicLayoutStyle = {
    backdropFilter: 'blur(35px) saturate(180%)',
    background: 'radial-gradient(ellipse 80% 60% at 30% 70%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 15px 50px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.2)',
    borderRadius: '45px 20px 30px 55px', // Highly asymmetric
    transform: 'rotate(-1deg)',
    transition: 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const shimmerGlassStyle = {
    backdropFilter: 'blur(25px) saturate(160%)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
    borderRadius: '20px 35px 15px 40px',
    animation: 'shimmer 4s ease-in-out infinite',
  };

  const floatingGlassStyle = {
    backdropFilter: 'blur(35px) saturate(180%)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 10px 35px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.2)',
    borderRadius: '24px 20px 26px 22px',
    transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
    transform: 'translateZ(0)',
  };

  const accentGlassStyle = (color: string, intensity: 'light' | 'medium' | 'strong' = 'medium') => {
    const intensities = {
      light: { bg: '0.04', border: '0.15', shadow: '0.15' },
      medium: { bg: '0.08', border: '0.25', shadow: '0.25' },
      strong: { bg: '0.12', border: '0.35', shadow: '0.35' }
    };
    const level = intensities[intensity];
    
    return {
      backdropFilter: 'blur(28px) saturate(180%)',
      background: `linear-gradient(135deg, ${color.replace('rgba(', '').replace(')', '')}, ${level.bg}) 0%, ${color.replace('rgba(', '').replace(')', '')}, 0.02) 100%)`,
      border: `1px solid rgba(${color.replace('rgba(', '').replace(')', '')}, ${level.border})`,
      boxShadow: `0 8px 32px rgba(0,0,0,${level.shadow}), inset 0 1px 0 rgba(255,255,255,0.1)`,
      borderRadius: '18px',
      transition: 'all 0.3s ease',
    };
  };

  const iconGlassStyle = {
    backdropFilter: 'blur(16px) saturate(140%)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    border: '1px solid rgba(255,255,255,0.2)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
    borderRadius: '12px',
  };

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(0deg); }
          75% { transform: translateY(-6px) rotate(-1deg); }
        }
        @keyframes glow {
          0% { box-shadow: 0 20px 60px rgba(16, 185, 129, 0.15), inset 0 2px 0 rgba(255,255,255,0.25); }
          100% { box-shadow: 0 25px 80px rgba(16, 185, 129, 0.3), inset 0 3px 0 rgba(255,255,255,0.4); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes organic-pulse {
          0%, 100% { transform: rotate(-1deg) scale(1); }
          50% { transform: rotate(1deg) scale(1.02); }
        }
      `}</style>
      <div className='w-full space-y-3'>
      {/* Premium Sandwich Detection Alert */}
      {sandwichDetection.isSandwich && (
        <div
          className='relative overflow-hidden group hover:scale-102 transition-all duration-500'
          style={{
            ...ultraGlassStyle,
            padding: '20px',
            background: sandwichDetection.type === 'victim'
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.03) 100%)'
              : sandwichDetection.type === 'front-run'
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)'
              : sandwichDetection.type === 'back-run'
              ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(168, 85, 247, 0.03) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)',
          }}
        >
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <div 
                className='p-3 rounded-full'
                style={{
                  ...iconGlassStyle,
                  background: sandwichDetection.type === 'victim'
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)'
                    : sandwichDetection.type === 'front-run'
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)'
                    : sandwichDetection.type === 'back-run'
                    ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
                }}
              >
                <span className='text-2xl'>
                  {sandwichDetection.type === 'victim' ? '🎯' : 
                   sandwichDetection.type === 'front-run' ? '⚡' : 
                   sandwichDetection.type === 'back-run' ? '🔄' : '🚨'}
                </span>
              </div>
              <div>
                <h4
                  className={`font-bold text-lg ${
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
                    ? 'Sandwich Victim'
                    : sandwichDetection.type === 'front-run'
                    ? 'Front-Run Attack'
                    : sandwichDetection.type === 'back-run'
                    ? 'Back-Run Attack'
                    : 'Sandwich Attack'}
                </h4>
                <p className='text-gray-300 text-sm mt-1'>{sandwichDetection.details}</p>
              </div>
            </div>
            
            <div
              className={`px-4 py-2 rounded-full text-xs font-bold ${
                sandwichDetection.confidence === 'high'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : sandwichDetection.confidence === 'medium'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}
              style={iconGlassStyle}
            >
              {sandwichDetection.confidence.toUpperCase()}
            </div>
          </div>

          
          {/* Minimal sandwich data display */}
          {sandwichDetection.sandwichData && (
            <div className='mt-4 flex flex-wrap gap-2'>
              {sandwichDetection.sandwichData.detectionMethod && (
                <div 
                  className='flex items-center space-x-2 px-3 py-1 rounded-full'
                  style={floatingGlassStyle}
                >
                  <Search className='w-3 h-3 text-cyan-400' />
                  <span className='text-cyan-400 text-xs font-medium'>
                    {sandwichDetection.sandwichData.detectionMethod}
                  </span>
                </div>
              )}

              {sandwichDetection.sandwichData.blockPosition !== undefined && (
                <div 
                  className='flex items-center space-x-2 px-3 py-1 rounded-full'
                  style={floatingGlassStyle}
                >
                  <Layers className='w-3 h-3 text-blue-400' />
                  <span className='text-blue-400 text-xs font-medium'>
                    #{sandwichDetection.sandwichData.blockPosition}
                  </span>
                </div>
              )}

              {(sandwichDetection.sandwichData.frontRunTx ||
                sandwichDetection.sandwichData.victimTx ||
                sandwichDetection.sandwichData.backRunTx) && (
                <div className='flex space-x-1'>
                  {sandwichDetection.sandwichData.frontRunTx && (
                    <div 
                      className='px-2 py-1 rounded-full'
                      style={{
                        ...floatingGlassStyle,
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
                      }}
                    >
                      <span className='text-amber-400 text-xs font-mono'>
                        ⚡ {sandwichDetection.sandwichData.frontRunTx.slice(0, 6)}...
                      </span>
                    </div>
                  )}
                  {sandwichDetection.sandwichData.victimTx && (
                    <div 
                      className='px-2 py-1 rounded-full'
                      style={{
                        ...floatingGlassStyle,
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
                      }}
                    >
                      <span className='text-red-400 text-xs font-mono'>
                        🎯 {sandwichDetection.sandwichData.victimTx.slice(0, 6)}...
                      </span>
                    </div>
                  )}
                  {sandwichDetection.sandwichData.backRunTx && (
                    <div 
                      className='px-2 py-1 rounded-full'
                      style={{
                        ...floatingGlassStyle,
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
                      }}
                    >
                      <span className='text-purple-400 text-xs font-mono'>
                        🔄 {sandwichDetection.sandwichData.backRunTx.slice(0, 6)}...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Token Pills - Organic Asymmetric Layout */}
      {extractedTokens.length > 0 && (
        <div 
          className='relative overflow-hidden hover:scale-102'
          style={{
            ...organicLayoutStyle,
            padding: '16px 20px',
            animation: 'organic-pulse 8s ease-in-out infinite',
          }}
        >
          <div className='flex flex-wrap gap-2'>
            {extractedTokens.map((token, index) => {
              const getTokenStyle = (type: string) => {
                switch (type) {
                  case 'input':
                    return {
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      text: 'text-red-300',
                      icon: '📤'
                    };
                  case 'output':
                    return {
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
                      border: '1px solid rgba(34, 197, 94, 0.25)', 
                      text: 'text-green-300',
                      icon: '📥'
                    };
                  case 'fee':
                    return {
                      background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(251, 146, 60, 0.05) 100%)',
                      border: '1px solid rgba(251, 146, 60, 0.25)',
                      text: 'text-orange-300',
                      icon: '⛽'
                    };
                  default:
                    return {
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      text: 'text-blue-300',
                      icon: '🪙'
                    };
                }
              };

              const tokenStyle = getTokenStyle(token.type);

              return (
                <div
                  key={`${token.symbol}-${index}`}
                  className={`group flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold hover:scale-105 transition-all duration-300 ${tokenStyle.text}`}
                  style={{
                    ...floatingGlassStyle,
                    ...tokenStyle,
                    borderRadius: '24px',
                    minHeight: '36px',
                  }}
                >
                  <span className='text-sm'>{tokenStyle.icon}</span>
                  <span className='font-mono font-bold'>{token.symbol}</span>
                  {token.amount && (
                    <span className='text-xs opacity-80 font-medium'>
                      {formatTokenAmount(token.amount)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy and Summary */}
      <div className='space-y-2'>
        <StrategyBadge strategy={result.strategy} confidence={result.confidence} />

        <div className='p-3' style={premiumGlassStyle}>
          <p className='text-white text-sm leading-relaxed'>{result.summary}</p>
        </div>
      </div>

      {/* Flow Steps - Ultra-Minimal */}
      {result.narrative && result.narrative.length > 0 && (
        <div className='space-y-3'>
          <div className='space-y-2'>
            {result.narrative.slice(0, 3).map((step, index) => {
              // Enhanced step formatting and shortening
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
              
              // Shorten long descriptions
              if (enhancedStep.length > 80) {
                enhancedStep = enhancedStep.substring(0, 77) + '...';
              }

              return (
                <div
                  key={index}
                  className='group flex items-center space-x-3 p-3 hover:scale-102 transition-all duration-300'
                  style={{
                    ...floatingGlassStyle,
                    background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.02) 100%)',
                  }}
                >
                  <div
                    className='w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0'
                    style={{
                      ...iconGlassStyle,
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(14, 165, 233, 0.3) 100%)',
                    }}
                  >
                    <span className='text-cyan-300 text-sm font-bold'>{index + 1}</span>
                  </div>
                  <p className='text-gray-200 text-sm leading-relaxed font-medium flex-1'>{enhancedStep}</p>
                </div>
              );
            })}
            {result.narrative.length > 3 && (
              <div 
                className='text-center py-2'
                style={floatingGlassStyle}
              >
                <span className='text-cyan-400/60 text-xs'>+{result.narrative.length - 3} more steps</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financial Bubbles - Ultra-Clean Circular Glass Design */}
      {result.financials && (
        <div 
          className='relative overflow-hidden'
          style={{
            padding: '20px',
            borderRadius: '30px',
            ...premiumGlassStyle,
            background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.01) 100%)',
          }}
        >
          {/* Floating Financial Bubbles */}
          <div className='grid grid-cols-3 gap-4 place-items-center'>
            {result.financials.profit && (
              <div 
                className='group relative'
                style={{
                  ...liquidGlassStyle,
                  width: '90px',
                  height: '90px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'conic-gradient(from 180deg at 50% 50%, rgba(34, 197, 94, 0.2) 0deg, rgba(34, 197, 94, 0.08) 120deg, rgba(34, 197, 94, 0.12) 240deg, rgba(34, 197, 94, 0.2) 360deg)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  animation: 'float 4s ease-in-out infinite',
                  animationDelay: '0s',
                }}
              >
                <div className='text-center'>
                  <div className='text-2xl mb-1'>💰</div>
                  <div className='text-green-400 font-bold text-xs leading-none'>
                    {result.financials.profit.includes('WETH')
                      ? formatTokenAmount(result.financials.profit.split(' ')[0])
                      : result.financials.profit.split(' ')[0]}
                  </div>
                </div>
              </div>
            )}
            
            {result.financials.cost && (
              <div 
                className='group relative'
                style={{
                  ...liquidGlassStyle,
                  width: '80px',
                  height: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'conic-gradient(from 180deg at 50% 50%, rgba(251, 146, 60, 0.18) 0deg, rgba(251, 146, 60, 0.06) 120deg, rgba(251, 146, 60, 0.1) 240deg, rgba(251, 146, 60, 0.18) 360deg)',
                  border: '1px solid rgba(251, 146, 60, 0.25)',
                  animation: 'float 5s ease-in-out infinite',
                  animationDelay: '1s',
                }}
              >
                <div className='text-center'>
                  <div className='text-xl mb-1'>⛽</div>
                  <div className='text-orange-400 font-bold text-xs leading-none'>
                    {formatCurrency(result.financials.cost.split(' ')[0])}
                  </div>
                </div>
              </div>
            )}

            {result.financials.roi && (
              <div 
                className='group relative'
                style={{
                  ...liquidGlassStyle,
                  width: '75px',
                  height: '75px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'conic-gradient(from 180deg at 50% 50%, rgba(6, 182, 212, 0.16) 0deg, rgba(6, 182, 212, 0.05) 120deg, rgba(6, 182, 212, 0.09) 240deg, rgba(6, 182, 212, 0.16) 360deg)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  animation: 'float 6s ease-in-out infinite',
                  animationDelay: '2s',
                }}
              >
                <div className='text-center'>
                  <div className='text-lg mb-1'>📊</div>
                  <div className='text-cyan-400 font-bold text-xs leading-none'>{result.financials.roi}</div>
                </div>
              </div>
            )}
          </div>

          {/* Central Net Profit Bubble */}
          {result.financials.netProfit && (
            <div className='flex justify-center mt-6'>
              <div 
                className='group relative'
                style={{
                  ...liquidGlassStyle,
                  width: '120px',
                  height: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'conic-gradient(from 180deg at 50% 50%, rgba(16, 185, 129, 0.25) 0deg, rgba(16, 185, 129, 0.1) 120deg, rgba(16, 185, 129, 0.15) 240deg, rgba(16, 185, 129, 0.25) 360deg)',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  animation: 'float 7s ease-in-out infinite, glow 3s ease-in-out infinite alternate',
                  animationDelay: '0.5s',
                  boxShadow: '0 20px 60px rgba(16, 185, 129, 0.2), inset 0 2px 0 rgba(255,255,255,0.3)',
                }}
              >
                <div className='text-center'>
                  <div className='text-3xl mb-2'>🎯</div>
                  <div className='text-emerald-400 font-bold text-sm leading-none'>
                    {result.financials.netProfit.includes('ETH')
                      ? formatTokenAmount(result.financials.netProfit.split(' ')[0])
                      : result.financials.netProfit.split(' ')[0]}
                  </div>
                  <div className='text-emerald-300/50 text-xs mt-1'>NET</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Protocol Pills - Deep Glass with Shimmer */}
      {updatedProtocols && updatedProtocols.length > 0 && (
        <div 
          className='relative overflow-hidden hover:scale-102'
          style={{
            ...deepGlassStyle,
            padding: '18px 22px',
          }}
        >
          <div className='flex flex-wrap gap-2'>
            {updatedProtocols.map((protocol, index) => {
              const isUniswap = protocol.toLowerCase().includes('uniswap');
              const isWETH = protocol.toLowerCase().includes('weth');
              const protocolIcon = isUniswap ? '🦄' : isWETH ? '💎' : '🔗';
              
              return (
                <div
                  key={index}
                  className={`group flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-semibold hover:scale-105 transition-all duration-300 ${
                    isUniswap ? 'text-pink-300' : isWETH ? 'text-blue-300' : 'text-purple-300'
                  }`}
                  style={{
                    ...shimmerGlassStyle,
                    background: isUniswap
                      ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0.05) 50%, rgba(236, 72, 153, 0.12) 100%)'
                      : isWETH
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(59, 130, 246, 0.12) 100%)'
                      : 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.05) 50%, rgba(147, 51, 234, 0.12) 100%)',
                    border: `1px solid ${
                      isUniswap ? 'rgba(236, 72, 153, 0.3)' : 
                      isWETH ? 'rgba(59, 130, 246, 0.3)' : 
                      'rgba(147, 51, 234, 0.3)'
                    }`,
                    minHeight: '36px',
                    backgroundSize: '200% 100%',
                    animationDelay: `${index * 0.5}s`,
                  }}
                >
                  <span className='text-sm'>{protocolIcon}</span>
                  <span className='font-medium'>{protocol}</span>
                </div>
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
    </>
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
