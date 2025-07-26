// components/Navbar.tsx
"use client";
import React from "react";
import { Atom } from "lucide-react";
import { NetworkSelector } from "@/components/ui/NetworkSelector";
import { GlassmorphicCard } from "@/components/ui/GlassmorphicCard";
import { Network } from "@/lib/types";

interface NavbarProps {
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

export function Navbar({ selectedNetwork, onNetworkChange }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo (Enhanced Glassmorphic) */}
        <GlassmorphicCard 
          variant="glow" 
          className="cursor-pointer px-4 py-2 hover:scale-105 transition-transform duration-200"
          hover={true}
        >
          <div className="flex items-center space-x-3">
            <Atom className="w-5 h-5 text-cyan-300" />
            <h1 className="text-md font-bold text-white">Tokamak</h1>
          </div>
        </GlassmorphicCard>

        {/* Network Selector (Enhanced) */}
        <div className="w-48">
          <NetworkSelector
            selectedNetwork={selectedNetwork}
            onNetworkChange={onNetworkChange}
          />
        </div>
      </div>
    </header>
  );
}
