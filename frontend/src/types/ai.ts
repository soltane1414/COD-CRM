// === AI API Response Wrapper ===
export interface AiApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// === Health ===
export interface AiHealthStatus {
  status: "ok" | "error";
  service: string;
  version: string;
}

// === Risk Prediction ===
export interface OrderRiskRequest {
  order_id?: number;
  customer_name?: string;
  customer_phone?: string;
  wilaya_id?: number;
  customer_state?: string;
  commune?: string;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  n_items: number;
  product_category?: string;
  order_date?: string;
  is_repeat_customer: boolean;
  customer_order_count: number;
  customer_total_spent: number;
  estimated_delivery_days: number;
  avg_product_weight: number;
  payment_method?: string;
  has_boleto?: number;
  has_credit_card?: number;
  has_voucher?: number;
  has_debit_card?: number;
  n_payment_methods?: number;
  max_installments?: number;
  avg_photos: number;
  avg_desc_length: number;
  avg_name_length: number;
  avg_volume: number;
  seller_customer_same_state?: number;
  n_sellers: number;
}

export type RiskCategory = "critical" | "high" | "medium" | "low";

export interface RiskPredictionResult {
  score: number;
  category: RiskCategory;
  success_probability: number;
  reasons: string[];
  recommendation: string;
  model_scores: Record<string, number>;
}

export interface ModelInfo {
  model_loaded: boolean;
  features: string[];
  n_features: number;
  optimal_threshold: number;
}

// === Segmentation ===
export interface SegmentMetricEntry {
  count: number;
  percentage: number;
  avg_recency: number;
  avg_frequency: number;
  avg_monetary: number;
}

// === Forecasting ===
export interface ForecastPrediction {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

export type ForecastEventType =
  | "ramadan_start"
  | "eid_al_fitr"
  | "eid_al_adha"
  | "mawlid"
  | "algerian_holiday";

export interface EventAnnotation {
  date: string;
  event: ForecastEventType;
  label: string;
}

export interface ForecastResult {
  category: string;
  periods: number;
  predictions: ForecastPrediction[];
  event_annotations?: EventAnnotation[];
}

// === Metrics ===
export interface ModelMetric {
  auc_roc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface RiskMetrics {
  models: Record<string, ModelMetric>;
  optimal_threshold: number;
  ensemble_weights: Record<string, number>;
  confusion_matrix_default: ConfusionMatrix & { threshold: number };
  confusion_matrix_optimal: ConfusionMatrix & { threshold: number };
  per_class_metrics: Record<
    string,
    Record<string, { precision: number; recall: number; f1: number }>
  >;
  dataset: {
    total_samples: number;
    train_samples: number;
    test_samples: number;
    positive_rate: number;
    original_orders: number;
    clean_orders: number;
    failure_rate: number;
  };
  features: string[];
  optimizations: {
    target: string;
    resampling: string;
    hyperparameters: string;
    n_features: number;
  };
}

export interface SegmentationMetrics {
  algorithm: string;
  n_clusters: number;
  total_customers: number;
  silhouette_score: number | null;
  davies_bouldin_score: number | null;
  segments: Record<string, SegmentMetricEntry>;
}

export interface ForecastingMetrics {
  models_trained: string[];
  method: string;
  lightgbm: { mae: number; rmse: number };
  baseline_moving_avg: { mae: number; rmse: number };
  improvement_mae_pct: number;
  time_series_days: number;
  test_days: number;
}

export interface TrainingMetrics {
  trained_at: string;
  dataset: string;
  total_orders: number;
  delivery_rate: number;
  risk_prediction: RiskMetrics;
  segmentation: SegmentationMetrics;
  forecasting: ForecastingMetrics;
}

// === LLM Insights ===
export interface InsightsSummary {
  summary: string;
  lang: string;
  period?: string;
  generated: boolean;
}

export interface RiskExplanation {
  explanation: string;
  score?: number;
  lang?: string;
  generated: boolean;
}

export interface RecommendationsResult {
  recommendations: string;
  lang: string;
  generated: boolean;
}

// === Retraining ===
export interface DataFormatInfo {
  required_columns: Record<string, string>;
  optional_columns: Record<string, string>;
  notes: string[];
}

export interface RetrainingResult {
  orders_processed: number;
  delivery_rate: number;
  risk_auc: number;
  risk_f1: number;
  segments_found: number;
  forecast_models: number;
  models_reloaded: boolean;
  backup_location: string;
}
