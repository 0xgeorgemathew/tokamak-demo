"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TokamakGlowProps {
  size?: "sm" | "md" | "lg" | "xl";
  intensity?: number;
  className?: string;
  animate?: boolean;
}

export function TokamakGlow({
  size = "md",
  intensity = 1,
  className,
  animate = true,
}: TokamakGlowProps) {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-48 h-48",
    lg: "w-64 h-64",
    xl: "w-96 h-96",
  };

  const sizeValues = {
    sm: 96,
    md: 192,
    lg: 256,
    xl: 384,
  };

  const currentSize = sizeValues[size];

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Main Tokamak Torus - Plasma Core */}
      <div
        className={cn(
          "absolute inset-0 rounded-full opacity-90",
          animate && "animate-pulse"
        )}
        style={{
          background: `radial-gradient(ellipse 60% 30% at center, 
            rgba(255, 255, 255, ${0.9 * intensity}) 0%,
            rgba(0, 255, 255, ${0.8 * intensity}) 15%, 
            rgba(255, 0, 255, ${0.6 * intensity}) 35%, 
            rgba(0, 255, 0, ${0.4 * intensity}) 55%, 
            rgba(255, 100, 0, ${0.2 * intensity}) 75%,
            transparent 100%
          )`,
          boxShadow: `
            inset 0 0 ${40 * intensity}px rgba(255, 255, 255, 0.3),
            0 0 ${60 * intensity}px rgba(0, 255, 255, 0.4),
            0 0 ${120 * intensity}px rgba(255, 0, 255, 0.3),
            0 0 ${180 * intensity}px rgba(0, 255, 0, 0.2)
          `,
          animationDuration: "4s",
        }}
      />

      {/* Donut-shaped plasma chamber */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg,
            transparent 0deg,
            rgba(0, 255, 255, ${0.3 * intensity}) 60deg,
            transparent 120deg,
            rgba(255, 0, 255, ${0.3 * intensity}) 180deg,
            transparent 240deg,
            rgba(0, 255, 0, ${0.3 * intensity}) 300deg,
            transparent 360deg
          )`,
          mask: `radial-gradient(circle, transparent 35%, black 40%, black 65%, transparent 70%)`,
          WebkitMask: `radial-gradient(circle, transparent 35%, black 40%, black 65%, transparent 70%)`,
          animation: animate ? "spin 8s linear infinite" : "none",
        }}
      />

      {/* Toroidal Field Coils */}
      <div className="absolute inset-0">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={`toroidal-${i}`}
            className="absolute w-1 bg-gradient-to-b from-cyan-400 via-cyan-300 to-transparent rounded-full opacity-60"
            style={{
              height: `${currentSize * 0.4}px`,
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${
                i * 22.5
              }deg) translateY(-${currentSize * 0.45}px)`,
              animation: animate
                ? `pulse 2s ease-in-out infinite ${i * 0.1}s`
                : "none",
            }}
          />
        ))}
      </div>

      {/* Poloidal Field Coils */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`poloidal-${i}`}
            className="absolute border-2 border-purple-400/30 rounded-full"
            style={{
              width: `${currentSize * (0.2 + i * 0.1)}px`,
              height: `${currentSize * (0.2 + i * 0.1)}px`,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              animation: animate
                ? `pulse 3s ease-in-out infinite ${i * 0.2}s`
                : "none",
            }}
          />
        ))}
      </div>

      {/* Magnetic Field Lines Visualization */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border border-cyan-400/20",
          animate && "animate-spin"
        )}
        style={{ animationDuration: "12s" }}
      >
        {/* Field line indicators */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`field-${i}`}
            className="absolute w-0.5 bg-gradient-to-b from-cyan-400/50 to-transparent rounded-full"
            style={{
              height: `${currentSize * 0.25}px`,
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${
                i * 90
              }deg) translateY(-${currentSize * 0.4}px)`,
            }}
          />
        ))}
      </div>

      {/* Secondary Magnetic Containment */}
      <div
        className={cn(
          "absolute inset-2 rounded-full border border-purple-400/15",
          animate && "animate-spin"
        )}
        style={{ animationDirection: "reverse", animationDuration: "16s" }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`secondary-${i}`}
            className="absolute w-0.5 h-8 bg-gradient-to-b from-purple-400/40 to-transparent transform"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${
                i * 60
              }deg) translateY(-${currentSize * 0.35}px)`,
            }}
          />
        ))}
      </div>

      {/* High Energy Particles */}
      {animate && (
        <>
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full opacity-80"
              style={{
                left: `${30 + Math.cos((i * Math.PI) / 6) * 35}%`,
                top: `${30 + Math.sin((i * Math.PI) / 6) * 35}%`,
                animation: `ping 1.5s ease-in-out infinite ${i * 0.1}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Plasma Instabilities (fluctuations) */}
      {animate && (
        <div className="absolute inset-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`instability-${i}`}
              className="absolute w-2 h-2 rounded-full opacity-60"
              style={{
                background: `radial-gradient(circle, rgba(255, 255, 0, ${
                  0.8 * intensity
                }) 0%, transparent 70%)`,
                left: `${25 + Math.cos((i * Math.PI) / 4) * 40}%`,
                top: `${25 + Math.sin((i * Math.PI) / 4) * 40}%`,
                animation: `ping 2s ease-in-out infinite ${i * 0.25}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Central Vacuum Chamber */}
      <div
        className="absolute inset-1/3 rounded-full border border-white/5"
        style={{
          background: `radial-gradient(circle, 
            rgba(0, 0, 0, ${0.8 * intensity}) 0%, 
            rgba(255, 255, 255, ${0.05 * intensity}) 100%
          )`,
        }}
      />

      {/* Heating System Indicators */}
      <div className="absolute inset-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`heating-${i}`}
            className="absolute w-1 h-6 bg-gradient-to-b from-red-400/60 to-transparent rounded-full"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) rotate(${
                i * 120
              }deg) translateY(-${currentSize * 0.48}px)`,
              animation: animate
                ? `pulse 1s ease-in-out infinite ${i * 0.3}s`
                : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
