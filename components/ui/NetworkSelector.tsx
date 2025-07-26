"use client";

import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { SUPPORTED_NETWORKS, DEFAULT_NETWORK } from "@/lib/constants";
import { Network } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GlassmorphicCard } from "./GlassmorphicCard";

interface NetworkSelectorProps {
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
  className?: string;
}

export function NetworkSelector({
  selectedNetwork,
  onNetworkChange,
  className,
}: NetworkSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <GlassmorphicCard
        variant={isOpen ? "glow" : "default"}
        className="p-3 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
        onClick={() => setIsOpen(!isOpen)}
        hover={true}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ 
                backgroundColor: selectedNetwork.color,
                boxShadow: `0 0 8px ${selectedNetwork.color}30`
              }}
            />
            <span className="text-white font-medium">
              {selectedNetwork.name}
            </span>
            <span className="text-gray-300 text-sm">
              {selectedNetwork.symbol}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-gray-300 transition-all duration-300",
              isOpen && "rotate-180 text-cyan-400"
            )}
          />
        </div>
      </GlassmorphicCard>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 animate-in slide-in-from-top-2 duration-200">
          <GlassmorphicCard variant="intense" className="py-2 border-white/20">
            <div className="max-h-64 overflow-y-auto">
              {SUPPORTED_NETWORKS.map((network) => (
                <div
                  key={network.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-200 rounded-md mx-2",
                    "hover:bg-white/15 hover:scale-[1.02]",
                    selectedNetwork.id === network.id && "bg-white/10 border border-white/20"
                  )}
                  onClick={() => {
                    onNetworkChange(network);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ 
                        backgroundColor: network.color,
                        boxShadow: `0 0 6px ${network.color}40`
                      }}
                    />
                    <span className="text-white font-medium">
                      {network.name}
                    </span>
                    <span className="text-gray-300 text-sm">
                      {network.symbol}
                    </span>
                  </div>
                  {selectedNetwork.id === network.id && (
                    <Check className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
              ))}
            </div>
          </GlassmorphicCard>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
