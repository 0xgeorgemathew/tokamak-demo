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
        className="p-3 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        hover={true}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedNetwork.color }}
            />
            <span className="text-white font-medium">
              {selectedNetwork.name}
            </span>
            <span className="text-gray-400 text-sm">
              {selectedNetwork.symbol}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </GlassmorphicCard>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <GlassmorphicCard className="py-2">
            <div className="max-h-64 overflow-y-auto">
              {SUPPORTED_NETWORKS.map((network) => (
                <div
                  key={network.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors duration-200",
                    "hover:bg-white/10",
                    selectedNetwork.id === network.id && "bg-white/5"
                  )}
                  onClick={() => {
                    onNetworkChange(network);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: network.color }}
                    />
                    <span className="text-white font-medium">
                      {network.name}
                    </span>
                    <span className="text-gray-400 text-sm">
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
