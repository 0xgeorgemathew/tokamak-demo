import { type ClassValue, clsx } from "clsx";
import { REGEX_PATTERNS, SUPPORTED_NETWORKS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function isValidEthereumAddress(address: string): boolean {
  return REGEX_PATTERNS.ETHEREUM_ADDRESS.test(address);
}

export function isValidTransactionHash(hash: string): boolean {
  return REGEX_PATTERNS.TRANSACTION_HASH.test(hash);
}

export function isValidBlockNumber(blockNumber: string): boolean {
  return REGEX_PATTERNS.BLOCK_NUMBER.test(blockNumber);
}

export function formatAddress(address: string, length: number = 6): string {
  if (!isValidEthereumAddress(address)) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatTransactionHash(
  hash: string,
  length: number = 8
): string {
  if (!isValidTransactionHash(hash)) return hash;
  return `${hash.slice(0, length + 2)}...${hash.slice(-length)}`;
}

export function formatNumber(num: number, decimals: number = 4): string {
  if (num === 0) return "0";
  if (Math.abs(num) < 0.0001) return "< 0.0001";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatEther(wei: string): string {
  try {
    const value = BigInt(wei) / BigInt(10 ** 18);
    return formatNumber(Number(value), 6);
  } catch {
    return "0";
  }
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getNetworkById(chainId: number) {
  return SUPPORTED_NETWORKS.find((network) => network.id === chainId);
}

export function getNetworkByName(name: string) {
  return SUPPORTED_NETWORKS.find(
    (network) => network.name.toLowerCase() === name.toLowerCase()
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function generatePlasmaGlow(intensity: number = 1): string {
  const colors = [
    `rgba(0, 255, 255, ${0.3 * intensity})`, // Cyan
    `rgba(255, 0, 255, ${0.2 * intensity})`, // Magenta
    `rgba(0, 255, 0, ${0.1 * intensity})`, // Green
  ];

  return `
    0 0 ${20 * intensity}px ${colors[0]},
    0 0 ${40 * intensity}px ${colors[1]},
    0 0 ${60 * intensity}px ${colors[2]}
  `;
}

export function calculateProfitPercentage(
  input: number,
  output: number
): number {
  if (input === 0) return 0;
  return ((output - input) / input) * 100;
}

export function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

export function decimalToHex(decimal: number): string {
  return "0x" + decimal.toString(16);
}

export function formatTokenAmount(rawAmount: bigint, decimals: number, symbol: string): string {
  const factor = 10n ** BigInt(decimals);
  const whole = rawAmount / factor;
  const fraction = rawAmount % factor;

  if (fraction === 0n) {
    return `${whole.toLocaleString()} ${symbol}`;
  }

  // Pad fraction with leading zeros and format
  const fractionString = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}.${fractionString} ${symbol}`;
}
