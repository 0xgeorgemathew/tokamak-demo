// components/ui/NetworkSelector.tsx
"use client";

import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";

// --- THIS IS THE FIX ---
// Import the TYPE from `types` and the CONSTANT from `constants`
import { Network } from "@/lib/types";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

interface NetworkSelectorProps {
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

export function NetworkSelector({
  selectedNetwork,
  onNetworkChange,
}: NetworkSelectorProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {/* Redesigned button with inner shadow for a premium feel */}
        <button
          className="flex items-center justify-between space-x-3 w-44 cursor-pointer rounded-full px-4 py-2
                     bg-slate-900/50 backdrop-blur-lg border border-white/10 shadow-inner shadow-black/20
                     hover:bg-slate-900/60 hover:border-white/20 transition-all duration-300
                     focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <div className="flex items-center space-x-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: selectedNetwork.color }}
            />
            <span className="text-sm font-medium text-slate-200">
              {selectedNetwork.name}
            </span>
          </div>
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        {/* Redesigned dropdown with a cleaner, darker glass look */}
        <DropdownMenu.Content
          className="w-56 mt-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-2 backdrop-blur-2xl shadow-2xl
                     animate-in fade-in-0 zoom-in-95"
          sideOffset={5}
        >
          {SUPPORTED_NETWORKS.map((network) => (
            <DropdownMenu.Item
              key={network.id}
              className="flex items-center justify-between p-2 rounded-lg text-sm text-slate-200 
                         cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:outline-none"
              onSelect={() => onNetworkChange(network)}
            >
              <div className="flex items-center space-x-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: network.color }}
                />
                <span>{network.name}</span>
              </div>
              {selectedNetwork.id === network.id && (
                <Check className="w-4 h-4 text-cyan-400" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
