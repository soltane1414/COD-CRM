"use client";

import { AiCard } from "@/components/ai/AiCard";
import { formatMetric } from "@/lib/utils/ai";
import type { ModelMetric } from "@/types/ai";

export function ModelPerformanceTable({ models }: { models: Record<string, ModelMetric> }) {
  return (
    <AiCard title="Model Comparison">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">AUC-ROC</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Accuracy</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Precision</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Recall</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">F1-Score</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(models).map(([name, m]) => (
              <tr key={name} className={`border-b border-border ${name === "ensemble" ? "bg-primary/5 font-semibold" : "hover:bg-accent"}`}>
                <td className="py-3 px-4 capitalize text-foreground">{name}</td>
                <td className="text-right py-3 px-4 text-muted-foreground">{formatMetric(m.auc_roc)}</td>
                <td className="text-right py-3 px-4 text-muted-foreground">{formatMetric(m.accuracy)}</td>
                <td className="text-right py-3 px-4 text-muted-foreground">{formatMetric(m.precision)}</td>
                <td className="text-right py-3 px-4 text-muted-foreground">{formatMetric(m.recall)}</td>
                <td className="text-right py-3 px-4 text-muted-foreground">{formatMetric(m.f1_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AiCard>
  );
}
