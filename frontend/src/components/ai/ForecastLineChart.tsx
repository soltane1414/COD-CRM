"use client";

import { useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AiCard } from "@/components/ai/AiCard";
import type { ForecastPrediction, EventAnnotation, ForecastEventType } from "@/types/ai";

const EVENT_COLORS: Record<ForecastEventType, string> = {
  ramadan_start: "#10B981",
  eid_al_fitr: "#F59E0B",
  eid_al_adha: "#F97316",
  mawlid: "#8B5CF6",
  algerian_holiday: "#EF4444",
};

const EVENT_LABELS: Record<ForecastEventType, string> = {
  ramadan_start: "Ramadan",
  eid_al_fitr: "Eid al-Fitr",
  eid_al_adha: "Eid al-Adha",
  mawlid: "Mawlid",
  algerian_holiday: "Holiday",
};

interface ForecastLineChartProps {
  predictions: ForecastPrediction[];
  eventAnnotations?: EventAnnotation[];
}

interface ChartDataPoint {
  date: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  band: [number, number];
}

export function ForecastLineChart({ predictions, eventAnnotations = [] }: ForecastLineChartProps) {
  const chartData: ChartDataPoint[] = useMemo(() => {
    return predictions.map((p) => {
      const dateStr = new Date(p.ds).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateStr,
        yhat: Math.max(0, Math.round(p.yhat)),
        yhat_lower: Math.max(0, Math.round(p.yhat_lower)),
        yhat_upper: Math.round(p.yhat_upper),
        band: [Math.max(0, Math.round(p.yhat_lower)), Math.round(p.yhat_upper)],
      };
    });
  }, [predictions]);

  const rawToFormatted = useMemo(() => {
    const mapping: Record<string, string> = {};
    predictions.forEach((p) => {
      const raw = p.ds.split("T")[0];
      const formatted = new Date(p.ds).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      mapping[raw] = formatted;
    });
    return mapping;
  }, [predictions]);

  const annotationsByDate = useMemo(() => {
    const map: Record<string, EventAnnotation[]> = {};
    eventAnnotations.forEach((a) => {
      const key = a.date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [eventAnnotations]);

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(eventAnnotations.map((a) => a.event));
    return Array.from(types);
  }, [eventAnnotations]);

  return (
    <AiCard title="Demand Forecast" subtitle="LightGBM forecast with confidence bands">
      {uniqueEventTypes.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {uniqueEventTypes.map((type) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_COLORS[type] }} />
              {EVENT_LABELS[type]}
            </div>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                yhat: "Forecast",
                band: "Confidence Band",
              };
              return [value ?? 0, labels[String(name)] || String(name)];
            }}
            labelFormatter={(label) => {
              const labelStr = String(label);
              const dateKey = Object.entries(rawToFormatted).find(([, v]) => v === labelStr)?.[0];
              const events = dateKey ? annotationsByDate[dateKey] : undefined;
              if (events?.length) {
                return `${labelStr} — ${events.map((e) => e.label).join(", ")}`;
              }
              return labelStr;
            }}
          />
          <Area
            type="monotone"
            dataKey="band"
            fill="#3B82F6"
            fillOpacity={0.1}
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="yhat"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            name="Forecast"
          />
          {eventAnnotations.map((annotation, idx) => {
            const formatted = rawToFormatted[annotation.date.split("T")[0]];
            if (!formatted) return null;
            return (
              <ReferenceLine
                key={`${annotation.date}-${idx}`}
                x={formatted}
                stroke={EVENT_COLORS[annotation.event]}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label=""
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </AiCard>
  );
}
