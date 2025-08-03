// components/ui/SimulationResult.tsx

/**
 * @file This component is responsible for displaying the results of a completed simulation.
 * It takes the complex data object from the `useStrategySimulator` hook and presents
 * it in a user-friendly way with key metrics and a performance chart.
 */
'use client'; // This component will use a charting library that needs client-side rendering

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SimulationResultData } from '@/hooks/useStrategySimulator'; // Import the type

interface SimulationResultProps {
  data: SimulationResultData;
}

export const SimulationResult = ({ data }: SimulationResultProps) => {
  // LOGIC TO BE IMPLEMENTED:
  // 1. Format the data for the chart. The `originalPerformance` and `simulatedPerformance`
  //    arrays need to be merged into a single array for Recharts, e.g.:
  //    `[{ timestamp: 123, original: 5000, simulated: 11000 }, ...]`

  // 2. Create custom formatters for the chart's axes and tooltips to display
  //    USD values and dates nicely.

  const chartData: any[] | undefined = []; // This will be the merged and formatted data

  return (
    <div className='w-full h-full flex flex-col animate-in fade-in-50'>
      <h3 className='text-lg font-bold text-white mb-4'>Simulation Results</h3>

      {/* Key Performance Indicators (KPIs) */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <div className='bg-black/20 p-4 rounded-lg'>
          <p className='text-sm text-gray-400'>Original Wallet Final Value</p>
          <p className='text-2xl font-bold text-blue-400'>${data.kpis.finalOriginalValue.toLocaleString()}</p>
        </div>
        <div className='bg-black/20 p-4 rounded-lg'>
          <p className='text-sm text-gray-400'>Your Simulated Final Value</p>
          <p className='text-2xl font-bold text-green-400'>${data.kpis.finalSimulatedValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Performance Chart */}
      <div className='flex-grow'>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={chartData}>
            {/* Chart configuration will go here */}
            {/* <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" /> */}
            {/* <XAxis dataKey="timestamp" tickFormatter={...} /> */}
            {/* <YAxis tickFormatter={...} /> */}
            {/* <Tooltip contentStyle={{ backgroundColor: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.2)' }}/> */}
            {/* <Legend /> */}
            {/* <Line type="monotone" dataKey="original" stroke="#3b82f6" dot={false} /> */}
            {/* <Line type="monotone" dataKey="simulated" stroke="#22c55e" dot={false} /> */}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
