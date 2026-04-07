"use client";

import { AiCard } from "@/components/ai/AiCard";
import { formatNumber, formatAiCurrency } from "@/lib/utils/ai";
import type { SegmentMetricEntry } from "@/types/ai";

interface SegmentDetailsTableProps {
  segments: Record<string, SegmentMetricEntry>;
}

/**
 * Rank-based normalization to 0-100 scale.
 * This prevents one outlier (VIP) from dominating all scores.
 * - Recency: INVERTED (lower days = higher rank = higher score)
 * - Frequency: DIRECT (higher = higher rank)
 * - Monetary: DIRECT (higher = higher rank)
 */
function computeNormalizedScores(segments: Record<string, SegmentMetricEntry>) {
  const entries = Object.entries(segments);
  const n = entries.length;

  if (n <= 1) {
    const scores: Record<string, { r: number; f: number; m: number }> = {};
    entries.forEach(([name]) => { scores[name] = { r: 50, f: 50, m: 50 }; });
    return scores;
  }

  // Get ranks for each dimension (0 = worst, n-1 = best)
  const sortedByR = [...entries].sort((a, b) => b[1].avg_recency - a[1].avg_recency);
  const sortedByF = [...entries].sort((a, b) => a[1].avg_frequency - b[1].avg_frequency);
  const sortedByM = [...entries].sort((a, b) => a[1].avg_monetary - b[1].avg_monetary);

  const rankR: Record<string, number> = {};
  const rankF: Record<string, number> = {};
  const rankM: Record<string, number> = {};

  sortedByR.forEach(([name], idx) => { rankR[name] = idx; });
  sortedByF.forEach(([name], idx) => { rankF[name] = idx; });
  sortedByM.forEach(([name], idx) => { rankM[name] = idx; });

  const toScore = (rank: number) => Math.round((rank / (n - 1)) * 100);

  const scores: Record<string, { r: number; f: number; m: number }> = {};
  entries.forEach(([name]) => {
    scores[name] = {
      r: toScore(rankR[name]),
      f: toScore(rankF[name]),
      m: toScore(rankM[name]),
    };
  });
  return scores;
}

/** Color based on score: green for high, yellow for mid, red for low */
function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-500";
}

/** Visual mini-bar for score */
function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color.replace("text-", "bg-")}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${color}`}>{score}</span>
    </div>
  );
}

export function SegmentDetailsTable({ segments }: SegmentDetailsTableProps) {
  const scores = computeNormalizedScores(segments);

  return (
    <AiCard title="Segment Details" subtitle="Raw values + normalized scores (0-100)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Segment</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Customers</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">%</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Recency</th>
              <th className="text-center py-3 px-4 font-medium text-muted-foreground">R</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Frequency</th>
              <th className="text-center py-3 px-4 font-medium text-muted-foreground">F</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Monetary</th>
              <th className="text-center py-3 px-4 font-medium text-muted-foreground">M</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(segments).map(([name, s]) => {
              const sc = scores[name];
              return (
                <tr key={name} className="border-b border-border hover:bg-accent">
                  <td className="py-3 px-4 font-medium text-foreground">{name}</td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{formatNumber(s.count)}</td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{s.percentage.toFixed(1)}%</td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{Math.round(s.avg_recency)}d</td>
                  <td className="py-3 px-4"><ScoreBar score={sc.r} color={scoreColor(sc.r)} /></td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{s.avg_frequency.toFixed(1)}</td>
                  <td className="py-3 px-4"><ScoreBar score={sc.f} color={scoreColor(sc.f)} /></td>
                  <td className="text-right py-3 px-4 text-muted-foreground">{formatAiCurrency(s.avg_monetary)}</td>
                  <td className="py-3 px-4"><ScoreBar score={sc.m} color={scoreColor(sc.m)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        R/F/M scores: rank-based 0-100 (best segment = 100, worst = 0). R is inverted (recent = high score).
      </p>
    </AiCard>
  );
}
