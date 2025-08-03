'use client';

import React, { useState } from 'react';
// Assuming you have these components in your project structure
import { Navbar } from '@/components/Navbar';
import { AnalyzerCard } from '@/components/ui/AnalyzerCard';
import { SimulatorView } from '@/components/views/SimulatorView';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';

// Assuming you have these defined in a constants/types file
import { DEFAULT_NETWORK } from '@/lib/constants';
import { Network } from '@/lib/types';

export default function HomePage() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network>(DEFAULT_NETWORK);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'analyzer' | 'simulator'>('analyzer');

  const handleAnalyze = async (value: string, type: 'address' | 'transaction') => {
    setLoading(true);
    setResult(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setResult(`${type === 'address' ? 'Token flows decoded' : 'Transaction trace decoded'}`);
    } catch (err) {
      setResult('Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen w-full overflow-hidden'>
      <Navbar selectedNetwork={selectedNetwork} onNetworkChange={setSelectedNetwork} />

      <main className='relative flex flex-col items-center justify-center p-4 pt-24'>
        <div className='relative w-full flex flex-col items-center'>
          <div className='relative z-10 flex flex-col items-center'>
            <div className='mb-8'>
              <ViewSwitcher activeView={activeView} onViewChange={setActiveView} />
            </div>
          </div>

          <div className='relative w-[2000px] h-[800px] -mt-48 z-0'>
            <div className='absolute inset-0 hero-black-hole overflow-hidden'>
              <video autoPlay loop muted playsInline className='w-full h-full object-cover'>
                <source src='/blackhole.webm' type='video/webm' />
              </video>
            </div>
          </div>

          <div className='z-10 w-full max-w-10xl animate-fade-up -mt-[24.5rem] mx-auto'>
            {activeView === 'analyzer' ? (
              <AnalyzerCard
                inputValue={inputValue}
                onInputChange={setInputValue}
                onAnalyze={handleAnalyze}
                loading={loading}
                result={result}
              />
            ) : (
              <SimulatorView />
            )}

            <div className='text-center mt-8'>
              <h1 className='text-5xl md:text-7xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-3 font-heading'>
                Decode Deeper
              </h1>
              <p className='text-lg text-slate-400'>Never miss a detail, flow, or connection.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
