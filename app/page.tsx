"use client";

import React, { useState } from "react";
import { TokamakGlow } from "@/components/ui/TokamakGlow";
import { GlassmorphicCard } from "@/components/ui/GlassmorphicCard";
import { NetworkSelector } from "@/components/ui/NetworkSelector";
import { TransactionInput } from "@/components/ui/TransactionInput";
import { DEFAULT_NETWORK, SUPPORTED_NETWORKS } from "@/lib/constants";
import { Network } from "@/lib/types";
import { Activity, Zap, TrendingUp, Database } from "lucide-react";

export default function HomePage() {
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(DEFAULT_NETWORK);
  const [inputValue, setInputValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async (
    value: string,
    type: "address" | "transaction"
  ) => {
    setIsAnalyzing(true);
    console.log(
      `Analyzing ${type}:`,
      value,
      "on network:",
      selectedNetwork.name
    );

    // Simulate API call
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 3000);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Main Tokamak Reactor - Artistic Integration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative">
          {/* Primary Tokamak Chamber */}
          <TokamakGlow size="xl" intensity={0.8} className="opacity-60" />

          {/* Secondary Magnetic Containment Fields */}
          <div className="absolute inset-0 scale-150 opacity-30">
            <TokamakGlow size="xl" intensity={0.4} animate={true} />
          </div>

          {/* Tertiary Field Lines */}
          <div className="absolute inset-0 scale-75 opacity-40">
            <TokamakGlow size="xl" intensity={0.6} animate={true} />
          </div>

          {/* Energy Flow Indicators */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-96 h-96">
              {/* Toroidal field coils visualization */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-8 bg-gradient-to-b from-cyan-400 to-transparent rounded-full opacity-60"
                  style={{
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) rotate(${
                      i * 45
                    }deg) translateY(-190px)`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}

              {/* Poloidal field indicators */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-purple-400 rounded-full animate-ping opacity-70"
                  style={{
                    left: `${20 + Math.cos((i * Math.PI) / 3) * 30 + 50}%`,
                    top: `${20 + Math.sin((i * Math.PI) / 3) * 30 + 50}%`,
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: "3s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <div className="inline-flex items-center space-x-3 mb-6">
            <Zap className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
              Tokamak DEX
            </h1>
            <Activity className="w-8 h-8 text-purple-400" />
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Harness the power of fusion analytics to decode DeFi transaction
            profitability
          </p>
          <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span>Plasma containment stable</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>1inch APIs integrated</span>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Main Control Panel */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Network Selection & Input */}
          <GlassmorphicCard className="p-6" variant="glow">
            <div className="space-y-6">
              <div className="flex items-center space-x-3 mb-4">
                <Database className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">
                  Reactor Configuration
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Network Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Blockchain Network
                  </label>
                  <NetworkSelector
                    selectedNetwork={selectedNetwork}
                    onNetworkChange={setSelectedNetwork}
                  />
                </div>

                {/* Transaction Input */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Transaction Hash or Wallet Address
                  </label>
                  <TransactionInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleAnalyze}
                    loading={isAnalyzing}
                    placeholder="0x... (address or transaction hash)"
                  />
                </div>
              </div>
            </div>
          </GlassmorphicCard>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            <GlassmorphicCard className="p-6" variant="default">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Profit Analysis
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Advanced trade profitability calculations
                  </p>
                </div>
              </div>
            </GlassmorphicCard>

            <GlassmorphicCard className="p-6" variant="default">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-400/30">
                  <Activity className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Transaction Traces
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Step-by-step execution analysis
                  </p>
                </div>
              </div>
            </GlassmorphicCard>

            <GlassmorphicCard className="p-6" variant="default">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-lg bg-green-500/20 border border-green-400/30">
                  <Database className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Multi-Chain Support
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {SUPPORTED_NETWORKS.length} networks supported
                  </p>
                </div>
              </div>
            </GlassmorphicCard>
          </div>

          {/* Analysis Results Placeholder */}
          {isAnalyzing && (
            <GlassmorphicCard className="p-8" variant="intense">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center space-x-3">
                  <div className="relative">
                    <TokamakGlow size="sm" intensity={1.2} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Plasma Analysis in Progress
                    </h3>
                    <p className="text-gray-300">
                      Containing fusion reactions and decoding transactions...
                    </p>
                  </div>
                </div>

                <div className="flex justify-center space-x-4 mt-6">
                  <div className="flex items-center space-x-2 text-cyan-400">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="text-sm">Magnetic confinement</span>
                  </div>
                  <div className="flex items-center space-x-2 text-purple-400">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    <span className="text-sm">Trace extraction</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm">Profit calculation</span>
                  </div>
                </div>
              </div>
            </GlassmorphicCard>
          )}

          {/* Instructions */}
          <GlassmorphicCard className="p-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span>How to Use the Tokamak Reactor</span>
              </h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-white">Select Network</p>
                      <p>
                        Choose from {SUPPORTED_NETWORKS.length} supported
                        blockchain networks
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-white">Input Data</p>
                      <p>
                        Enter a wallet address to analyze trading history or a
                        specific transaction hash
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center text-green-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-white">Analyze Fusion</p>
                      <p>
                        Watch as the reactor analyzes transaction traces and
                        calculates profitability
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-400/30 flex items-center justify-center text-yellow-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <p className="font-medium text-white">View Results</p>
                      <p>
                        Get detailed insights into trade profitability, gas
                        costs, and net gains
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassmorphicCard>
        </div>
      </div>

      {/* Ambient Particles */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-20 animate-ping"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
