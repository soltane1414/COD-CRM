"use client";

import { useState } from "react";
import { RiskPredictionForm } from "@/components/ai/RiskPredictionForm";
import { RiskResultCard } from "@/components/ai/RiskResultCard";
import { AiAlert } from "@/components/ai/AiAlert";
import { mlApi } from "@/lib/api/ml-client";
import { useI18n } from "@/providers/i18n-provider";
import type { RiskPredictionResult, OrderRiskRequest } from "@/types/ai";

export default function RiskPredictionPage() {
  const { t } = useI18n();
  const [result, setResult] = useState<RiskPredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: OrderRiskRequest) => {
    setLoading(true);
    setError(null);
    try {
      const res = await mlApi.predictOrderRisk(data);
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.prediction_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("ai.risk_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ai.risk_subtitle")}</p>
      </div>

      {error && <AiAlert variant="error">{error}</AiAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskPredictionForm onSubmit={handleSubmit} isLoading={loading} />
        {result && <RiskResultCard result={result} />}
      </div>
    </div>
  );
}
