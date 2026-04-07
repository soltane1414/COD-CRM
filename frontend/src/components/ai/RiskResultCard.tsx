"use client";

import { AiCard } from "@/components/ai/AiCard";
import { Badge } from "@/components/ui/badge";
import { RiskScoreGauge } from "./RiskScoreGauge";
import { AlertTriangle } from "lucide-react";
import { RISK_COLORS } from "@/lib/utils/ai";
import type { RiskPredictionResult } from "@/types/ai";

export function RiskResultCard({ result }: { result: RiskPredictionResult }) {
  return (
    <div className="space-y-4">
      <AiCard>
        <div className="flex flex-col items-center gap-4">
          <RiskScoreGauge
            score={result.success_probability * 100}
            category={result.category}
          />
          <Badge variant="outline">
            {result.category.toUpperCase()} RISK
          </Badge>
          <p className="text-sm text-center text-muted-foreground max-w-md">
            {result.recommendation}
          </p>
        </div>
      </AiCard>

      {result.reasons.length > 0 && (
        <AiCard title="Risk Factors">
          <ul className="space-y-2">
            {result.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{reason}</span>
              </li>
            ))}
          </ul>
        </AiCard>
      )}

      <AiCard title="Model Scores">
        <div className="space-y-3">
          {Object.entries(result.model_scores).map(([name, score]) => (
            <div key={name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize text-muted-foreground">{name}</span>
                <span className="font-medium text-foreground">
                  {score.toFixed(1)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(score, 100)}%`,
                    backgroundColor: RISK_COLORS[result.category].fill,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </AiCard>
    </div>
  );
}
