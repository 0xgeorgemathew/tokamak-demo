// components/ui/PortfolioChart.tsx
'use client'; // This component uses client-side hooks and event listeners from the library

import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Define the shape of the data we expect
interface ChartDataPoint {
  timestamp: number;
  value_usd: number;
}

interface PortfolioChartProps {
  data: ChartDataPoint[];
}

// A simple formatter to make large USD values readable (e.g., 1000000 -> $1M)
const formatUsdValue = (value: number) => {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};

// A formatter to turn a UNIX timestamp (in seconds) into a readable date
const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString();
};

export const PortfolioChart = ({ data }: PortfolioChartProps) => {
  if (!data || data.length === 0) {
    return <p>No data to display.</p>;
  }

  return (
    <div className='w-full h-64 animate-in fade-in-50'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data}>
          {/* Gradients for the chart */}
          <defs>
            <linearGradient id='colorValue' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#06b6d4' stopOpacity={0.8} />
              <stop offset='95%' stopColor='#8b5cf6' stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id='gradientStroke' x1='0' y1='0' x2='1' y2='0'>
              <stop offset='0%' stopColor='#06b6d4' />
              <stop offset='100%' stopColor='#8b5cf6' />
            </linearGradient>
          </defs>

          {/* X-axis representing Time */}
          <XAxis dataKey='timestamp' tickFormatter={formatTimestamp} fontSize={12} tickLine={false} axisLine={false} />

          {/* Y-axis representing USD Value */}
          <YAxis
            dataKey='value_usd'
            tickFormatter={formatUsdValue}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={['dataMin', 'dataMax']}
          />

          {/* Tooltip that appears on hover */}
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(12, 9, 26, 0.9)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '0.75rem',
              backdropFilter: 'blur(12px)',
              color: '#e2e8f0',
              boxShadow: '0 8px 32px rgba(6, 182, 212, 0.15)',
            }}
            labelFormatter={formatTimestamp}
            formatter={(value: number) => [formatUsdValue(value), 'Portfolio Value']}
          />

          {/* The actual line on the chart */}
          <Line 
            type='monotone' 
            dataKey='value_usd' 
            stroke='url(#gradientStroke)' 
            strokeWidth={3} 
            dot={false} 
            fill='url(#colorValue)'
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
