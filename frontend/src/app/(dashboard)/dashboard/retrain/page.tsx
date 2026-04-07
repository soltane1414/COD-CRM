"use client";

import { useState, useEffect, useCallback } from "react";
import { AiSpinner } from "@/components/ai/AiSpinner";
import { AiAlert } from "@/components/ai/AiAlert";
import { AiCard } from "@/components/ai/AiCard";
import { CsvUploadForm } from "@/components/ai/CsvUploadForm";
import { CurrentMetricsDisplay } from "@/components/ai/CurrentMetricsDisplay";
import { DataFormatInfo } from "@/components/ai/DataFormatInfo";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import { mlApi } from "@/lib/api/ml-client";
import type { TrainingMetrics, DataFormatInfo as DataFormatType, RetrainingResult } from "@/types/ai";

export default function RetrainPage() {
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [format, setFormat] = useState<DataFormatType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrainResult, setRetrainResult] = useState<RetrainingResult | null>(null);
  const [dbRetraining, setDbRetraining] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, formatRes] = await Promise.all([
        mlApi.getMetrics(),
        mlApi.getDataFormat(),
      ]);
      setMetrics(metricsRes.data);
      setFormat(formatRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetrainSuccess = (result: RetrainingResult) => {
    setRetrainResult(result);
    loadData();
  };

  const handleRetrainFromDatabase = async () => {
    setDbRetraining(true);
    setError(null);
    setRetrainResult(null);
    try {
      const res = await mlApi.retrainFromDatabase();
      setRetrainResult(res.data);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Database retraining failed");
    } finally {
      setDbRetraining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <AiSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Model Retraining</h1>
        <p className="text-sm text-muted-foreground">
          Retrain ML models with your data
        </p>
      </div>

      {error && <AiAlert variant="error">{error}</AiAlert>}

      {retrainResult && (
        <AiAlert variant="success">
          Retraining complete! Processed {retrainResult.orders_processed} orders.
          Risk AUC: {retrainResult.risk_auc.toFixed(4)}, F1: {retrainResult.risk_f1.toFixed(4)}.
          Found {retrainResult.segments_found} segments, {retrainResult.forecast_models} forecast models.
        </AiAlert>
      )}

      <AiCard title="Retrain from Database" subtitle="Use your CRM order history to retrain all ML models">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pulls all orders from the CRM database and retrains risk prediction,
            customer segmentation, and demand forecasting models.
          </p>
          <Button onClick={handleRetrainFromDatabase} isLoading={dbRetraining} className="w-full">
            <Database className="h-4 w-4 mr-2" />
            {dbRetraining ? "Retraining from Database..." : "Retrain from Database"}
          </Button>
        </div>
      </AiCard>

      {metrics && <CurrentMetricsDisplay metrics={metrics} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CsvUploadForm onSuccess={handleRetrainSuccess} />
        {format && <DataFormatInfo format={format} />}
      </div>
    </div>
  );
}
