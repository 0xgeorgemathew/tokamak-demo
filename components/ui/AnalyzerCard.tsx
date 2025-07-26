import React from "react";
import { Hash, Wallet, History, Settings, Loader2 } from "lucide-react";

// The "TransactionInput" component is defined here. We will modify its button.
const TransactionInput = ({ value, onChange, onSubmit, loading }: any) => (
  <div className="flex items-center space-x-4">
    <div className="relative flex-grow">
      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter transaction hash or wallet address"
        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
      />
    </div>
    <button
      onClick={() => onSubmit(value, "transaction")}
      disabled={loading}
      // --- THIS IS THE CHANGE ---
      // Replaced the old classes with new glassmorphic styles
      className="backdrop-blur-sm bg-white/5 border border-white/10 text-white-300 px-6 py-3 rounded-xl font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Analyzing..." : "Analyze"}
    </button>
  </div>
);

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
      active ? "text-white" : "text-gray-400 hover:text-white"
    }`}
    style={{
      background: active ? "rgba(255, 255, 255, 0.07)" : "transparent",
      border: active
        ? "1px solid rgba(255, 255, 255, 0.1)"
        : "1px solid transparent",
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
    <div
      className="w-full max-w-5xl rounded-3xl structural-illuminated-frame"
      style={{
        backdropFilter: "blur(24px) saturate(180%)",
        background: "rgba(12, 9, 26, 0.7)",
      }}
    >
      <div className="relative z-10">
        <div className="h-12 px-6 border-b border-white/10 flex items-center">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
        <div className="flex" style={{ height: "420px" }}>
          <div className="w-64 border-r border-white/10 p-4 space-y-2 flex flex-col">
            <SidebarItem icon={Hash} label="Transaction Analysis" active />
            <SidebarItem icon={Wallet} label="Wallet Analysis" />
            <SidebarItem icon={History} label="History" />
            <div className="flex-grow" />
            <SidebarItem icon={Settings} label="Settings" />
          </div>
          <div className="flex-1 p-8 flex flex-col justify-start">
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
                  <span className="text-sm text-gray-400 tracking-wide">
                    Analyzing...
                  </span>
                </div>
              ) : result ? (
                <div
                  className="flex flex-col items-center space-y-2 p-6 rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <span className="text-emerald-400 font-medium text-lg">
                    ✓ {result}
                  </span>
                </div>
              ) : (
                <div className="max-w-md">
                  <span className="text-gray-400 text-base leading-relaxed">
                    Enter a transaction hash or wallet address to begin deep
                    analysis.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
