"use client";

import React, { useState } from "react";
import { Search, AlertCircle, Hash, Wallet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidEthereumAddress, isValidTransactionHash } from "@/lib/utils";
import { GlassmorphicCard } from "./GlassmorphicCard";

interface TransactionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, type: "address" | "transaction") => void;
  placeholder?: string;
  className?: string;
  loading?: boolean;
}

export function TransactionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Enter transaction hash or wallet address",
  className,
  loading = false,
}: TransactionInputProps) {
  const [error, setError] = useState<string | null>(null);

  const validateInput = (
    input: string
  ): {
    isValid: boolean;
    type: "address" | "transaction" | null;
    error?: string;
  } => {
    if (!input.trim()) {
      return { isValid: false, type: null, error: "Input cannot be empty" };
    }

    if (isValidEthereumAddress(input)) {
      return { isValid: true, type: "address" };
    }

    if (isValidTransactionHash(input)) {
      return { isValid: true, type: "transaction" };
    }

    return {
      isValid: false,
      type: null,
      error:
        "Please enter a valid Ethereum address (0x...) or transaction hash",
    };
  };

  const handleSubmit = () => {
    const validation = validateInput(value);

    if (!validation.isValid) {
      setError(validation.error || "Invalid input");
      return;
    }

    setError(null);
    onSubmit(value, validation.type!);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const inputType = value ? validateInput(value).type : null;

  return (
    <div className={cn("space-y-2", className)}>
      <GlassmorphicCard className="p-1">
        <div className="flex items-center space-x-3 p-3">
          {/* Input type indicator */}
          <div className="flex-shrink-0">
            {inputType === "address" && (
              <Wallet className="w-5 h-5 text-green-400" />
            )}
            {inputType === "transaction" && (
              <Hash className="w-5 h-5 text-blue-400" />
            )}
            {!inputType && <Search className="w-5 h-5 text-gray-400" />}
          </div>

          {/* Input field */}
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent text-white placeholder-gray-400 border-none outline-none",
              "text-sm font-mono"
            )}
            disabled={loading}
          />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !value.trim()}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-lg transition-all duration-200",
              "bg-cyan-500/20 border border-cyan-400/30 text-cyan-400",
              "hover:bg-cyan-500/30 hover:border-cyan-400/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "font-medium text-sm"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
          </button>
        </div>
      </GlassmorphicCard>

      {/* Error message */}
      {error && (
        <GlassmorphicCard className="p-3 border-red-400/30 bg-red-500/10">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </GlassmorphicCard>
      )}

      {/* Input type hint */}
      {inputType && (
        <div className="text-xs text-gray-400 px-2">
          {inputType === "address" &&
            "🎯 Wallet address detected - will analyze transaction history"}
          {inputType === "transaction" &&
            "🔍 Transaction hash detected - will analyze single transaction"}
        </div>
      )}
    </div>
  );
}
