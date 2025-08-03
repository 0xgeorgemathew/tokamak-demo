// components/views/SimulatorView.tsx

import React, { useState } from 'react';
import { Loader2, TrendingUp, BarChart3, History, Settings } from 'lucide-react';
import { getHistoricalPortfolioValue } from '@/lib/api/1inch';
import { PortfolioChart } from '@/components/ui/PortfolioChart';

// Define a type for the chart data for type safety
interface ChartDataPoint {
  timestamp: number;
  value_usd: number;
}

const SidebarItem = ({ icon: Icon, label, active }: { icon: React.ElementType; label: string; active?: boolean }) => (
  <div
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group ${
      active ? 'text-white' : 'text-gray-400 hover:text-white'
    }`}
    style={{
      background: active ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
      border: active ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
    }}
  >
    <Icon className='w-5 h-5 transition-transform duration-300 group-hover:scale-110' />
    <span className='text-sm font-medium tracking-wide'>{label}</span>
  </div>
);

const PortfolioInput = ({ value, onChange, onSubmit, loading }: any) => (
  <div className='flex items-center space-x-4'>
    <div className='relative flex-grow'>
      <TrendingUp className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500' />
      <input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Enter wallet address for portfolio analysis'
        className='w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500'
      />
    </div>
    <button
      onClick={() => onSubmit(value, 'address')}
      disabled={loading}
      className='backdrop-blur-sm bg-white/5 border border-white/10 text-white-300 px-6 py-3 rounded-xl font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed'
    >
      {loading ? 'Analyzing...' : 'Analyze'}
    </button>
  </div>
);

export const SimulatorView = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);

  const handleRun = async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);
    setChartData(null);

    try {
      const data = await getHistoricalPortfolioValue(walletAddress, 1);
      setChartData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch portfolio data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className='w-full max-w-5xl rounded-3xl structural-illuminated-frame'
      style={{
        backdropFilter: 'blur(24px) saturate(180%)',
        background: 'rgba(12, 9, 26, 0.7)',
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
        <div className='flex' style={{ height: '420px' }}>
          <div className='w-64 border-r border-white/10 p-4 space-y-2 flex flex-col'>
            <SidebarItem icon={TrendingUp} label='Portfolio Analysis' active />
            <SidebarItem icon={BarChart3} label='Performance Metrics' />
            <SidebarItem icon={History} label='Historical Data' />
            <div className='flex-grow' />
            <SidebarItem icon={Settings} label='Settings' />
          </div>
          <div className='flex-1 p-8 flex flex-col justify-start'>
            <PortfolioInput 
              value={walletAddress} 
              onChange={setWalletAddress} 
              onSubmit={handleRun} 
              loading={isLoading} 
            />
            <div className='flex-grow flex items-center justify-center text-center px-4'>
              {isLoading ? (
                <div className='flex flex-col items-center space-y-3'>
                  <Loader2 className='w-7 h-7 animate-spin text-cyan-300' />
                  <span className='text-sm text-gray-400 tracking-wide'>Fetching portfolio data...</span>
                </div>
              ) : error ? (
                <div
                  className='flex flex-col items-center space-y-2 p-6 rounded-2xl'
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <span className='text-red-400 font-medium text-lg'>✗ {error}</span>
                </div>
              ) : chartData ? (
                <div className='w-full h-full flex items-center justify-center'>
                  <PortfolioChart data={chartData} />
                </div>
              ) : (
                <div className='max-w-md'>
                  <span className='text-gray-400 text-base leading-relaxed'>
                    Enter a wallet address to visualize its portfolio performance over time.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
