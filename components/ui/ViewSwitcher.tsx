import React from 'react';
import { Hash, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewSwitcherProps {
  activeView: 'analyzer' | 'simulator';
  onViewChange: (view: 'analyzer' | 'simulator') => void;
}

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className='flex items-center backdrop-blur-md bg-white/10 border border-white/20 rounded-full p-1 mb-4'>
      <button
        onClick={() => onViewChange('analyzer')}
        className={cn(
          'flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium',
          activeView === 'analyzer'
            ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        )}
      >
        <Hash className='w-4 h-4' />
        <span>Transaction Analysis</span>
      </button>
      <button
        onClick={() => onViewChange('simulator')}
        className={cn(
          'flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium',
          activeView === 'simulator'
            ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        )}
      >
        <TrendingUp className='w-4 h-4' />
        <span>Portfolio Simulator</span>
      </button>
    </div>
  );
}