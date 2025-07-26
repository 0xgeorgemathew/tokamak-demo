import React from "react";
import { cn } from "@/lib/utils";

// --- FIX #1: Extend the standard HTMLAttributes for a div ---
// This automatically gives us support for `style`, `id`, `onClick`, `children`, `className`, etc.
interface GlassmorphicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  // We only need to define our custom props here.
  variant?: "default" | "glow" | "intense";
  hover?: boolean;
}

export function GlassmorphicCard({
  // --- FIX #2: Destructure our custom props and use `...props` for the rest ---
  children,
  className,
  variant = "default",
  hover = true,
  ...props // `props` will now contain `onClick`, `style`, and any other div attribute
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
        props.onClick && "cursor-pointer", // Check for onClick on the props object
        className
      )}
      // --- FIX #3: Spread the rest of the props onto the div ---
      {...props}
    >
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-inherit opacity-30">
        <div className="absolute top-0 left-1/3 w-1/3 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        <div className="absolute bottom-0 right-1/3 w-1/3 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
