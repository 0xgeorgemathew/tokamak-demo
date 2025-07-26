// components/ui/AnalyzerCard.tsx
import React from "react";
import { Hash, Wallet, History, Settings, Loader2 } from "lucide-react";
import { TransactionInput } from "./TransactionInput";

interface AnalyzerCardProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onAnalyze: (value: string, type: "address" | "transaction") => void;
  loading: boolean;
  result: string | null;
}

const SidebarItem = ({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}) => (
  <div
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer group ${
      active
        ? "text-white"
        : "text-gray-400 hover:text-white"
    }`}
    style={{
      background: active 
        ? 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(79,70,229,0.1) 100%), rgba(255,255,255,0.05)'
        : 'transparent',
      backdropFilter: active ? 'blur(10px)' : 'none',
      border: active ? '1px solid rgba(147,51,234,0.3)' : '1px solid transparent'
    }}
  >
    <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
    <span className="text-sm font-medium tracking-wide">{label}</span>
  </div>
);

export function AnalyzerCard({
  inputValue,
  onInputChange,
  onAnalyze,
  loading,
  result,
}: AnalyzerCardProps) {
  return (
    <div className="w-full max-w-5xl glass-border-gradient rounded-3xl overflow-hidden transition-all duration-500" style={{
      backdropFilter: 'blur(24px) saturate(180%)',
      background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.1) 100%), rgba(3,0,20,0.4)',
      boxShadow: '0 32px 64px rgba(147,51,234,0.25), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.1)'
    }}>
      <div className="h-12 px-6 border-b border-white/10 flex items-center" style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
      }}>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full shadow-sm"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
        </div>
      </div>
      <div className="flex" style={{ height: "420px" }}>
        <div className="w-64 border-r border-white/8 p-6 space-y-2 flex flex-col" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)'
        }}>
          <SidebarItem icon={Hash} label="Transaction Analysis" active />
          <SidebarItem icon={Wallet} label="Wallet Analysis" />
          <SidebarItem icon={History} label="History" />
          <div className="flex-grow" />
          <SidebarItem icon={Settings} label="Settings" />
        </div>
        <div className="flex-1 p-8 flex flex-col justify-start" style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,255,255,0.02) 0%, transparent 70%)'
        }}>
          <TransactionInput
            value={inputValue}
            onChange={onInputChange}
            onSubmit={onAnalyze}
            loading={loading}
          />
          <div className="flex-grow flex items-center justify-center text-center px-4">
            {loading ? (
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="w-7 h-7 animate-spin text-violet-300" />
                <span className="text-sm text-gray-400 tracking-wide">Analyzing...</span>
              </div>
            ) : result ? (
              <div className="flex flex-col items-center space-y-2 p-6 rounded-2xl" style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)',
                border: '1px solid rgba(34,197,94,0.2)',
                backdropFilter: 'blur(10px)'
              }}>
                <span className="text-emerald-400 font-medium text-lg">✓ {result}</span>
              </div>
            ) : (
              <div className="max-w-md">
                <span className="text-gray-400 text-base leading-relaxed">
                  Enter a transaction hash or wallet address to begin deep analysis.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
