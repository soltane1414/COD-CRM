"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AiCard } from "@/components/ai/AiCard";
import { getSegmentColor } from "@/lib/utils/ai";
import type { SegmentMetricEntry } from "@/types/ai";

interface SegmentPieChartProps {
  segments: Record<string, SegmentMetricEntry>;
}

export function SegmentPieChart({ segments }: SegmentPieChartProps) {
  const data = Object.entries(segments).map(([name, s]) => ({
    name,
    value: s.count,
    percentage: s.percentage,
  }));

  return (
    <AiCard title="Segment Distribution">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(1)}%)`}
            labelLine
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={getSegmentColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value, name) => [`${value} customers`, String(name)]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </AiCard>
  );
}
