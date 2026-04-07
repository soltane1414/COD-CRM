"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AiCard } from "@/components/ai/AiCard";
import type { SegmentMetricEntry } from "@/types/ai";

interface SegmentBarChartProps {
  segments: Record<string, SegmentMetricEntry>;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  color: "hsl(var(--foreground))",
};

const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

interface MiniChartProps {
  data: Array<{ name: string; value: number }>;
  label: string;
  unit: string;
  color: string;
  hint?: string;
}

function MiniChart({ data, label, unit, color, hint }: MiniChartProps) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
      </div>
      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={tickStyle} />
          <YAxis type="category" dataKey="name" tick={tickStyle} width={90} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value ?? 0).toLocaleString()} ${unit}`, label]}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SegmentBarChart({ segments }: SegmentBarChartProps) {
  const entries = Object.entries(segments);

  const recencyData = entries.map(([name, s]) => ({ name, value: Math.round(s.avg_recency) }));
  const frequencyData = entries.map(([name, s]) => ({ name, value: Math.round(s.avg_frequency * 10) / 10 }));
  const monetaryData = entries.map(([name, s]) => ({ name, value: Math.round(s.avg_monetary) }));

  return (
    <AiCard title="RFM Breakdown" subtitle="Each dimension on its own scale">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MiniChart data={recencyData} label="Recency" unit="days" color="#3B82F6" hint="lower = more recent" />
        <MiniChart data={frequencyData} label="Frequency" unit="orders" color="#8B5CF6" hint="higher = more loyal" />
        <MiniChart data={monetaryData} label="Monetary" unit="DZD" color="#F59E0B" hint="higher = bigger spender" />
      </div>
    </AiCard>
  );
}
