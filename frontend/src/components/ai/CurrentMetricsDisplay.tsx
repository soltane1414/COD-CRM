"use client";

import { AiCard } from "@/components/ai/AiCard";
import { formatMetric } from "@/lib/utils/ai";
import type { TrainingMetrics } from "@/types/ai";

interface CurrentMetricsDisplayProps {
  metrics: TrainingMetrics;
}

export function CurrentMetricsDisplay({ metrics }: CurrentMetricsDisplayProps) {
  const risk = metrics.risk_prediction;
  const ensemble = risk.models.ensemble;
  const seg = metrics.segmentation;
  const fc = metrics.forecasting;

  const items = [
    { label: "Trained At", value: new Date(metrics.trained_at).toLocaleString() },
    { label: "Dataset", value: metrics.dataset },
    { label: "Total Orders", value: metrics.total_orders.toLocaleString() },
    { label: "Delivery Rate", value: `${(metrics.delivery_rate * 100).toFixed(1)}%` },
    { label: "Risk AUC-ROC", value: ensemble ? formatMetric(ensemble.auc_roc) : "N/A" },
    { label: "Risk F1-Score", value: ensemble ? formatMetric(ensemble.f1_score) : "N/A" },
    { label: "Customer Segments", value: String(seg.n_clusters) },
    { label: "Total Customers", value: seg.total_customers.toLocaleString() },
    { label: "Forecast Method", value: fc.method },
    { label: "Forecast MAE Improvement", value: `${fc.improvement_mae_pct.toFixed(1)}%` },
  ];

  return (
    <AiCard title="Current Model Metrics" subtitle="From the last training run">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </AiCard>
  );
}
