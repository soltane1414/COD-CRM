"use client";

import { useState, useEffect } from "react";
import { AiSpinner } from "@/components/ai/AiSpinner";
import { AiAlert } from "@/components/ai/AiAlert";
import { AiCard } from "@/components/ai/AiCard";
import { SegmentPieChart } from "@/components/ai/SegmentPieChart";
import { SegmentBarChart } from "@/components/ai/SegmentBarChart";
import { SegmentRadarChart } from "@/components/ai/SegmentRadarChart";
import { SegmentDetailsTable } from "@/components/ai/SegmentDetailsTable";
import { mlApi } from "@/lib/api/ml-client";
import type { SegmentationMetrics } from "@/types/ai";

function scoreLabel(score: number | null, type: "silhouette" | "davies_bouldin"): { text: string; color: string } {
  if (score === null) return { text: "N/A", color: "text-muted-foreground" };
  if (type === "silhouette") {
    if (score >= 0.7) return { text: "Excellent", color: "text-green-600" };
    if (score >= 0.5) return { text: "Good", color: "text-green-500" };
    if (score >= 0.25) return { text: "Fair", color: "text-yellow-500" };
    return { text: "Weak", color: "text-red-500" };
  } else {
    if (score <= 0.5) return { text: "Excellent", color: "text-green-600" };
    if (score <= 1.0) return { text: "Good", color: "text-green-500" };
    if (score <= 2.0) return { text: "Fair", color: "text-yellow-500" };
    return { text: "Weak", color: "text-red-500" };
  }
}

export default function SegmentsPage() {
  const [segData, setSegData] = useState<SegmentationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const metricsRes = await mlApi.getMetrics();
        setSegData(metricsRes.data.segmentation);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load segments");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <AiSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !segData) {
    return <AiAlert variant="error">{error || "No segmentation data available"}</AiAlert>;
  }

  const sil = segData.silhouette_score;
  const db  = segData.davies_bouldin_score;
  const silLabel = scoreLabel(sil, "silhouette");
  const dbLabel  = scoreLabel(db, "davies_bouldin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Segments</h1>
        <p className="text-sm text-muted-foreground">RFM-based customer clustering analysis</p>
      </div>

      {/* Clustering quality metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AiCard>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Algorithm</p>
            <p className="text-lg font-bold">{segData.algorithm}</p>
          </div>
        </AiCard>
        <AiCard>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Customers</p>
            <p className="text-lg font-bold">{segData.total_customers}</p>
          </div>
        </AiCard>
        <AiCard>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Silhouette ↑</p>
            <p className="text-lg font-bold">{sil !== null ? sil.toFixed(3) : "—"}</p>
            <p className={`text-xs font-medium ${silLabel.color}`}>{silLabel.text}</p>
            <p className="text-xs text-muted-foreground">range −1 to 1</p>
          </div>
        </AiCard>
        <AiCard>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Davies-Bouldin ↓</p>
            <p className="text-lg font-bold">{db !== null ? db.toFixed(3) : "—"}</p>
            <p className={`text-xs font-medium ${dbLabel.color}`}>{dbLabel.text}</p>
            <p className="text-xs text-muted-foreground">lower is better</p>
          </div>
        </AiCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SegmentPieChart segments={segData.segments} />
        <SegmentRadarChart segments={segData.segments} />
      </div>

      <SegmentBarChart segments={segData.segments} />

      <SegmentDetailsTable segments={segData.segments} />
    </div>
  );
}
