import React from "react";
import { cn } from "@/lib/utils";

interface GlassmorphicCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glow" | "intense";
  onClick?: () => void;
  hover?: boolean;
}

export function GlassmorphicCard({
  children,
  className,
  variant = "default",
  onClick,
  hover = true,
}: GlassmorphicCardProps) {
  const baseClasses =
    "relative backdrop-blur-md border transition-all duration-300";

  const variantClasses = {
    default: "bg-white/10 border-white/20 shadow-lg",
    glow: "bg-white/15 border-cyan-400/30 shadow-cyan-400/20 shadow-2xl",
    intense: "bg-white/20 border-purple-400/40 shadow-purple-400/30 shadow-2xl",
  };

  const hoverClasses = hover
    ? "hover:bg-white/20 hover:border-white/30 hover:shadow-xl hover:scale-[1.02]"
    : "";

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        hoverClasses,
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Plasma glow effect */}
      <div className="absolute inset-0 rounded-inherit opacity-50">
        <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="absolute bottom-0 right-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
        <div className="absolute left-0 top-1/4 h-1/2 w-px bg-gradient-to-b from-transparent via-green-400 to-transparent" />
        <div className="absolute right-0 bottom-1/4 h-1/2 w-px bg-gradient-to-b from-transparent via-pink-400 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
