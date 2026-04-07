"use client";

import { useState, useEffect } from "react";
import { AiSpinner } from "@/components/ai/AiSpinner";
import { AiAlert } from "@/components/ai/AiAlert";
import { ForecastLineChart } from "@/components/ai/ForecastLineChart";
import { ForecastControls } from "@/components/ai/ForecastControls";
import { AiCard } from "@/components/ai/AiCard";
import { mlApi } from "@/lib/api/ml-client";
import { useI18n } from "@/providers/i18n-provider";
import type { ForecastResult } from "@/types/ai";

export default function ForecastPage() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [periods, setPeriods] = useState(30);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mlApi
      .getForecastCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => {});
    mlApi
      .getForecast("all", 30)
      .then((res) => setForecast(res.data))
      .catch(() => {});
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mlApi.getForecast(selectedCategory, periods);
      setForecast(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ai.forecast_failed"));
    } finally {
      setLoading(false);
    }
  };

  const stats = forecast?.predictions
    ? {
        avg: Math.round(
          forecast.predictions.reduce((s, p) => s + p.yhat, 0) / forecast.predictions.length
        ),
        min: Math.round(Math.min(...forecast.predictions.map((p) => p.yhat))),
        max: Math.round(Math.max(...forecast.predictions.map((p) => p.yhat))),
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("ai.forecast_title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("ai.forecast_subtitle")}
        </p>
      </div>

      {error && <AiAlert variant="error">{error}</AiAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <ForecastControls
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            periods={periods}
            onPeriodsChange={setPeriods}
            onFetch={handleFetch}
            isLoading={loading}
          />
        </div>

        <div className="lg:col-span-3">
          {loading && !forecast ? (
            <div className="flex items-center justify-center h-64">
              <AiSpinner className="h-8 w-8" />
            </div>
          ) : forecast ? (
            <div className="space-y-4">
              <ForecastLineChart
                predictions={forecast.predictions}
                eventAnnotations={forecast.event_annotations}
              />

              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: t("ai.forecast_avg_daily"), value: stats.avg },
                    { label: t("ai.forecast_min_daily"), value: stats.min },
                    { label: t("ai.forecast_max_daily"), value: stats.max },
                  ].map(({ label, value }) => (
                    <AiCard key={label}>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </div>
                    </AiCard>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <AiCard>
              <p className="text-center text-muted-foreground py-8">
                {t("ai.forecast_prompt")}
              </p>
            </AiCard>
          )}
        </div>
      </div>
    </div>
  );
}
