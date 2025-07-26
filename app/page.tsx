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

      <main className="relative flex flex-col items-center justify-center p-4 pt-24">
        {/* This container sets up the stage for the layered effect */}
        <div className="relative w-full flex flex-col items-center">
          {/* 1. Content on top of the black hole */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-8">
              <GlassmorphicCard
                variant="glow"
                className="px-4 py-2 rounded-full"
              >
                <div className="flex items-center space-x-2 text-sm font-medium text-white">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>Unite Defi hackathon Demo</span>
                </div>
              </GlassmorphicCard>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-3 font-heading">
                Decode Deeper
              </h1>
              <p className="text-lg text-slate-400">
                Never miss a detail, flow, or connection.
              </p>
            </div>
          </div>

          {/* 2. Black Hole Video (Positioned behind the card) */}
          <div className="relative w-[800px] h-[800px] -mt-48 z-0">
            <div className="absolute inset-0 hero-black-hole overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                {/* Ensure you have a 'blackhole.webm' file in your /public directory */}
                <source src="/blackhole.webm" type="video/webm" />
              </video>
            </div>
          </div>

          {/* 3. Analyzer Card (Floats on top of the video with a negative margin) */}
          <div className="relative z-10 w-full max-w-5xl animate-float -mt-[32rem]">
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
