"use client";

import { useState } from "react";
import { AiCard } from "@/components/ai/AiCard";
import { AiAlert } from "@/components/ai/AiAlert";
import { AiSpinner } from "@/components/ai/AiSpinner";
import { Button } from "@/components/ui/button";
import { mlApi } from "@/lib/api/ml-client";

type Period = "day" | "week" | "month";

export default function InsightsPage() {
  const [summary, setSummary] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSummary = async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await mlApi.getInsightsSummary("en", period);
      setSummary(res.data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate insights");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRecommendations = async () => {
    setLoadingRecs(true);
    setError(null);
    try {
      const res = await mlApi.getRecommendations(
        "Provide actionable business recommendations for a COD e-commerce store in Algeria",
        "en"
      );
      setRecommendations(res.data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recommendations");
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Insights</h1>
        <p className="text-sm text-muted-foreground">
          Gemini-powered business analysis and recommendations
        </p>
      </div>

      {error && <AiAlert variant="error">{error}</AiAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AiCard title="Business Summary" subtitle="AI-generated overview of your business performance">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-foreground">Period:</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="flex h-9 appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>

            <Button onClick={handleSummary} isLoading={loadingSummary} className="w-full">
              Generate Summary
            </Button>

            {loadingSummary && (
              <div className="flex items-center justify-center py-8">
                <AiSpinner className="h-6 w-6" />
              </div>
            )}

            {summary && (
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap border-t border-border pt-4">
                {summary}
              </div>
            )}
          </div>
        </AiCard>

        <AiCard title="Recommendations" subtitle="Actionable suggestions powered by AI">
          <div className="space-y-4">
            <Button onClick={handleRecommendations} isLoading={loadingRecs} className="w-full">
              Get Recommendations
            </Button>

            {loadingRecs && (
              <div className="flex items-center justify-center py-8">
                <AiSpinner className="h-6 w-6" />
              </div>
            )}

            {recommendations && (
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap border-t border-border pt-4">
                {recommendations}
              </div>
            )}
          </div>
        </AiCard>
      </div>
    </div>
  );
}
