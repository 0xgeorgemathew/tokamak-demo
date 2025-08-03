// components/ui/TransactionInput.tsx
'use client';

import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidEthereumAddress, isValidTransactionHash } from '@/lib/utils';

interface TransactionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, type: 'address' | 'transaction') => void;
  placeholder?: string;
  loading?: boolean;
}

export function TransactionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Enter transaction hash or wallet address',
  loading = false,
}: TransactionInputProps) {
  const handleSubmit = () => {
    const type = isValidEthereumAddress(value) ? 'address' : isValidTransactionHash(value) ? 'transaction' : null;
    if (type) {
      onSubmit(value, type);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className='relative'>
      <div className='flex items-center bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg shadow-inner shadow-black/50 pl-4'>
        <Search className='w-5 h-5 text-gray-400' />
        <input
          type='text'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className='flex-1 bg-transparent text-gray-200 placeholder-gray-500 border-none outline-none px-4 py-3 font-mono text-sm'
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className={cn(
            'px-5 py-2 m-1 rounded-md transition-all duration-200',
            'bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 text-sm font-semibold',
            'hover:bg-cyan-500/20 hover:border-cyan-400/40',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className='w-4 h-4 animate-spin' /> : 'Analyze'}
        </button>
      </div>
    </div>
  );
}
