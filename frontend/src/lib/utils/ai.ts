import type { RiskCategory } from "@/types/ai";

export const RISK_COLORS: Record<
  RiskCategory,
  { bg: string; text: string; border: string; fill: string }
> = {
  critical: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500",
    fill: "#EF4444",
  },
  high: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-500",
    fill: "#F97316",
  },
  medium: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-500",
    fill: "#EAB308",
  },
  low: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-500",
    fill: "#22C55E",
  },
};

export const SEGMENT_COLORS: Record<string, string> = {
  VIP: "#8B5CF6",
  Loyal: "#3B82F6",
  "At Risk": "#F59E0B",
  Lost: "#EF4444",
  "Segment 4": "#6B7280",
};

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function formatAiPercent(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatAiCurrency(n: number): string {
  return `${new Intl.NumberFormat("en-US").format(Math.round(n))} DZD`;
}

export function formatMetric(n: number, decimals = 4): string {
  return n.toFixed(decimals);
}

export function getSegmentColor(name: string): string {
  return SEGMENT_COLORS[name] || "#6B7280";
}
