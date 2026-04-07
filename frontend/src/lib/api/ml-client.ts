import type {
  AiApiResponse,
  AiHealthStatus,
  OrderRiskRequest,
  RiskPredictionResult,
  ModelInfo,
  ForecastResult,
  TrainingMetrics,
  DataFormatInfo,
  RetrainingResult,
  InsightsSummary,
  RiskExplanation,
  RecommendationsResult,
} from "@/types/ai";

const ML_BASE_URL =
  process.env.NEXT_PUBLIC_ML_SERVICE_URL || "http://localhost:8001";

async function fetchMl<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${ML_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {};
  if (options?.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export const mlApi = {
  getHealth: () => fetchMl<AiHealthStatus>("/api/health"),

  predictOrderRisk: (data: OrderRiskRequest) =>
    fetchMl<AiApiResponse<RiskPredictionResult>>("/api/predict/order-risk", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getModelInfo: () =>
    fetchMl<AiApiResponse<ModelInfo>>("/api/predict/model-info"),

  getForecast: (category: string, periods: number) =>
    fetchMl<AiApiResponse<ForecastResult>>(
      `/api/forecast/demand?category=${category}&periods=${periods}`
    ),

  getForecastCategories: () =>
    fetchMl<AiApiResponse<{ categories: string[] }>>("/api/forecast/categories"),

  getMetrics: () =>
    fetchMl<AiApiResponse<TrainingMetrics>>("/api/retrain/metrics"),

  getDataFormat: () =>
    fetchMl<AiApiResponse<DataFormatInfo>>("/api/retrain/data-format"),

  uploadAndTrain: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchMl<AiApiResponse<RetrainingResult>>(
      "/api/retrain/upload-and-train",
      { method: "POST", body: formData, headers: {} }
    );
  },

  retrainFromDatabase: () =>
    fetchMl<AiApiResponse<RetrainingResult>>("/api/retrain/from-database", {
      method: "POST",
    }),

  getInsightsSummary: (lang: string = "en", period: string = "week") =>
    fetchMl<AiApiResponse<InsightsSummary>>(
      `/api/insights/summary?lang=${lang}&period=${period}`
    ),

  explainOrderRisk: (score: number, reasons: string[], lang: string = "en") =>
    fetchMl<AiApiResponse<RiskExplanation>>(
      `/api/insights/order-explanation?score=${score}&reasons=${encodeURIComponent(reasons.join(","))}&lang=${lang}`
    ),

  getRecommendations: (context: string, lang: string = "en") =>
    fetchMl<AiApiResponse<RecommendationsResult>>(
      `/api/insights/recommendations?context=${encodeURIComponent(context)}&lang=${lang}`
    ),
};
