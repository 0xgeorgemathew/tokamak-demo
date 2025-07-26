"use client";
import React from "react";
import { Orbit } from "lucide-react";
import { NetworkSelector } from "@/components/ui/NetworkSelector";
import { Network } from "@/lib/types";

interface NavbarProps {
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

export function Navbar({ selectedNetwork, onNetworkChange }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/40 backdrop-blur-xl border-b border-white/10">
      {/* --- THIS IS THE FIX --- */}
      {/* Removed `max-w-screen-xl` and `mx-auto` to allow the container to be full-width */}
      <div className="w-full px-6 lg:px-8 flex items-center justify-between h-20">
        {/* Extreme Left: Logo */}
        <div className="flex items-center space-x-4 cursor-pointer group">
          <Orbit className="w-9 h-9 text-violet-300 transition-all duration-300 group-hover:text-violet-200 group-hover:rotate-90" />
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-violet-400 to-white bg-clip-text text-transparent transition-all duration-300 group-hover:brightness-110">
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
