"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { AiCard } from "@/components/ai/AiCard";
import type { SegmentMetricEntry } from "@/types/ai";

interface SegmentRadarChartProps {
  segments: Record<string, SegmentMetricEntry>;
}

// Colors for different segments
const SEGMENT_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
];

/**
 * Rank-based normalization to 0-100 scale.
 * This prevents one outlier (VIP) from dominating all scores.
 * - Recency: INVERTED (lower days = higher rank = higher score)
 * - Frequency: DIRECT (higher = higher rank)
 * - Monetary: DIRECT (higher = higher rank)
 */
function normalizeRFM(segments: Record<string, SegmentMetricEntry>) {
  const entries = Object.entries(segments);
  const n = entries.length;
  if (n <= 1) {
    return entries.map(([name]) => ({ name, rScore: 50, fScore: 50, mScore: 50 }));
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

  return entries.map(([name]) => ({
    name,
    rScore: toScore(rankR[name]),
    fScore: toScore(rankF[name]),
    mScore: toScore(rankM[name]),
  }));
}

export function SegmentRadarChart({ segments }: SegmentRadarChartProps) {
  const normalized = normalizeRFM(segments);

  // Transform data for radar chart format
  // Each axis is an RFM dimension, each segment is a separate Radar
  const radarData = [
    { dimension: "Recency", fullMark: 100 },
    { dimension: "Frequency", fullMark: 100 },
    { dimension: "Monetary", fullMark: 100 },
  ].map((axis) => {
    const row: Record<string, string | number> = { dimension: axis.dimension };
    normalized.forEach((seg) => {
      if (axis.dimension === "Recency") row[seg.name] = seg.rScore;
      if (axis.dimension === "Frequency") row[seg.name] = seg.fScore;
      if (axis.dimension === "Monetary") row[seg.name] = seg.mScore;
    });
    return row;
  });

  return (
    <AiCard title="RFM Radar" subtitle="Rank-based scores (evenly distributed)">
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value) => [`${value ?? 0}`, "Score"]}
          />
          {normalized.map((seg, idx) => (
            <Radar
              key={seg.name}
              name={seg.name}
              dataKey={seg.name}
              stroke={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]}
              fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </AiCard>
  );
}
