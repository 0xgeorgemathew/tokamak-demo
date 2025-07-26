// app/page.tsx
"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AnalyzerCard } from "@/components/ui/AnalyzerCard";
import { GlassmorphicCard } from "@/components/ui/GlassmorphicCard";
import { DEFAULT_NETWORK } from "@/lib/constants";
import { Network } from "@/lib/types";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(DEFAULT_NETWORK);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAnalyze = async (
    value: string,
    type: "address" | "transaction"
  ) => {
    setLoading(true);
    setResult(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setResult(
        `${
          type === "address"
            ? "Token flows decoded"
            : "Transaction trace decoded"
        }`
      );
    } catch (err) {
      setResult("Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-hidden">
      <Navbar
        selectedNetwork={selectedNetwork}
        onNetworkChange={setSelectedNetwork}
      />

      <main className="relative min-h-screen flex flex-col items-center justify-center p-4">
        {/* This container sets up the stage for the layered effect */}
        <div className="relative w-full flex flex-col items-center">
          {/* 1. Hackathon Demo Pill (Top) */}
          <div className="mb-8 z-20">
            <GlassmorphicCard variant="glow" className="px-4 py-2 rounded-full">
              <div className="flex items-center space-x-2 text-sm font-medium text-white">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Unite Defi hackathon Demo</span>
              </div>
            </GlassmorphicCard>
          </div>

          {/* 2. Header Text */}
          <div className="text-center mb-8 z-10">
            <h1 className="text-4xl md:text-5xl font-semibold text-white mb-3">
              Think Deeper
            </h1>
            <p className="text-lg text-gray-400">
              Never miss a detail, flow, or connection.
            </p>
          </div>

          {/* 3. Black Hole Arc Effect (Horizon) */}
          <div className="relative w-full max-w-6xl h-96 mb-8 z-5">
            <div className="absolute inset-0 hero-black-hole-arc overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover scale-125 translate-y-8"
              >
                <source src="/blackhole.webm" type="video/mp4" />
              </video>
            </div>
          </div>

          {/* 4. Glassmorphic Card (Overlaid on Black Hole) */}
          <div className="relative z-10 w-full max-w-5xl animate-float -mt-48">
            <AnalyzerCard
              inputValue={inputValue}
              onInputChange={setInputValue}
              onAnalyze={handleAnalyze}
              loading={loading}
              result={result}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
