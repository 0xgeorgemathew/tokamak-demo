// components/Navbar.tsx
"use client";
import React from "react";
// 1. A new, more fitting icon for "Tokamak"
import { Orbit } from "lucide-react";
import { NetworkSelector } from "@/components/ui/NetworkSelector";
import { Network } from "@/lib/types";

interface NavbarProps {
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

export function Navbar({ selectedNetwork, onNetworkChange }: NavbarProps) {
  return (
    // 2. A more sophisticated glassmorphic effect for the navbar bar
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-8 flex items-center justify-between h-20">
        {/* Extreme Left: Logo */}
        <div className="flex items-center space-x-4 cursor-pointer group">
          <Orbit className="w-7 h-7 text-violet-300 transition-all duration-300 group-hover:text-cyan-300 group-hover:rotate-90" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent transition-all duration-300 group-hover:brightness-110">
            Tokamak
          </h1>
        </div>

        {/* Extreme Right: Network Selector */}
        <div>
          <NetworkSelector
            selectedNetwork={selectedNetwork}
            onNetworkChange={onNetworkChange}
          />
        </div>
      </div>
    </header>
  );
}
